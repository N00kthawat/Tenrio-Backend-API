import { ApiPropertyOptional } from '@nestjs/swagger';

export type BranchType = 'HEAD_OFFICE' | 'BRANCH';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ description: 'The display name of the organization' })
  name?: string;

  @ApiPropertyOptional({ description: 'The legal registered name of the organization', nullable: true })
  legalName?: string | null;

  @ApiPropertyOptional({ description: 'The juristic registration number', nullable: true })
  juristicRegistrationNumber?: string | null;

  @ApiPropertyOptional({ description: 'The tax identification number', nullable: true })
  taxId?: string | null;

  @ApiPropertyOptional({ description: 'The branch type (e.g., HEAD_OFFICE, BRANCH)', nullable: true })
  branchType?: BranchType | null;

  @ApiPropertyOptional({ description: 'The branch number', nullable: true })
  branchNumber?: string | null;

  @ApiPropertyOptional({ description: 'The billing email address', nullable: true })
  billingEmail?: string | null;

  @ApiPropertyOptional({ description: 'The contact phone number', nullable: true })
  phoneNumber?: string | null;

  @ApiPropertyOptional({ description: 'The street address', nullable: true })
  addressLine?: string | null;

  @ApiPropertyOptional({ description: 'The subdistrict (Tambon)', nullable: true })
  subdistrict?: string | null;

  @ApiPropertyOptional({ description: 'The district (Amphoe)', nullable: true })
  district?: string | null;

  @ApiPropertyOptional({ description: 'The province', nullable: true })
  province?: string | null;

  @ApiPropertyOptional({ description: 'The postal code', nullable: true })
  postalCode?: string | null;

  @ApiPropertyOptional({ description: 'The country', nullable: true })
  country?: string | null;
}
