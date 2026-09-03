import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, Organization } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    createOrganizationDto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    try {
      const organization = await this.prisma.$transaction(
        async (tx) => {
          const existingMemberships = await tx.organizationMember.count({
            where: { userId },
          });

          if (existingMemberships > 0) {
            throw new ConflictException(
              'User already belongs to an organization.',
            );
          }

          const org = await tx.organization.create({
            data: {
              name: createOrganizationDto.name,
            },
          });

          await tx.organizationMember.create({
            data: {
              organizationId: org.id,
              userId,
              role: 'OWNER',
            },
          });

          return org;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return this.toResponseDto(organization);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        throw new ConflictException(
          'User already belongs to an organization.',
        );
      }
      throw error;
    }
  }

  async findAll(userId: string): Promise<OrganizationResponseDto[]> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
    });

    return memberships.map((m) => this.toResponseDto(m.organization));
  }

  async findOne(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationResponseDto> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      include: { organization: true },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found.');
    }

    return this.toResponseDto(membership.organization);
  }

  async update(
    userId: string,
    organizationId: string,
    updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found.');
    }

    if (membership.role !== 'OWNER') {
      throw new ForbiddenException(
        'Only owners can update organization profile.',
      );
    }

    if (updateOrganizationDto.name !== undefined) {
      if (updateOrganizationDto.name === null) {
        throw new BadRequestException('name cannot be null.');
      }
      if (typeof updateOrganizationDto.name !== 'string' || updateOrganizationDto.name.trim() === '') {
        throw new BadRequestException('name must be a non-empty string.');
      }
    }

    if (updateOrganizationDto.branchType !== undefined) {
      if (
        updateOrganizationDto.branchType !== null &&
        updateOrganizationDto.branchType !== 'HEAD_OFFICE' &&
        updateOrganizationDto.branchType !== 'BRANCH'
      ) {
        throw new BadRequestException('branchType must be HEAD_OFFICE, BRANCH, or null.');
      }
    }

    if (updateOrganizationDto.billingEmail !== undefined) {
      if (updateOrganizationDto.billingEmail !== null) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (
          typeof updateOrganizationDto.billingEmail !== 'string' ||
          !emailRegex.test(updateOrganizationDto.billingEmail)
        ) {
          throw new BadRequestException('billingEmail must be a valid email or null.');
        }
      }
    }

    const optionalFields = [
      'legalName',
      'juristicRegistrationNumber',
      'taxId',
      'branchNumber',
      'phoneNumber',
      'addressLine',
      'subdistrict',
      'district',
      'province',
      'postalCode',
      'country',
    ] as const;

    for (const field of optionalFields) {
      const val = updateOrganizationDto[field];
      if (val !== undefined && val !== null) {
        if (typeof val !== 'string' || val.trim() === '') {
          throw new BadRequestException(`${field} must be a non-empty string or null.`);
        }
      }
    }

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: updateOrganizationDto,
    });

    return this.toResponseDto(updated);
  }

  private toResponseDto(organization: Organization): OrganizationResponseDto {
    return {
      id: organization.id,
      name: organization.name,
      legalName: organization.legalName,
      juristicRegistrationNumber: organization.juristicRegistrationNumber,
      taxId: organization.taxId,
      branchType: organization.branchType,
      branchNumber: organization.branchNumber,
      billingEmail: organization.billingEmail,
      phoneNumber: organization.phoneNumber,
      addressLine: organization.addressLine,
      subdistrict: organization.subdistrict,
      district: organization.district,
      province: organization.province,
      postalCode: organization.postalCode,
      country: organization.country,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }
}
