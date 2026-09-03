import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { Microsoft365PlanResponseDto } from './dto/microsoft-365-plan-response.dto';

@ApiTags('catalog')
@Controller('catalog/microsoft-365')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('plans')
  @ApiOperation({
    summary: 'List active Microsoft 365 plans',
    description: 'Public endpoint returning active Microsoft 365 MVP plans. No authentication required. Pricing is not included in this endpoint.',
  })
  @ApiOkResponse({ type: [Microsoft365PlanResponseDto] })
  async findMicrosoft365Plans(): Promise<Microsoft365PlanResponseDto[]> {
    return this.catalogService.findMicrosoft365Plans();
  }
}
