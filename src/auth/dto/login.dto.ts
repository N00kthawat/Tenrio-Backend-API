import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'customer@example.com',
  })
  email!: string;

  @ApiProperty()
  password!: string;
}
