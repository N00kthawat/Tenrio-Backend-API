import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationsService } from '../src/organizations/organizations.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

type OrganizationRecord = {
  id: string;
  name: string;
  legalName: string | null;
  juristicRegistrationNumber: string | null;
  taxId: string | null;
  branchType: string | null;
  branchNumber: string | null;
  billingEmail: string | null;
  phoneNumber: string | null;
  addressLine: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OrganizationMemberRecord = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
};

class OrganizationDelegateMock {
  private nextId = 1;
  readonly records: OrganizationRecord[] = [];

  create(args: { data: { name: string } }): Promise<OrganizationRecord> {
    const org: OrganizationRecord = {
      id: `org_${this.nextId++}`,
      name: args.data.name,
      legalName: null,
      juristicRegistrationNumber: null,
      taxId: null,
      branchType: null,
      branchNumber: null,
      billingEmail: null,
      phoneNumber: null,
      addressLine: null,
      subdistrict: null,
      district: null,
      province: null,
      postalCode: null,
      country: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.records.push(org);
    return Promise.resolve(org);
  }

  update(args: { where: { id: string }; data: Partial<OrganizationRecord> }): Promise<OrganizationRecord> {
    const org = this.records.find(r => r.id === args.where.id);
    if (!org) throw new Error('Not found');
    Object.assign(org, args.data);
    org.updatedAt = new Date();
    return Promise.resolve({ ...org });
  }
}

class OrganizationMemberDelegateMock {
  private nextId = 1;
  readonly records: OrganizationMemberRecord[] = [];

  constructor(private readonly orgDelegate: OrganizationDelegateMock) {}

  count(args: { where: { userId: string } }): Promise<number> {
    return Promise.resolve(this.records.filter(r => r.userId === args.where.userId).length);
  }

  create(args: { data: { organizationId: string; userId: string; role: string } }): Promise<OrganizationMemberRecord> {
    const existing = this.records.find(r => r.organizationId === args.data.organizationId && r.userId === args.data.userId);
    if (existing) {
      return Promise.reject(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'mock' }));
    }
    const member: OrganizationMemberRecord = {
      id: `member_${this.nextId++}`,
      organizationId: args.data.organizationId,
      userId: args.data.userId,
      role: args.data.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.records.push(member);
    return Promise.resolve(member);
  }

  findMany(args: { where: { userId: string }; include?: { organization: boolean } }): Promise<Array<OrganizationMemberRecord & { organization?: OrganizationRecord }>> {
    const members = this.records.filter(r => r.userId === args.where.userId);
    if (args.include?.organization) {
      return Promise.resolve(members.map(m => ({
        ...m,
        organization: this.orgDelegate.records.find(o => o.id === m.organizationId)
      })));
    }
    return Promise.resolve(members);
  }

  findUnique(args: { where: { organizationId_userId: { organizationId: string; userId: string } }; include?: { organization: boolean } }): Promise<OrganizationMemberRecord & { organization?: OrganizationRecord } | null> {
    const member = this.records.find(r =>
      r.organizationId === args.where.organizationId_userId.organizationId &&
      r.userId === args.where.organizationId_userId.userId
    );
    if (!member) return Promise.resolve(null);
    if (args.include?.organization) {
      return Promise.resolve({
        ...member,
        organization: this.orgDelegate.records.find(o => o.id === member.organizationId)
      });
    }
    return Promise.resolve(member);
  }
}

describe('OrganizationsService', () => {
  const createService = () => {
    const orgDelegate = new OrganizationDelegateMock();
    const memberDelegate = new OrganizationMemberDelegateMock(orgDelegate);

    const tx = {
      organization: orgDelegate,
      organizationMember: memberDelegate,
    };

    const prisma = {
      organization: orgDelegate,
      organizationMember: memberDelegate,
      $transaction: async <T>(cb: (transaction: typeof tx) => Promise<T>) => {
        const orgCount = orgDelegate.records.length;
        const memberCount = memberDelegate.records.length;
        try {
          return await cb(tx);
        } catch (error) {
          orgDelegate.records.length = orgCount;
          memberDelegate.records.length = memberCount;
          throw error;
        }
      },
    } as unknown as PrismaService;

    return {
      service: new OrganizationsService(prisma),
      orgDelegate,
      memberDelegate,
    };
  };

  it('allows authenticated user with 0 memberships to create Organization', async () => {
    const { service, orgDelegate, memberDelegate } = createService();
    const org = await service.create('user_1', { name: 'Acme Corp' });

    expect(org.name).toBe('Acme Corp');
    expect(orgDelegate.records).toHaveLength(1);
    expect(memberDelegate.records).toHaveLength(1);
    expect(memberDelegate.records[0].userId).toBe('user_1');
    expect(memberDelegate.records[0].role).toBe('OWNER');
    expect(memberDelegate.records[0].organizationId).toBe(org.id);
  });

  it('prevents user with >= 1 membership from creating another Organization', async () => {
    const { service } = createService();
    await service.create('user_1', { name: 'Acme Corp' });

    await expect(service.create('user_1', { name: 'Another Corp' })).rejects.toThrow(ConflictException);
  });

  it('Organization + OWNER membership creation is atomic (rolls back if member creation fails)', async () => {
    const { service, orgDelegate, memberDelegate } = createService();
    // Force member creation to fail
    jest.spyOn(memberDelegate, 'create').mockRejectedValueOnce(new Error('Simulated failure'));

    await expect(service.create('user_1', { name: 'Acme Corp' })).rejects.toThrow('Simulated failure');

    expect(orgDelegate.records).toHaveLength(0); // Rolled back
  });

  it('duplicate [organizationId, userId] membership is prevented', async () => {
    const { orgDelegate, memberDelegate } = createService();
    const org = await orgDelegate.create({ data: { name: 'Acme Corp' } });
    await memberDelegate.create({ data: { organizationId: org.id, userId: 'user_1', role: 'OWNER' } });

    await expect(memberDelegate.create({ data: { organizationId: org.id, userId: 'user_1', role: 'MEMBER' } })).rejects.toThrow();
  });

  it('list returns only authorized Organizations', async () => {
    const { service, memberDelegate, orgDelegate } = createService();
    await service.create('user_1', { name: 'Acme Corp' });

    // Manually add another org for a different user
    const org2 = await orgDelegate.create({ data: { name: 'Other Corp' } });
    await memberDelegate.create({ data: { organizationId: org2.id, userId: 'user_2', role: 'OWNER' } });

    const orgs = await service.findAll('user_1');
    expect(orgs).toHaveLength(1);
    expect(orgs[0].name).toBe('Acme Corp');
  });

  it('member may GET their Organization', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });

    const fetched = await service.findOne('user_1', created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe('Acme Corp');
  });

  it('unrelated user cannot GET another Organization', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });
    
    await expect(service.findOne('user_2', created.id)).rejects.toThrow(NotFoundException);
  });

  it('omitted legalName preserves existing value', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });
    await service.update('user_1', created.id, { legalName: 'Old Name' });

    const updated = await service.update('user_1', created.id, { name: 'Acme Corp 2' }); // omitted legalName
    expect(updated.legalName).toBe('Old Name');
  });

  it('legalName null clears existing value', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });
    await service.update('user_1', created.id, { legalName: 'Old Name' });

    const updated = await service.update('user_1', created.id, { legalName: null });
    expect(updated.legalName).toBeNull();
  });

  it('legalName valid string replaces value', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });

    const updated = await service.update('user_1', created.id, { legalName: 'New Name' });
    expect(updated.legalName).toBe('New Name');
  });

  it('branchType omitted preserves existing value', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });
    await service.update('user_1', created.id, { branchType: 'HEAD_OFFICE' });

    const updated = await service.update('user_1', created.id, { name: 'Acme Corp 2' }); // omitted branchType
    expect(updated.branchType).toBe('HEAD_OFFICE');
  });

  it('branchType null clears existing value', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });
    await service.update('user_1', created.id, { branchType: 'HEAD_OFFICE' });

    const updated = await service.update('user_1', created.id, { branchType: null });
    expect(updated.branchType).toBeNull();
  });

  it('HEAD_OFFICE updates correctly', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });

    const updated = await service.update('user_1', created.id, { branchType: 'HEAD_OFFICE' });
    expect(updated.branchType).toBe('HEAD_OFFICE');
  });

  it('BRANCH updates correctly', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });

    const updated = await service.update('user_1', created.id, { branchType: 'BRANCH' });
    expect(updated.branchType).toBe('BRANCH');
  });

  it('invalid branchType is rejected', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });

    await expect(service.update('user_1', created.id, { branchType: 'OTHER' as unknown as 'HEAD_OFFICE' })).rejects.toThrow();
  });

  it('branchNumber null clears existing value', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });
    await service.update('user_1', created.id, { branchNumber: '00001' });

    const updated = await service.update('user_1', created.id, { branchNumber: null });
    expect(updated.branchNumber).toBeNull();
  });

  it('billingEmail null clears existing value', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });
    await service.update('user_1', created.id, { billingEmail: 'test@example.com' });

    const updated = await service.update('user_1', created.id, { billingEmail: null });
    expect(updated.billingEmail).toBeNull();
  });

  it('invalid billingEmail is rejected', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });

    await expect(service.update('user_1', created.id, { billingEmail: 'invalid-email' })).rejects.toThrow();
  });

  it('country null clears existing value', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });
    await service.update('user_1', created.id, { country: 'Thailand' });

    const updated = await service.update('user_1', created.id, { country: null });
    expect(updated.country).toBeNull();
  });

  it('name omitted preserves existing name', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });

    const updated = await service.update('user_1', created.id, { legalName: 'Acme Corp Ltd.' }); // omitted name
    expect(updated.name).toBe('Acme Corp');
  });

  it('name null is rejected', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });

    await expect(service.update('user_1', created.id, { name: null as unknown as string })).rejects.toThrow();
  });

  it('blank name is rejected', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });

    await expect(service.update('user_1', created.id, { name: '' })).rejects.toThrow();
  });

  it('whitespace-only name is rejected', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });

    await expect(service.update('user_1', created.id, { name: '   ' })).rejects.toThrow();
  });

  it('OWNER may PATCH Organization juristicRegistrationNumber', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });

    const updated = await service.update('user_1', created.id, { juristicRegistrationNumber: '0105562000000' });
    expect(updated.juristicRegistrationNumber).toBe('0105562000000');
  });

  it('unrelated user cannot PATCH Organization', async () => {
    const { service } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });
    
    await expect(service.update('user_2', created.id, { legalName: 'Hacked' })).rejects.toThrow(NotFoundException);
  });

  it('MEMBER (non-OWNER) cannot PATCH Organization', async () => {
    const { service, memberDelegate } = createService();
    const created = await service.create('user_1', { name: 'Acme Corp' });
    
    await memberDelegate.create({ data: { organizationId: created.id, userId: 'user_2', role: 'MEMBER' } });
    
    await expect(service.update('user_2', created.id, { legalName: 'Hacked' })).rejects.toThrow(ForbiddenException);
  });
});
