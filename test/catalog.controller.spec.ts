import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from '../src/catalog/catalog.controller';
import { CatalogService } from '../src/catalog/catalog.service';

describe('CatalogController', () => {
  let controller: CatalogController;
  let serviceMock: { findMicrosoft365Plans: jest.Mock };

  beforeEach(async () => {
    serviceMock = {
      findMicrosoft365Plans: jest.fn().mockResolvedValue([
        {
          id: 'plan_1',
          code: 'BUSINESS_BASIC',
          slug: 'microsoft-365-business-basic',
          name: 'Microsoft 365 Business Basic',
          featureKeys: [],
          sortOrder: 1,
        }
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
  });

  it('can execute without session/auth input', async () => {
    // Calling directly without request object (no AuthGuard)
    const result = await controller.findMicrosoft365Plans();
    
    expect(result).toHaveLength(1);
    expect(serviceMock.findMicrosoft365Plans).toHaveBeenCalled();
  });
});
