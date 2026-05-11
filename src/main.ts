import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Global Class Serializer
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('BAUST CSE Routine Management API')
    .setDescription('The API documentation for BAUST CSE Routine Management System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.APP_PORT || 3000;
  await app.listen(port);
  console.log(`✅ Application is running on: http://localhost:${port}/api`);
  console.log(`📖 API Documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
