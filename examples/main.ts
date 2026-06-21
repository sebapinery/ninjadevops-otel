// IMPORTANT: tracing must be the very first import so the SDK starts before
// any instrumented library is loaded.
import './tracing';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap();
