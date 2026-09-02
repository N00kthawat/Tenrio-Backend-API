import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { AuthService } from '../src/auth/auth.service';
import { EmailService } from '../src/email/email.service';
import { SendEmailInput } from '../src/email/email-provider';
import { PrismaService } from '../src/prisma/prisma.service';

type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type EmailVerificationTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

type FindUniqueUserArgs = {
  where: {
    email?: string;
    id?: string;
  };
};

type CreateUserArgs = {
  data: {
    email: string;
    passwordHash: string;
    emailVerifiedAt: null;
  };
};

type UpdateUserArgs = {
  where: {
    id: string;
  };
  data: {
    emailVerifiedAt: Date;
  };
};

type CreateTokenArgs = {
  data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  };
};

type FindUniqueTokenArgs = {
  where: {
    tokenHash: string;
  };
  include: {
    user: true;
  };
};

type UpdateManyTokenArgs = {
  where: {
    id: string;
    usedAt: null;
  };
  data: {
    usedAt: Date;
  };
};

type CreateSessionArgs = {
  data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  };
};

type FindUniqueSessionArgs = {
  where: {
    tokenHash: string;
  };
  include: {
    user: true;
  };
};

type TokenWithUser = EmailVerificationTokenRecord & {
  user: UserRecord;
};

type SessionWithUser = SessionRecord & {
  user: UserRecord;
};

type TransactionMock = {
  user: UserDelegateMock;
  emailVerificationToken: EmailVerificationTokenDelegateMock;
  session: SessionDelegateMock;
};

class UserDelegateMock {
  private nextId = 1;
  readonly records: UserRecord[] = [];
  createdArgs: CreateUserArgs | null = null;

  findUnique(args: FindUniqueUserArgs): Promise<UserRecord | null> {
    const record =
      this.records.find((user) => {
        return (
          (args.where.email !== undefined && user.email === args.where.email) ||
          (args.where.id !== undefined && user.id === args.where.id)
        );
      }) ?? null;

    return Promise.resolve(record);
  }

  create(args: CreateUserArgs): Promise<UserRecord> {
    this.createdArgs = args;

    const now = new Date('2026-01-01T00:00:00.000Z');
    const user: UserRecord = {
      id: `user_${this.nextId.toString()}`,
      email: args.data.email,
      passwordHash: args.data.passwordHash,
      emailVerifiedAt: args.data.emailVerifiedAt,
      createdAt: now,
      updatedAt: now,
    };

    this.nextId += 1;
    this.records.push(user);

    return Promise.resolve(user);
  }

  update(args: UpdateUserArgs): Promise<UserRecord> {
    const user = this.records.find((record) => record.id === args.where.id);

    if (!user) {
      throw new Error('Test user not found.');
    }

    user.emailVerifiedAt = args.data.emailVerifiedAt;
    user.updatedAt = args.data.emailVerifiedAt;

    return Promise.resolve(user);
  }
}

class EmailVerificationTokenDelegateMock {
  private nextId = 1;
  readonly records: EmailVerificationTokenRecord[] = [];

  constructor(private readonly userDelegate: UserDelegateMock) {}

  create(args: CreateTokenArgs): Promise<EmailVerificationTokenRecord> {
    const token: EmailVerificationTokenRecord = {
      id: `token_${this.nextId.toString()}`,
      userId: args.data.userId,
      tokenHash: args.data.tokenHash,
      expiresAt: args.data.expiresAt,
      usedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    this.nextId += 1;
    this.records.push(token);

    return Promise.resolve(token);
  }

  async findUnique(args: FindUniqueTokenArgs): Promise<TokenWithUser | null> {
    const token =
      this.records.find((record) => record.tokenHash === args.where.tokenHash) ??
      null;

    if (!token) {
      return null;
    }

    const user = await this.userDelegate.findUnique({
      where: { id: token.userId },
    });

    if (!user) {
      return null;
    }

    return {
      ...token,
      user,
    };
  }

  updateMany(args: UpdateManyTokenArgs): Promise<{ count: number }> {
    const token = this.records.find((record) => {
      return record.id === args.where.id && record.usedAt === args.where.usedAt;
    });

    if (!token) {
      return Promise.resolve({ count: 0 });
    }

    token.usedAt = args.data.usedAt;

    return Promise.resolve({ count: 1 });
  }
}

class SessionDelegateMock {
  private nextId = 1;
  readonly records: SessionRecord[] = [];

  constructor(private readonly userDelegate: UserDelegateMock) {}

  create(args: CreateSessionArgs): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: `session_${this.nextId.toString()}`,
      userId: args.data.userId,
      tokenHash: args.data.tokenHash,
      expiresAt: args.data.expiresAt,
      revokedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    this.nextId += 1;
    this.records.push(session);

    return Promise.resolve(session);
  }

  async findUnique(
    args: FindUniqueSessionArgs,
  ): Promise<SessionWithUser | null> {
    const session =
      this.records.find((record) => record.tokenHash === args.where.tokenHash) ??
      null;

    if (!session) {
      return null;
    }

    const user = await this.userDelegate.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return null;
    }

    return {
      ...session,
      user,
    };
  }
}

class EmailServiceMock {
  readonly sentEmails: SendEmailInput[] = [];
  shouldFail = false;

  sendEmail(input: SendEmailInput): Promise<void> {
    this.sentEmails.push(input);

    if (this.shouldFail) {
      return Promise.reject(new Error('Email failed.'));
    }

    return Promise.resolve();
  }
}

describe('AuthService', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.CUSTOMER_WEB_URL = 'http://localhost:3000';
  });

  const hashToken = (token: string): string => {
    return createHash('sha256').update(token).digest('hex');
  };

  const createService = (): {
    service: AuthService;
    userDelegate: UserDelegateMock;
    tokenDelegate: EmailVerificationTokenDelegateMock;
    sessionDelegate: SessionDelegateMock;
    emailService: EmailServiceMock;
  } => {
    const userDelegate = new UserDelegateMock();
    const tokenDelegate = new EmailVerificationTokenDelegateMock(userDelegate);
    const sessionDelegate = new SessionDelegateMock(userDelegate);
    const emailService = new EmailServiceMock();
    const tx: TransactionMock = {
      user: userDelegate,
      emailVerificationToken: tokenDelegate,
      session: sessionDelegate,
    };
    const prisma = {
      user: userDelegate,
      emailVerificationToken: tokenDelegate,
      session: sessionDelegate,
      $transaction: <T>(
        callback: (transaction: TransactionMock) => Promise<T>,
      ) => callback(tx),
    } as unknown as PrismaService;

    return {
      service: new AuthService(prisma, emailService as unknown as EmailService),
      userDelegate,
      tokenDelegate,
      sessionDelegate,
      emailService,
    };
  };

  const registerAndVerify = async (
    service: AuthService,
    email = 'customer@example.com',
  ): Promise<void> => {
    const registerResponse = await service.register({
      email,
      password: 'long-enough-password',
    });

    await service.verifyEmail({
      token: registerResponse.verificationToken ?? '',
    });
  };

  it('registers a user with normalized email, safe response, and token hash', async () => {
    const { service, userDelegate, tokenDelegate, emailService } =
      createService();

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
      verificationToken: expect.any(String) as string,
    });
    expect('passwordHash' in response).toBe(false);
    expect(userDelegate.createdArgs?.data.email).toBe('customer@example.com');
    expect(userDelegate.createdArgs?.data.emailVerifiedAt).toBeNull();
    expect(userDelegate.createdArgs?.data.passwordHash).not.toBe(
      'long-enough-password',
    );
    expect(userDelegate.createdArgs?.data.passwordHash).toMatch(/^scrypt\$/);
    expect(tokenDelegate.records).toHaveLength(1);
    expect(tokenDelegate.records[0]?.tokenHash).not.toBe(
      response.verificationToken,
    );
    expect(tokenDelegate.records[0]?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(emailService.sentEmails).toHaveLength(1);
    expect(emailService.sentEmails[0]?.to).toBe('customer@example.com');
    expect(emailService.sentEmails[0]?.subject).toBe(
      'Verify your Tenrio email address',
    );
    expect(emailService.sentEmails[0]?.html).toContain(
      `token=${response.verificationToken}`,
    );
    expect(emailService.sentEmails[0]?.text).toContain(
      `token=${response.verificationToken}`,
    );
    expect(emailService.sentEmails[0]?.html).not.toContain(
      tokenDelegate.records[0]?.tokenHash ?? '',
    );
  });

  it('rejects duplicate email', async () => {
    const { service } = createService();

    await service.register({
      email: 'customer@example.com',
      password: 'long-enough-password',
    });

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

  it('verifies a valid email token once', async () => {
    const { service, userDelegate, tokenDelegate } = createService();
    const registerResponse = await service.register({
      email: 'customer@example.com',
      password: 'long-enough-password',
    });

    const response = await service.verifyEmail({
      token: registerResponse.verificationToken ?? '',
    });

    expect(response.email).toBe('customer@example.com');
    expect(response.emailVerifiedAt).toBeInstanceOf(Date);
    expect('passwordHash' in response).toBe(false);
    expect(userDelegate.records[0]?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(tokenDelegate.records[0]?.usedAt).toBeInstanceOf(Date);
  });

  it('rejects invalid tokens safely', async () => {
    const { service } = createService();

    await expect(
      service.verifyEmail({
        token: 'invalid-token',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects expired tokens', async () => {
    const { service, userDelegate, tokenDelegate } = createService();
    const user = await userDelegate.create({
      data: {
        email: 'expired@example.com',
        passwordHash: 'scrypt$hash',
        emailVerifiedAt: null,
      },
    });
    const rawToken = 'expired-token';

    await tokenDelegate.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });

    await expect(
      service.verifyEmail({
        token: rawToken,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects reused tokens', async () => {
    const { service } = createService();
    const registerResponse = await service.register({
      email: 'customer@example.com',
      password: 'long-enough-password',
    });
    const token = registerResponse.verificationToken ?? '';

    await service.verifyEmail({ token });

    await expect(service.verifyEmail({ token })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('handles email sending failures without creating duplicate users or tokens', async () => {
    const { service, userDelegate, tokenDelegate, emailService } =
      createService();

    emailService.shouldFail = true;

    await expect(
      service.register({
        email: 'customer@example.com',
        password: 'long-enough-password',
      }),
    ).rejects.toThrow('Registration succeeded');

    await expect(
      service.register({
        email: 'customer@example.com',
        password: 'long-enough-password',
      }),
    ).rejects.toThrow(ConflictException);

    expect(userDelegate.records).toHaveLength(1);
    expect(tokenDelegate.records).toHaveLength(1);
  });

  it('logs in a verified user and stores only the session token hash', async () => {
    const { service, sessionDelegate } = createService();

    await registerAndVerify(service);

    const loginResult = await service.login({
      email: '  CUSTOMER@Example.COM ',
      password: 'long-enough-password',
    });

    expect(loginResult.user.email).toBe('customer@example.com');
    expect('passwordHash' in loginResult.user).toBe(false);
    expect(loginResult.sessionToken).toEqual(expect.any(String));
    expect(sessionDelegate.records).toHaveLength(1);
    expect(sessionDelegate.records[0]?.tokenHash).not.toBe(
      loginResult.sessionToken,
    );
    expect(sessionDelegate.records[0]?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects invalid login credentials safely', async () => {
    const { service, sessionDelegate } = createService();

    await registerAndVerify(service);

    await expect(
      service.login({
        email: 'customer@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessionDelegate.records).toHaveLength(0);
  });

  it('rejects unverified user login without creating a session', async () => {
    const { service, sessionDelegate } = createService();

    await service.register({
      email: 'customer@example.com',
      password: 'long-enough-password',
    });

    await expect(
      service.login({
        email: 'customer@example.com',
        password: 'long-enough-password',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(sessionDelegate.records).toHaveLength(0);
  });

  it('returns the current user for a valid session', async () => {
    const { service } = createService();

    await registerAndVerify(service);
    const loginResult = await service.login({
      email: 'customer@example.com',
      password: 'long-enough-password',
    });

    const response = await service.getCurrentUser(loginResult.sessionToken);

    expect(response.email).toBe('customer@example.com');
    expect(response.emailVerifiedAt).toBeInstanceOf(Date);
    expect('passwordHash' in response).toBe(false);
  });

  it('rejects invalid sessions', async () => {
    const { service } = createService();

    await expect(service.getCurrentUser('invalid-session-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects expired sessions', async () => {
    const { service, sessionDelegate } = createService();

    await registerAndVerify(service);
    const loginResult = await service.login({
      email: 'customer@example.com',
      password: 'long-enough-password',
    });
    const session = sessionDelegate.records[0];

    if (!session) {
      throw new Error('Expected test session to exist.');
    }

    session.expiresAt = new Date('2025-01-01T00:00:00.000Z');

    await expect(
      service.getCurrentUser(loginResult.sessionToken),
    ).rejects.toThrow(UnauthorizedException);
  });
});
