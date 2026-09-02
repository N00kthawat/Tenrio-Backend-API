import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({
    description: 'Customer account registered successfully.',
    type: RegisterResponseDto,
  })
  @ApiConflictResponse({
    description: 'Email is already registered.',
  })
  register(@Body() registerDto: RegisterDto): Promise<RegisterResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Email verified successfully.',
    type: AuthUserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Verification token is invalid, expired, or already used.',
  })
  verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<AuthUserResponseDto> {
    return this.authService.verifyEmail(verifyEmailDto);
  }
}
