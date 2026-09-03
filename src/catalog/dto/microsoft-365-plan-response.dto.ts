import { ApiProperty } from '@nestjs/swagger';

export class Microsoft365PlanResponseDto {
  @ApiProperty({ description: 'The unique identifier of the plan' })
  id!: string;

  @ApiProperty({ description: 'The unique code for the plan' })
  code!: string;

  @ApiProperty({ description: 'The unique slug for the plan' })
  slug!: string;

  @ApiProperty({ description: 'The display name of the plan' })
  name!: string;

  @ApiProperty({ type: [String], description: 'The ordered list of feature keys for this plan' })
  featureKeys!: string[];

  @ApiProperty({ description: 'The sort order of the plan for display purposes' })
  sortOrder!: number;
}
