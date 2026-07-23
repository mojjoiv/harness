import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ApiUsageInterceptor } from './common/interceptors/api-usage.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

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
    .setDescription('PayHarness merchant and payments API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('PORT') || 3000;
  await app.listen(port);

  // Deployment diagnostics -- helps confirm which build/commit is actually
  // running on Render, and doubles as confirmation this instrumentation
  // itself made it into the deployed build.
  const dbUrl = config.get<string>('DATABASE_URL');
  let dbHost = 'unknown';
  try {
    dbHost = dbUrl ? new URL(dbUrl).hostname : 'not configured';
  } catch {
    dbHost = 'unparseable';
  }

  logger.log(
    `Startup: commit=${process.env.RENDER_GIT_COMMIT || 'unknown'} ` +
      `nodeEnv=${config.get<string>('NODE_ENV')} ` +
      `appUrl=${config.get<string>('APP_URL')} ` +
      `dbHost=${dbHost} ` +
      `renderService=${process.env.RENDER_SERVICE_NAME || 'not on Render'}`,
  );
  logger.log('PaymentsService instrumentation loaded');
  logger.log('createRealMpesaStk instrumentation enabled');
}

bootstrap();
