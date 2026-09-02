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

type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
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
    emailVerifiedAt?: Date;
    passwordHash?: string;
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

type PasswordResetTokenWithUser = PasswordResetTokenRecord & {
  user: UserRecord;
};

type TransactionMock = {
  user: UserDelegateMock;
  emailVerificationToken: EmailVerificationTokenDelegateMock;
  session: SessionDelegateMock;
  passwordResetToken: PasswordResetTokenDelegateMock;
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

    if (args.data.emailVerifiedAt !== undefined) {
      user.emailVerifiedAt = args.data.emailVerifiedAt;
      user.updatedAt = args.data.emailVerifiedAt;
    }

    if (args.data.passwordHash !== undefined) {
      user.passwordHash = args.data.passwordHash;
      user.updatedAt = new Date();
    }

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

  update(args: { where: { id: string }; data: { revokedAt: Date } }): Promise<SessionRecord> {
    const session = this.records.find((record) => record.id === args.where.id);

    if (!session) {
      throw new Error('Test session not found.');
    }

    session.revokedAt = args.data.revokedAt;

    return Promise.resolve(session);
  }

  updateMany(args: { where: { userId: string; revokedAt: null }; data: { revokedAt: Date } }): Promise<{ count: number }> {
    const sessions = this.records.filter((record) => record.userId === args.where.userId && record.revokedAt === null);

    sessions.forEach(session => session.revokedAt = args.data.revokedAt);

    return Promise.resolve({ count: sessions.length });
  }
}

class PasswordResetTokenDelegateMock {
  private nextId = 1;
  readonly records: PasswordResetTokenRecord[] = [];

  constructor(private readonly userDelegate: UserDelegateMock) {}

  create(args: CreateTokenArgs): Promise<PasswordResetTokenRecord> {
    const token: PasswordResetTokenRecord = {
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

  async findUnique(args: FindUniqueTokenArgs): Promise<PasswordResetTokenWithUser | null> {
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
    passwordResetTokenDelegate: PasswordResetTokenDelegateMock;
    emailService: EmailServiceMock;
  } => {
    const userDelegate = new UserDelegateMock();
    const tokenDelegate = new EmailVerificationTokenDelegateMock(userDelegate);
    const sessionDelegate = new SessionDelegateMock(userDelegate);
    const passwordResetTokenDelegate = new PasswordResetTokenDelegateMock(userDelegate);
    const emailService = new EmailServiceMock();
    const tx: TransactionMock = {
      user: userDelegate,
      emailVerificationToken: tokenDelegate,
      session: sessionDelegate,
      passwordResetToken: passwordResetTokenDelegate,
    };
    const prisma = {
      user: userDelegate,
      emailVerificationToken: tokenDelegate,
      session: sessionDelegate,
      passwordResetToken: passwordResetTokenDelegate,
      $transaction: <T>(
        callback: (transaction: TransactionMock) => Promise<T>,
      ) => callback(tx),
    } as unknown as PrismaService;

    return {
      service: new AuthService(prisma, emailService as unknown as EmailService),
      userDelegate,
      tokenDelegate,
      sessionDelegate,
      passwordResetTokenDelegate,
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

  it('revokes a valid session on logout', async () => {
    const { service, sessionDelegate } = createService();

    await registerAndVerify(service);
    const loginResult = await service.login({
      email: 'customer@example.com',
      password: 'long-enough-password',
    });

    await service.logout(loginResult.sessionToken);

    const session = sessionDelegate.records[0];
    expect(session?.revokedAt).toBeInstanceOf(Date);

    await expect(
      service.getCurrentUser(loginResult.sessionToken),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('handles logout with an invalid token safely', async () => {
    const { service } = createService();
    await expect(service.logout('invalid-session-token')).resolves.not.toThrow();
  });

  it('handles calling logout more than once safely', async () => {
    const { service } = createService();

    await registerAndVerify(service);
    const loginResult = await service.login({
      email: 'customer@example.com',
      password: 'long-enough-password',
    });

    await service.logout(loginResult.sessionToken);
    await expect(service.logout(loginResult.sessionToken)).resolves.not.toThrow();
  });

  describe('forgot-password and reset-password', () => {
    it('does not reveal account existence for non-existing emails', async () => {
      const { service, emailService, passwordResetTokenDelegate } = createService();
      
      await expect(service.forgotPassword({ email: 'non-existing@example.com' })).resolves.not.toThrow();
      expect(emailService.sentEmails).toHaveLength(0);
      expect(passwordResetTokenDelegate.records).toHaveLength(0);
    });

    it('creates a reset token and sends an email for existing users without storing the raw token', async () => {
      const { service, emailService, passwordResetTokenDelegate } = createService();
      await registerAndVerify(service);
      emailService.sentEmails.length = 0; // clear welcome email

      await service.forgotPassword({ email: 'customer@example.com' });

      expect(emailService.sentEmails).toHaveLength(1);
      const emailContent = emailService.sentEmails[0]?.html ?? '';
      expect(emailContent).toContain('reset-password?token=');
      
      // Extract raw token
      const rawTokenMatch = emailContent.match(/token=([a-zA-Z0-9_-]+)/);
      const rawToken = rawTokenMatch?.[1];
      expect(rawToken).toBeDefined();

      expect(passwordResetTokenDelegate.records).toHaveLength(1);
      const record = passwordResetTokenDelegate.records[0];
      
      // Check that the raw token is not stored, only hash
      expect(record?.tokenHash).not.toBe(rawToken);
      expect(record?.tokenHash).toEqual(hashToken(rawToken!));
    });

    it('resets the password and revokes all active sessions', async () => {
      const { service, emailService } = createService();
      await registerAndVerify(service);
      
      const login1 = await service.login({ email: 'customer@example.com', password: 'long-enough-password' });
      const login2 = await service.login({ email: 'customer@example.com', password: 'long-enough-password' });
      
      emailService.sentEmails.length = 0;
      await service.forgotPassword({ email: 'customer@example.com' });
      const rawToken = emailService.sentEmails[0]?.html?.match(/token=([a-zA-Z0-9_-]+)/)?.[1];

      await expect(service.resetPassword({ token: rawToken!, newPassword: 'new-secure-password' })).resolves.not.toThrow();
      
      // Old password should fail
      await expect(service.login({ email: 'customer@example.com', password: 'long-enough-password' })).rejects.toThrow(UnauthorizedException);
      
      // New password should work
      await expect(service.login({ email: 'customer@example.com', password: 'new-secure-password' })).resolves.toBeDefined();
      
      // Old sessions should be revoked
      await expect(service.getCurrentUser(login1.sessionToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.getCurrentUser(login2.sessionToken)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects short passwords', async () => {
      const { service, emailService } = createService();
      await registerAndVerify(service);
      emailService.sentEmails.length = 0;
      await service.forgotPassword({ email: 'customer@example.com' });
      const rawToken = emailService.sentEmails[0]?.html?.match(/token=([a-zA-Z0-9_-]+)/)?.[1];

      await expect(service.resetPassword({ token: rawToken!, newPassword: 'short' })).rejects.toThrow(BadRequestException);
    });

    it('rejects expired tokens', async () => {
      const { service, emailService, passwordResetTokenDelegate } = createService();
      await registerAndVerify(service);
      emailService.sentEmails.length = 0;
      await service.forgotPassword({ email: 'customer@example.com' });
      const rawToken = emailService.sentEmails[0]?.html?.match(/token=([a-zA-Z0-9_-]+)/)?.[1];

      const record = passwordResetTokenDelegate.records[0];
      record.expiresAt = new Date('2020-01-01T00:00:00.000Z');

      await expect(service.resetPassword({ token: rawToken!, newPassword: 'new-secure-password' })).rejects.toThrow(BadRequestException);
    });

    it('rejects reused tokens', async () => {
      const { service, emailService } = createService();
      await registerAndVerify(service);
      emailService.sentEmails.length = 0;
      await service.forgotPassword({ email: 'customer@example.com' });
      const rawToken = emailService.sentEmails[0]?.html?.match(/token=([a-zA-Z0-9_-]+)/)?.[1];

      await service.resetPassword({ token: rawToken!, newPassword: 'new-secure-password' });
      await expect(service.resetPassword({ token: rawToken!, newPassword: 'another-secure-password' })).rejects.toThrow(BadRequestException);
    });
  });
});
