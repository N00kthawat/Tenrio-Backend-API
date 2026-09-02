import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import {
  randomBytes,
  createHash,
  scrypt as scryptCallback,
  type BinaryLike,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

const MIN_PASSWORD_LENGTH = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCRYPT_KEY_LENGTH = 64;
const VERIFICATION_TOKEN_BYTES = 32;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const SCRYPT_OPTIONS: ScryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
};

type ScryptAsync = (
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const scryptAsync = promisify(scryptCallback) as ScryptAsync;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResponseDto> {
    const email = this.normalizeEmail(registerDto.email);

    this.validateEmail(email);
    this.validatePassword(registerDto.password);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered.');
    }

    const passwordHash = await this.hashPassword(registerDto.password);

    try {
      const { user, verificationToken } = await this.prisma.$transaction(
        async (tx) => {
          const user = await tx.user.create({
            data: {
              email,
              passwordHash,
              emailVerifiedAt: null,
            },
          });
          const verificationToken = this.generateVerificationToken();

          await tx.emailVerificationToken.create({
            data: {
              userId: user.id,
              tokenHash: this.hashVerificationToken(verificationToken),
              expiresAt: this.getVerificationTokenExpiresAt(),
            },
          });

          return { user, verificationToken };
        },
      );

      await this.sendVerificationEmail(user.email, verificationToken);

      return {
        ...this.toSafeUserResponse(user),
        ...(this.shouldExposeDevelopmentToken()
          ? { verificationToken }
          : {}),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered.');
      }

      throw error;
    }
  }

  async verifyEmail(
    verifyEmailDto: VerifyEmailDto,
  ): Promise<AuthUserResponseDto> {
    const token = this.validateVerificationToken(verifyEmailDto.token);
    const tokenHash = this.hashVerificationToken(token);
    const tokenRecord = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Verification token is invalid.');
    }

    if (tokenRecord.usedAt) {
      throw new BadRequestException(
        'Verification token has already been used.',
      );
    }

    const now = new Date();

    if (tokenRecord.expiresAt <= now) {
      throw new BadRequestException('Verification token has expired.');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const markUsedResult = await tx.emailVerificationToken.updateMany({
        where: {
          id: tokenRecord.id,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      if (markUsedResult.count !== 1) {
        throw new BadRequestException(
          'Verification token has already been used.',
        );
      }

      if (tokenRecord.user.emailVerifiedAt) {
        return tokenRecord.user;
      }

      return tx.user.update({
        where: { id: tokenRecord.userId },
        data: { emailVerifiedAt: now },
      });
    });

    return this.toSafeUserResponse(user);
  }

  private normalizeEmail(email: unknown): string {
    if (typeof email !== 'string') {
      throw new BadRequestException('Email is required.');
    }

    return email.trim().toLowerCase();
  }

  private validateEmail(email: string): void {
    if (!EMAIL_PATTERN.test(email)) {
      throw new BadRequestException('Email must be a valid email address.');
    }
  }

  private validatePassword(password: unknown): asserts password is string {
    if (typeof password !== 'string') {
      throw new BadRequestException('Password is required.');
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        'Password must contain at least 12 characters.',
      );
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = await scryptAsync(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      SCRYPT_OPTIONS,
    );

    return [
      'scrypt',
      `N=${SCRYPT_OPTIONS.N}`,
      `r=${SCRYPT_OPTIONS.r}`,
      `p=${SCRYPT_OPTIONS.p}`,
      salt.toString('base64url'),
      derivedKey.toString('base64url'),
    ].join('$');
  }

  private generateVerificationToken(): string {
    return randomBytes(VERIFICATION_TOKEN_BYTES).toString('base64url');
  }

  private hashVerificationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getVerificationTokenExpiresAt(): Date {
    return new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
  }

  private validateVerificationToken(token: unknown): string {
    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new BadRequestException('Verification token is required.');
    }

    return token.trim();
  }

  private shouldExposeDevelopmentToken(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  private async sendVerificationEmail(
    email: string,
    verificationToken: string,
  ): Promise<void> {
    const verificationUrl = this.buildVerificationUrl(verificationToken);

    try {
      await this.emailService.sendEmail({
        to: email,
        subject: 'Verify your Tenrio email address',
        html: [
          '<p>Welcome to Tenrio.</p>',
          '<p>Please verify your email address to continue.</p>',
          `<p><a href="${verificationUrl}">Verify email</a></p>`,
        ].join(''),
        text: `Verify your Tenrio email address: ${verificationUrl}`,
      });
    } catch {
      throw new ServiceUnavailableException(
        'Registration succeeded, but verification email could not be sent.',
      );
    }
  }

  private buildVerificationUrl(verificationToken: string): string {
    const customerWebUrl = process.env.CUSTOMER_WEB_URL;

    if (!customerWebUrl) {
      throw new ServiceUnavailableException('Customer web URL is not configured.');
    }

    const url = new URL('/verify-email', customerWebUrl);

    url.searchParams.set('token', verificationToken);

    return url.toString();
  }

  private toSafeUserResponse(user: User): AuthUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
