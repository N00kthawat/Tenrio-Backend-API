import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Microsoft365PlanResponseDto } from './dto/microsoft-365-plan-response.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async findMicrosoft365Plans(): Promise<Microsoft365PlanResponseDto[]> {
    const plans = await this.prisma.microsoft365Plan.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { code: 'asc' },
      ],
    });

    return plans.map(plan => ({
      id: plan.id,
      code: plan.code,
      slug: plan.slug,
      name: plan.name,
      featureKeys: plan.featureKeys,
      sortOrder: plan.sortOrder,
    }));
  }
}
