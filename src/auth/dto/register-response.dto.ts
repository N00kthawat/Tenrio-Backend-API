import { ApiPropertyOptional } from '@nestjs/swagger';

import { AuthUserResponseDto } from './auth-user-response.dto';

export class RegisterResponseDto extends AuthUserResponseDto {
  @ApiPropertyOptional({
    description: 'Development-only raw email verification token.',
  })
  verificationToken?: string;
}
