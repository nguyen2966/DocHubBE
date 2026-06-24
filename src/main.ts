import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { APP_CLIENT_URL } from './common/constants/app.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  app.enableCors({
    origin: APP_CLIENT_URL,
    credentials: true,
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  });


  const config = new DocumentBuilder()
    .setTitle('Folio')
    .setDescription('Centralized UI for API testing')
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory);

   // Serve the local storage folder at /storage/*
  app.useStaticAssets(
    process.env.LOCAL_STORAGE_ROOT as string,
    { prefix: '/storage' },
  );


  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
