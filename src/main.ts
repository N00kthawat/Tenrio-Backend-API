import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tenrio Backend API')
    .setDescription('Initial Tenrio Backend API skeleton.')
    .setVersion('1.0.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('v1/docs', app, swaggerDocument);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  const host = process.env.HOST ?? '127.0.0.1';

  await app.listen(port, host);
}

void bootstrap();
