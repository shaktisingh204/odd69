import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  // Default security headers. Specific endpoints that need to be embeddable
  // (e.g. sports /stream-proxy, /embed) override X-Frame-Options themselves.
  app.use((req: any, res: any, next: any) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  const prodOrigins = [
    'https://odd69.com',
    'https://admin.odd69.com',
    'https://www.kuberexchange.com',
    'https://admin.kuberexchange.com',
    // Odd69 partner domains
    'https://odd69.com',
    'https://www.odd69.com',
    'https://api.odd69.com',
  ];
  const devOrigins = [
    'http://localhost:9827',
    'http://127.0.0.1:9827',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3010',
  ];
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? prodOrigins
        : [...prodOrigins, ...devOrigins],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 9828);
}
bootstrap();
