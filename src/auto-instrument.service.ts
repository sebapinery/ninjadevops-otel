import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  ApplicationConfig,
  DiscoveryService,
  MetadataScanner,
  ModuleRef,
  Reflector,
} from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { isClassNoSpan, isMethodNoSpan } from './decorators/no-span.decorator';
import { Span } from './decorators/span.decorator';
import {
  OTEL_MODULE_OPTIONS,
  OTEL_SPAN_METADATA,
} from './open-telemetry.constants';
import type {
  AutoInstrumentOptions,
  OpenTelemetryModuleOptions,
} from './open-telemetry.interfaces';
import { TraceService } from './trace/trace.service';

const lowerFirst = (value: string): string =>
  value.length > 0 ? value[0].toLowerCase() + value.slice(1) : value;

const defaultNaming = (className: string, methodName: string): string =>
  `${lowerFirst(className)}.${methodName}()`;

/**
 * Framework and library-internal classes that must never be auto-instrumented,
 * matched by reference so renames can't slip through. `SpanAutoInstrumentation`
 * is added lazily below to avoid a self-reference at module-eval time.
 */
const ALWAYS_EXCLUDED = new Set<unknown>([
  TraceService,
  DiscoveryService,
  MetadataScanner,
  Reflector,
  ModuleRef,
  ApplicationConfig,
]);

/** Nest module that holds framework-internal providers (ModuleRef, etc.). */
const INTERNAL_CORE_MODULE = 'InternalCoreModule';

/**
 * Bootstrap-time discovery pass that wraps every eligible provider and
 * controller method in a {@link Span}, so applications get per-method spans
 * without decorating anything by hand.
 *
 * A method is skipped when it already carries an explicit `@Span`/`@Traceable`,
 * when it (or its class) is annotated with `@NoSpan()`, when its class is in the
 * `exclude` list, or when it is a `_`-prefixed method and `includePrivate` is
 * off. Getters, setters and the constructor are always skipped.
 */
@Injectable()
export class SpanAutoInstrumentation implements OnModuleInit {
  private readonly logger = new Logger(SpanAutoInstrumentation.name);

  constructor(
    @Inject(OTEL_MODULE_OPTIONS)
    private readonly options: OpenTelemetryModuleOptions,
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
  ) {}

  onModuleInit(): void {
    const config = this.resolveConfig();
    if (!config) return;

    const excluded = new Set(
      (config.exclude ?? []).map((entry) =>
        typeof entry === 'string' ? entry : entry.name,
      ),
    );

    let count = 0;
    const wrappers = [
      ...this.discovery.getProviders(),
      ...this.discovery.getControllers(),
    ];

    for (const wrapper of wrappers) {
      count += this.instrumentWrapper(wrapper, config, excluded);
    }

    this.logger.log(`Auto-instrumented ${count} method(s) with spans`);
  }

  private resolveConfig(): AutoInstrumentOptions | undefined {
    const setting = this.options.autoInstrument;
    if (!setting) return undefined;
    return setting === true ? {} : setting;
  }

  private instrumentWrapper(
    wrapper: InstanceWrapper,
    config: AutoInstrumentOptions,
    excluded: Set<string>,
  ): number {
    const metatype = wrapper.metatype;
    // Skip value/factory providers (no class) and aliases.
    if (!metatype || typeof metatype !== 'function' || wrapper.isAlias) {
      return 0;
    }

    // Skip framework internals, self-references and module-as-provider entries.
    if (
      ALWAYS_EXCLUDED.has(metatype) ||
      metatype === SpanAutoInstrumentation ||
      wrapper.host?.metatype?.name === INTERNAL_CORE_MODULE ||
      metatype === wrapper.host?.metatype
    ) {
      return 0;
    }

    const className = metatype.name;
    if (excluded.has(className) || isClassNoSpan(metatype)) {
      return 0;
    }

    const proto = metatype.prototype;
    if (!proto) return 0;

    const naming = config.naming ?? defaultNaming;
    let count = 0;

    for (const methodName of this.scanner.getAllMethodNames(proto)) {
      if (!config.includePrivate && methodName.startsWith('_')) continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, methodName);
      // Only own, plain methods — skip inherited, getters and setters.
      if (!descriptor || typeof descriptor.value !== 'function') continue;

      const method = descriptor.value;
      if (Reflect.getMetadata(OTEL_SPAN_METADATA, method)) continue; // has @Span
      if (isMethodNoSpan(method)) continue;

      Span(naming(className, methodName))(proto, methodName, descriptor);
      Object.defineProperty(proto, methodName, descriptor);
      count++;
    }

    return count;
  }
}
