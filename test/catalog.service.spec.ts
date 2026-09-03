import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from '../src/catalog/catalog.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MICROSOFT_365_FEATURE_KEYS } from '../src/catalog/constants/microsoft-365.constants';

describe('CatalogService', () => {
  let service: CatalogService;
  let findManyMock: jest.Mock;

  beforeEach(async () => {
    findManyMock = jest.fn().mockResolvedValue([
      {
        id: 'plan_1',
        code: 'BUSINESS_BASIC',
        slug: 'microsoft-365-business-basic',
        name: 'Microsoft 365 Business Basic',
        featureKeys: [
          MICROSOFT_365_FEATURE_KEYS.WEB_MOBILE_OFFICE,
          MICROSOFT_365_FEATURE_KEYS.BUSINESS_EMAIL,
          MICROSOFT_365_FEATURE_KEYS.ONEDRIVE_1TB,
          MICROSOFT_365_FEATURE_KEYS.TEAMS,
        ],
        isActive: true,
        sortOrder: 1,
        providerProductId: 'prod_1',
        providerSkuId: 'sku_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'plan_2',
        code: 'BUSINESS_STANDARD',
        slug: 'microsoft-365-business-standard',
        name: 'Microsoft 365 Business Standard',
        featureKeys: [
          MICROSOFT_365_FEATURE_KEYS.WEB_MOBILE_OFFICE,
          MICROSOFT_365_FEATURE_KEYS.DESKTOP_OFFICE,
          MICROSOFT_365_FEATURE_KEYS.BUSINESS_EMAIL,
          MICROSOFT_365_FEATURE_KEYS.ONEDRIVE_1TB,
          MICROSOFT_365_FEATURE_KEYS.TEAMS,
        ],
        isActive: true,
        sortOrder: 2,
        providerProductId: 'prod_2',
        providerSkuId: 'sku_2',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: PrismaService,
          useValue: {
            microsoft365Plan: {
              findMany: findManyMock,
            },
          },
        },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  it('should query only isActive = true and order deterministically', async () => {
    await service.findMicrosoft365Plans();
    expect(findManyMock).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  });

  it('public mapping contains exactly expected fields and excludes internal fields', async () => {
    const plans = await service.findMicrosoft365Plans();
    
    expect(plans).toHaveLength(2);
    
    // BASIC
    expect(plans[0].id).toBe('plan_1');
    expect(plans[0].code).toBe('BUSINESS_BASIC');
    expect(plans[0].slug).toBe('microsoft-365-business-basic');
    expect(plans[0].name).toBe('Microsoft 365 Business Basic');
    expect(plans[0].sortOrder).toBe(1);
    expect(plans[0].featureKeys).toEqual([
      MICROSOFT_365_FEATURE_KEYS.WEB_MOBILE_OFFICE,
      MICROSOFT_365_FEATURE_KEYS.BUSINESS_EMAIL,
      MICROSOFT_365_FEATURE_KEYS.ONEDRIVE_1TB,
      MICROSOFT_365_FEATURE_KEYS.TEAMS,
    ]);
    expect(plans[0].featureKeys).not.toContain(MICROSOFT_365_FEATURE_KEYS.DESKTOP_OFFICE);

    // STANDARD
    expect(plans[1].id).toBe('plan_2');
    expect(plans[1].code).toBe('BUSINESS_STANDARD');
    expect(plans[1].slug).toBe('microsoft-365-business-standard');
    expect(plans[1].name).toBe('Microsoft 365 Business Standard');
    expect(plans[1].sortOrder).toBe(2);
    expect(plans[1].featureKeys).toEqual([
      MICROSOFT_365_FEATURE_KEYS.WEB_MOBILE_OFFICE,
      MICROSOFT_365_FEATURE_KEYS.DESKTOP_OFFICE,
      MICROSOFT_365_FEATURE_KEYS.BUSINESS_EMAIL,
      MICROSOFT_365_FEATURE_KEYS.ONEDRIVE_1TB,
      MICROSOFT_365_FEATURE_KEYS.TEAMS,
    ]);

    // Ensure internal fields are omitted from public mapping
    const rawBasic = plans[0] as unknown as Record<string, unknown>;
    expect(rawBasic.isActive).toBeUndefined();
    expect(rawBasic.providerProductId).toBeUndefined();
    expect(rawBasic.providerSkuId).toBeUndefined();
    expect(rawBasic.createdAt).toBeUndefined();
    expect(rawBasic.updatedAt).toBeUndefined();
  });
});
