import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ description: 'The display name of the organization' })
  name?: string;

  @ApiPropertyOptional({ description: 'The legal registered name of the organization' })
  legalName?: string;

  @ApiPropertyOptional({ description: 'The juristic registration number' })
  juristicRegistrationNumber?: string;

  @ApiPropertyOptional({ description: 'The tax identification number' })
  taxId?: string;

  @ApiPropertyOptional({ description: 'The branch type (e.g., HEAD_OFFICE, BRANCH)' })
  branchType?: string;

  @ApiPropertyOptional({ description: 'The branch number' })
  branchNumber?: string;

  @ApiPropertyOptional({ description: 'The billing email address' })
  billingEmail?: string;

  @ApiPropertyOptional({ description: 'The contact phone number' })
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'The street address' })
  addressLine?: string;

  @ApiPropertyOptional({ description: 'The subdistrict (Tambon)' })
  subdistrict?: string;

  @ApiPropertyOptional({ description: 'The district (Amphoe)' })
  district?: string;

  @ApiPropertyOptional({ description: 'The province' })
  province?: string;

  @ApiPropertyOptional({ description: 'The postal code' })
  postalCode?: string;

  @ApiPropertyOptional({ description: 'The country' })
  country?: string;
}
