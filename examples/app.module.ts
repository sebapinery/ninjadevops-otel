import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpenTelemetryModule } from 'ninjadevops-otel';
import { AuthService } from './auth/auth.service';
import { HealthController } from './health/health.controller';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    // Synchronous registration is enough for most apps:
    //   OpenTelemetryModule.forRoot({ tracerName: 'demo' }),
    // Here we resolve the tracer name from configuration instead:
    OpenTelemetryModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        tracerName: config.get('OTEL_SERVICE_NAME') ?? 'demo',
        tracerVersion: config.get('APP_VERSION'),
        // Zero-touch: every provider/controller method gets a span named
        // `instance.method()` automatically. Methods with an explicit @Span or
        // @NoSpan() are left alone.
        autoInstrument: true,
      }),
    }),
  ],
  controllers: [OrdersController, HealthController],
  providers: [OrdersService, AuthService],
})
export class AppModule {}
