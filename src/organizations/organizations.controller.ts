import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { Request } from 'express';

import { AuthService } from '../auth/auth.service';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationResponseDto } from './dto/organization-response.dto';

const SESSION_COOKIE_NAME = 'tenrio_session';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: OrganizationResponseDto })
  async create(
    @Req() request: Request,
    @Body() createOrganizationDto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const user = await this.authService.getCurrentUser(
      this.getCookieValue(request, SESSION_COOKIE_NAME),
    );
    return this.organizationsService.create(user.id, createOrganizationDto);
  }

  @Get()
  @ApiOkResponse({ type: [OrganizationResponseDto] })
  async findAll(@Req() request: Request): Promise<OrganizationResponseDto[]> {
    const user = await this.authService.getCurrentUser(
      this.getCookieValue(request, SESSION_COOKIE_NAME),
    );
    return this.organizationsService.findAll(user.id);
  }

  @Get(':organizationId')
  @ApiOkResponse({ type: OrganizationResponseDto })
  async findOne(
    @Req() request: Request,
    @Param('organizationId') organizationId: string,
  ): Promise<OrganizationResponseDto> {
    const user = await this.authService.getCurrentUser(
      this.getCookieValue(request, SESSION_COOKIE_NAME),
    );
    return this.organizationsService.findOne(user.id, organizationId);
  }

  @Patch(':organizationId')
  @ApiOkResponse({ type: OrganizationResponseDto })
  async update(
    @Req() request: Request,
    @Param('organizationId') organizationId: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    const user = await this.authService.getCurrentUser(
      this.getCookieValue(request, SESSION_COOKIE_NAME),
    );
    return this.organizationsService.update(
      user.id,
      organizationId,
      updateOrganizationDto,
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
