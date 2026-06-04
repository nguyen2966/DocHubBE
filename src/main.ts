import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({
    transform: true
  }));

  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });


  const config = new DocumentBuilder()
    .setTitle('Documentation Hub')
    .setDescription('Centralized UI for API testing')
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory);

  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
