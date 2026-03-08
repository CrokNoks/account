import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';

let cachedApp: express.Express;

async function createNestServer(expressInstance: express.Express): Promise<INestApplication> {
  const app = await NestFactory.create(
    AppModule,
    new (require('@nestjs/platform-express').ExpressAdapter)(expressInstance),
  );

  app.enableCors({
    origin: true, // In production, replace with your frontend URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('Account V2 API')
    .setDescription('The Account V2 API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.init();
  return app;
}

// Firebase Function export
export const api = onRequest({ region: 'europe-west1', memory: '256MiB' }, async (req, res) => {
  if (!cachedApp) {
    const expressApp = express();
    await createNestServer(expressApp);
    cachedApp = expressApp;
  }
  return cachedApp(req, res);
});

// Local development
async function bootstrap() {
  if (!process.env.FUNCTIONS_EMULATOR && !process.env.FIREBASE_CONFIG) {
    const expressApp = express();
    const app = await createNestServer(expressApp);
    await app.listen(process.env.PORT ?? 8080);
    console.log(`Application is running on: http://localhost:${process.env.PORT ?? 8080}`);
  }
}
bootstrap();
