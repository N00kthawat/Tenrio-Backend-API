import { Body, Controller, Post } from '@nestjs/common';
import { ApiConflictResponse, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({
    description: 'Customer account registered successfully.',
    type: AuthUserResponseDto,
  })
  @ApiConflictResponse({
    description: 'Email is already registered.',
  })
  register(@Body() registerDto: RegisterDto): Promise<AuthUserResponseDto> {
    return this.authService.register(registerDto);
  }
}
