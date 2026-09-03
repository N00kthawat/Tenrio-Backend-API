import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrganizationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  legalName!: string | null;

  @ApiPropertyOptional()
  juristicRegistrationNumber!: string | null;

  @ApiPropertyOptional()
  taxId!: string | null;

  @ApiPropertyOptional()
  branchType!: string | null;

  @ApiPropertyOptional()
  branchNumber!: string | null;

  @ApiPropertyOptional()
  billingEmail!: string | null;

  @ApiPropertyOptional()
  phoneNumber!: string | null;

  @ApiPropertyOptional()
  addressLine!: string | null;

  @ApiPropertyOptional()
  subdistrict!: string | null;

  @ApiPropertyOptional()
  district!: string | null;

  @ApiPropertyOptional()
  province!: string | null;

  @ApiPropertyOptional()
  postalCode!: string | null;

  @ApiPropertyOptional()
  country!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
