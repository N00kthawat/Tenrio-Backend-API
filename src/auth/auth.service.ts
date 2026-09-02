import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import {
  randomBytes,
  scrypt as scryptCallback,
  type BinaryLike,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

import { PrismaService } from '../prisma/prisma.service';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { RegisterDto } from './dto/register.dto';

const MIN_PASSWORD_LENGTH = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCRYPT_KEY_LENGTH = 64;
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
  constructor(private readonly prisma: PrismaService) {}

  async register(registerDto: RegisterDto): Promise<AuthUserResponseDto> {
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
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          emailVerifiedAt: null,
        },
      });

      return this.toSafeUserResponse(user);
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
