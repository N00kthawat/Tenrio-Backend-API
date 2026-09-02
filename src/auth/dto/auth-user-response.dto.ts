import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    example: 'customer@example.com',
  })
  email!: string;

  @ApiProperty({
    nullable: true,
    type: String,
  })
  emailVerifiedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
