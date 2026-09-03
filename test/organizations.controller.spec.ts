import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { OrganizationsController } from '../src/organizations/organizations.controller';
import { OrganizationsService } from '../src/organizations/organizations.service';
import { AuthService } from '../src/auth/auth.service';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let authServiceMock: Partial<AuthService>;
  let organizationsServiceMock: Partial<OrganizationsService>;

  beforeEach(() => {
    authServiceMock = {
      getCurrentUser: jest.fn().mockRejectedValue(new UnauthorizedException()),
    };

    organizationsServiceMock = {};

    controller = new OrganizationsController(
      organizationsServiceMock as OrganizationsService,
      authServiceMock as AuthService,
    );
  });

  const mockRequest = { headers: {} } as Request;

  it('POST /v1/organizations requires authentication', async () => {
    await expect(controller.create(mockRequest, { name: 'Acme' })).rejects.toThrow(UnauthorizedException);
  });

  it('GET /v1/organizations requires authentication', async () => {
    await expect(controller.findAll(mockRequest)).rejects.toThrow(UnauthorizedException);
  });

  it('GET /v1/organizations/:organizationId requires authentication', async () => {
    await expect(controller.findOne(mockRequest, 'org_1')).rejects.toThrow(UnauthorizedException);
  });

  it('PATCH /v1/organizations/:organizationId requires authentication', async () => {
    await expect(controller.update(mockRequest, 'org_1', { name: 'Acme 2' })).rejects.toThrow(UnauthorizedException);
  });
});
