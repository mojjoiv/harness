import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ApiUsageInterceptor } from './common/interceptors/api-usage.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const requestIdMiddleware = new RequestIdMiddleware();

  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));

  const allowedOrigins = [
    'http://localhost:3001',
    config.get<string>('FRONTEND_URL'),
    config.get<string>('APP_URL'),
    config.get<string>('CHECKOUT_URL'),
  ].filter(Boolean);

  app.enableCors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, config.get<string>('NODE_ENV') !== 'production');
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(app.get(ApiUsageInterceptor), new ResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PayHarness API')
    .setDescription(
      'PayHarness merchant and payments API. Merchant payment endpoints accept a dashboard JWT or a server-side PayHarness API key (ph_sandbox_... / ph_live_...). API keys are environment-bound and must never be exposed in browser code.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'PayHarness API key or JWT',
        description:
          'Use a dashboard JWT for dashboard access or a PayHarness API key for server-to-server merchant integrations.',
      },
      'bearer',
    )
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('PORT') || 3000;
  await app.listen(port);
}

bootstrap();
