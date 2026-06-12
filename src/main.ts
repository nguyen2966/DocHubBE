import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

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
    origin: 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  });


  const config = new DocumentBuilder()
    .setTitle('Documentation Hub')
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
