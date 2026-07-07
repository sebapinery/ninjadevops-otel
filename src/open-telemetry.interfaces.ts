import type { ModuleMetadata, Type } from '@nestjs/common';

/**
 * Fine-grained configuration for automatic span instrumentation.
 */
export interface AutoInstrumentOptions {
  /**
   * Classes to exclude wholesale (equivalent to annotating each with
   * `@NoSpan()`). Accepts the class reference or its name.
   */
  exclude?: (Type | string)[];

  /**
   * Also wrap methods whose name starts with `_` (a common "private by
   * convention" marker). Defaults to `false`.
   */
  includePrivate?: boolean;

  /**
   * Build the span name from the provider/controller class name and method
   * name. Defaults to ``(cls, method) => `${lowerFirst(cls)}.${method}()` ``,
   * e.g. `tokensService.revokeAllAccessToken()`.
   */
  naming?: (className: string, methodName: string) => string;
}

/**
 * Options for {@link OpenTelemetryModule}.
 *
 * This library is tracing-only and does **not** bootstrap the OpenTelemetry
 * SDK. Start the SDK (e.g. `@opentelemetry/sdk-node` or
 * `@opentelemetry/auto-instrumentations-node/register`) before Nest boots so a
 * global `TracerProvider` is registered. These options only control which
 * tracer this module's `TraceService` and decorators obtain from it.
 */
export interface OpenTelemetryModuleOptions {
  /**
   * Name of the tracer obtained from the global `TracerProvider`.
   * Defaults to `ninjadevops-otel`.
   */
  tracerName?: string;

  /**
   * Version reported for the tracer (the instrumentation scope version).
   */
  tracerVersion?: string;

  /**
   * Automatically wrap every provider and controller method in a span at
   * bootstrap, so services need no manual `@Span()`. Methods carrying an
   * explicit `@Span`/`@Traceable` are left untouched, and anything marked with
   * `@NoSpan()` is skipped.
   *
   * `true` enables it with defaults; pass an object to tune naming/exclusions.
   * Defaults to `false` (opt-in).
   */
  autoInstrument?: boolean | AutoInstrumentOptions;
}

/**
 * Implement this to provide {@link OpenTelemetryModuleOptions} asynchronously
 * via `OpenTelemetryModule.forRootAsync({ useClass | useExisting })`.
 */
export interface OpenTelemetryOptionsFactory {
  createOpenTelemetryOptions():
    | Promise<OpenTelemetryModuleOptions>
    | OpenTelemetryModuleOptions;
}

/**
 * Async configuration for {@link OpenTelemetryModule.forRootAsync}.
 */
export interface OpenTelemetryModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<OpenTelemetryOptionsFactory>;
  useClass?: Type<OpenTelemetryOptionsFactory>;
  useFactory?: (
    ...args: any[]
  ) => Promise<OpenTelemetryModuleOptions> | OpenTelemetryModuleOptions;
  inject?: any[];
}
