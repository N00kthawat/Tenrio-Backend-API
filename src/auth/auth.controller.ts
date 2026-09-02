import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Get, Req, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

const SESSION_COOKIE_NAME = 'tenrio_session';

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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Customer logged in successfully.',
    type: AuthUserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials, unverified email, or invalid session.',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUserResponseDto> {
    const loginResult = await this.authService.login(loginDto);

    response.cookie(SESSION_COOKIE_NAME, loginResult.sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: loginResult.sessionExpiresAt,
    });

    return loginResult.user;
  }

  @Get('me')
  @ApiOkResponse({
    description: 'Current authenticated customer.',
    type: AuthUserResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, expired, or revoked session.',
  })
  me(@Req() request: Request): Promise<AuthUserResponseDto> {
    return this.authService.getCurrentUser(
      this.getCookieValue(request, SESSION_COOKIE_NAME),
    );
  }

  private getCookieValue(request: Request, name: string): string | undefined {
    const cookieHeader = request.headers.cookie;

    if (!cookieHeader) {
      return undefined;
    }

    const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
    const cookie = cookies.find((cookie) => cookie.startsWith(`${name}=`));

    if (!cookie) {
      return undefined;
    }

    return decodeURIComponent(cookie.slice(name.length + 1));
  }
}
