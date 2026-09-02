import { BadRequestException, ConflictException } from '@nestjs/common';
import { type User } from '@prisma/client';

import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

type FindUniqueArgs = {
  where: {
    email: string;
  };
};

type CreateArgs = {
  data: {
    email: string;
    passwordHash: string;
    emailVerifiedAt: null;
  };
};

class UserDelegateMock {
  createdArgs: CreateArgs | null = null;
  existingUser: User | null = null;

  findUnique(args: FindUniqueArgs): Promise<User | null> {
    if (args.where.email === this.existingUser?.email) {
      return Promise.resolve(this.existingUser);
    }

    return Promise.resolve(null);
  }

  create(args: CreateArgs): Promise<User> {
    this.createdArgs = args;

    return Promise.resolve({
      id: 'user_1',
      email: args.data.email,
      passwordHash: args.data.passwordHash,
      emailVerifiedAt: args.data.emailVerifiedAt,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  }
}

describe('AuthService', () => {
  const createService = (): {
    service: AuthService;
    userDelegate: UserDelegateMock;
  } => {
    const userDelegate = new UserDelegateMock();
    const prisma = {
      user: userDelegate,
    } as unknown as PrismaService;

    return {
      service: new AuthService(prisma),
      userDelegate,
    };
  };

  it('registers a user with normalized email and safe response', async () => {
    const { service, userDelegate } = createService();

    const response = await service.register({
      email: '  CUSTOMER@Example.COM  ',
      password: 'long-enough-password',
    });

    expect(response).toEqual({
      id: 'user_1',
      email: 'customer@example.com',
      emailVerifiedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect('passwordHash' in response).toBe(false);
    expect(userDelegate.createdArgs?.data.email).toBe('customer@example.com');
    expect(userDelegate.createdArgs?.data.emailVerifiedAt).toBeNull();
    expect(userDelegate.createdArgs?.data.passwordHash).not.toBe(
      'long-enough-password',
    );
    expect(userDelegate.createdArgs?.data.passwordHash).toMatch(/^scrypt\$/);
  });

  it('rejects duplicate email', async () => {
    const { service, userDelegate } = createService();

    userDelegate.existingUser = {
      id: 'existing_user',
      email: 'customer@example.com',
      passwordHash: 'scrypt$hash',
      emailVerifiedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    await expect(
      service.register({
        email: 'CUSTOMER@example.com',
        password: 'long-enough-password',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects passwords shorter than 12 characters', async () => {
    const { service } = createService();

    await expect(
      service.register({
        email: 'customer@example.com',
        password: 'short',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
