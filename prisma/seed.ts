import { PrismaClient } from '@prisma/client';
import { MICROSOFT_365_FEATURE_KEYS, MICROSOFT_365_PLAN_CODES } from '../src/catalog/constants/microsoft-365.constants';

const prisma = new PrismaClient();

async function main() {
  await prisma.microsoft365Plan.upsert({
    where: { code: MICROSOFT_365_PLAN_CODES.BUSINESS_BASIC },
    update: {
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
    },
    create: {
      code: MICROSOFT_365_PLAN_CODES.BUSINESS_BASIC,
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
      providerProductId: null,
      providerSkuId: null,
    },
  });

  await prisma.microsoft365Plan.upsert({
    where: { code: MICROSOFT_365_PLAN_CODES.BUSINESS_STANDARD },
    update: {
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
    },
    create: {
      code: MICROSOFT_365_PLAN_CODES.BUSINESS_STANDARD,
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
      providerProductId: null,
      providerSkuId: null,
    },
  });

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
