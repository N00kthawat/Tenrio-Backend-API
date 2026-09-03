import { ApiProperty } from '@nestjs/swagger';

export class CreateOrganizationDto {
  @ApiProperty({
    description: 'The name of the organization',
    example: 'Acme Corp',
  })
  name!: string;
}
