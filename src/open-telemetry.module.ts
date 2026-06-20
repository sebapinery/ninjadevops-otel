import {
  type DynamicModule,
  Global,
  Module,
  type Provider,
} from '@nestjs/common';
import { OTEL_MODULE_OPTIONS } from './open-telemetry.constants';
import type {
  OpenTelemetryModuleAsyncOptions,
  OpenTelemetryModuleOptions,
  OpenTelemetryOptionsFactory,
} from './open-telemetry.interfaces';
import { TraceService } from './trace/trace.service';

/**
 * Global module exposing {@link TraceService} for OpenTelemetry tracing.
 *
 * It does not start the OpenTelemetry SDK — register a global `TracerProvider`
 * separately (e.g. `@opentelemetry/sdk-node`) before Nest boots.
 */
@Global()
@Module({})
export class OpenTelemetryModule {
  static forRoot(options: OpenTelemetryModuleOptions = {}): DynamicModule {
    return {
      module: OpenTelemetryModule,
      providers: [
        { provide: OTEL_MODULE_OPTIONS, useValue: options },
        TraceService,
      ],
      exports: [TraceService],
    };
  }

  static forRootAsync(options: OpenTelemetryModuleAsyncOptions): DynamicModule {
    return {
      module: OpenTelemetryModule,
      imports: options.imports ?? [],
      providers: [
        ...OpenTelemetryModule.createAsyncProviders(options),
        TraceService,
      ],
      exports: [TraceService],
    };
  }

  private static createAsyncProviders(
    options: OpenTelemetryModuleAsyncOptions,
  ): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: OTEL_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ];
    }

    const injectionToken = options.useClass ?? options.useExisting;
    if (!injectionToken) {
      throw new Error(
        'OpenTelemetryModule.forRootAsync requires one of useFactory, useClass or useExisting',
      );
    }

    const providers: Provider[] = [
      {
        provide: OTEL_MODULE_OPTIONS,
        useFactory: (factory: OpenTelemetryOptionsFactory) =>
          factory.createOpenTelemetryOptions(),
        inject: [injectionToken],
      },
    ];

    if (options.useClass) {
      providers.push({ provide: options.useClass, useClass: options.useClass });
    }

    return providers;
  }
}
