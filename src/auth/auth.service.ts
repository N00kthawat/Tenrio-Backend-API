import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import {
  randomBytes,
  createHash,
  timingSafeEqual,
  scrypt as scryptCallback,
  type BinaryLike,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const MIN_PASSWORD_LENGTH = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCRYPT_KEY_LENGTH = 64;
const VERIFICATION_TOKEN_BYTES = 32;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_PASSWORD_TOKEN_BYTES = 32;
const RESET_PASSWORD_TOKEN_TTL_MS = 60 * 60 * 1000;
const SESSION_TOKEN_BYTES = 32;
const DEFAULT_SESSION_TTL_DAYS = 7;
const SESSION_TTL_MS_PER_DAY = 24 * 60 * 60 * 1000;
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

export type LoginResult = {
  user: AuthUserResponseDto;
  sessionToken: string;
  sessionExpiresAt: Date;
};

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

  async login(loginDto: LoginDto): Promise<LoginResult> {
    const email = this.normalizeEmail(loginDto.email);

    this.validateEmail(email);

    if (typeof loginDto.password !== 'string') {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordIsValid = await this.verifyPassword(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordIsValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email address is not verified.');
    }

    const sessionToken = this.generateSessionToken();
    const sessionExpiresAt = this.getSessionExpiresAt();

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: this.hashSessionToken(sessionToken),
        expiresAt: sessionExpiresAt,
      },
    });

    return {
      user: this.toSafeUserResponse(user),
      sessionToken,
      sessionExpiresAt,
    };
  }

  async getCurrentUser(sessionToken: unknown): Promise<AuthUserResponseDto> {
    const token = this.validateSessionToken(sessionToken);
    const session = await this.prisma.session.findUnique({
      where: {
        tokenHash: this.hashSessionToken(token),
      },
      include: {
        user: true,
      },
    });

    if (!session || session.revokedAt) {
      throw new UnauthorizedException('Invalid session.');
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid session.');
    }

    return this.toSafeUserResponse(session.user);
  }

  async logout(sessionToken: unknown): Promise<void> {
    if (typeof sessionToken !== 'string' || sessionToken.trim().length === 0) {
      return;
    }

    const token = sessionToken.trim();
    const tokenHash = this.hashSessionToken(token);

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
    });

    if (session && !session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const email = this.normalizeEmail(forgotPasswordDto.email);
    this.validateEmail(email);

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return;
    }

    const resetToken = this.generateResetPasswordToken();
    const tokenHash = this.hashResetPasswordToken(resetToken);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: this.getResetPasswordTokenExpiresAt(),
      },
    });

    try {
      await this.sendPasswordResetEmail(user.email, resetToken);
    } catch {
      // Ignore to prevent revealing email existence
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const token = this.validateResetPasswordToken(resetPasswordDto.token);
    this.validatePassword(resetPasswordDto.newPassword);

    const tokenHash = this.hashResetPasswordToken(token);
    const tokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Reset token is invalid.');
    }

    if (tokenRecord.usedAt) {
      throw new BadRequestException('Reset token has already been used.');
    }

    const now = new Date();
    if (tokenRecord.expiresAt <= now) {
      throw new BadRequestException('Reset token has expired.');
    }

    const passwordHash = await this.hashPassword(resetPasswordDto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      const markUsedResult = await tx.passwordResetToken.updateMany({
        where: {
          id: tokenRecord.id,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      if (markUsedResult.count !== 1) {
        throw new BadRequestException('Reset token has already been used.');
      }

      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash },
      });

      await tx.session.updateMany({
        where: {
          userId: tokenRecord.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });
    });
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

  private async verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    const [algorithm, nValue, rValue, pValue, salt, storedKey] =
      passwordHash.split('$');

    if (!algorithm || algorithm !== 'scrypt') {
      return false;
    }

    const parsedOptions: ScryptOptions = {
      N: this.parseScryptOption(nValue, 'N'),
      r: this.parseScryptOption(rValue, 'r'),
      p: this.parseScryptOption(pValue, 'p'),
    };
    const derivedKey = await scryptAsync(
      password,
      Buffer.from(salt ?? '', 'base64url'),
      SCRYPT_KEY_LENGTH,
      parsedOptions,
    );
    const storedKeyBuffer = Buffer.from(storedKey ?? '', 'base64url');

    if (derivedKey.length !== storedKeyBuffer.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, storedKeyBuffer);
  }

  private parseScryptOption(
    value: string | undefined,
    expectedKey: 'N' | 'r' | 'p',
  ): number {
    const [key, rawValue] = value?.split('=') ?? [];

    if (key !== expectedKey || !rawValue) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const parsedValue = Number(rawValue);

    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return parsedValue;
  }

  private generateVerificationToken(): string {
    return randomBytes(VERIFICATION_TOKEN_BYTES).toString('base64url');
  }

  private hashVerificationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateSessionToken(): string {
    return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
  }

  private hashSessionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getSessionExpiresAt(): Date {
    return new Date(Date.now() + this.getSessionTtlMs());
  }

  private getSessionTtlMs(): number {
    const configuredDays = process.env.SESSION_TTL_DAYS
      ? Number(process.env.SESSION_TTL_DAYS)
      : DEFAULT_SESSION_TTL_DAYS;

    if (!Number.isFinite(configuredDays) || configuredDays <= 0) {
      return DEFAULT_SESSION_TTL_DAYS * SESSION_TTL_MS_PER_DAY;
    }

    return configuredDays * SESSION_TTL_MS_PER_DAY;
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

  private validateSessionToken(token: unknown): string {
    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new UnauthorizedException('Invalid session.');
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

  private generateResetPasswordToken(): string {
    return randomBytes(RESET_PASSWORD_TOKEN_BYTES).toString('base64url');
  }

  private hashResetPasswordToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getResetPasswordTokenExpiresAt(): Date {
    return new Date(Date.now() + RESET_PASSWORD_TOKEN_TTL_MS);
  }

  private validateResetPasswordToken(token: unknown): string {
    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new BadRequestException('Reset token is required.');
    }
    return token.trim();
  }

  private async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<void> {
    const resetUrl = this.buildPasswordResetUrl(resetToken);

    await this.emailService.sendEmail({
      to: email,
      subject: 'Reset your Tenrio password',
      html: [
        '<p>We received a request to reset your password.</p>',
        `<p><a href="${resetUrl}">Reset Password</a></p>`,
      ].join(''),
      text: `Reset your Tenrio password: ${resetUrl}`,
    });
  }

  private buildPasswordResetUrl(resetToken: string): string {
    const customerWebUrl = process.env.CUSTOMER_WEB_URL;

    if (!customerWebUrl) {
      throw new ServiceUnavailableException('Customer web URL is not configured.');
    }

    const url = new URL('/reset-password', customerWebUrl);
    url.searchParams.set('token', resetToken);

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
