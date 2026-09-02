import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'customer@example.com',
  })
  email!: string;

  @ApiProperty({
    minLength: 12,
    example: 'correct horse battery staple',
  })
  password!: string;
}
