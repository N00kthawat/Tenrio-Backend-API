import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'token-string' })
  token!: string;

  @ApiProperty({ example: 'new-secure-password' })
  newPassword!: string;
}
