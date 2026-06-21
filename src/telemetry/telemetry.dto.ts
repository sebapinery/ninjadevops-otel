import 'reflect-metadata';
import type { AttributeValue } from '@opentelemetry/api';
import {
  TELEMETRY_ATTRIBUTE,
  TELEMETRY_ATTRIBUTE_KEYS,
  TELEMETRY_OPERATION_KEY,
  TELEMETRY_OPERATION_NAME,
} from './telemetry.constants';
import type { TelemetryAttributes, TelemetryDto } from './telemetry.interfaces';

/**
 * Base class for declarative telemetry DTOs.
 *
 * Extend it and annotate the class with `@TelemetryOperation` and properties
 * with `@TelemetryAttribute`; the DTO then knows how to build its own span
 * attribute map and span name. Hand the instance to
 * `TraceService.setAttributes` or `TraceService.startActiveSpanWith` to apply
 * it.
 *
 * ```ts
 * @TelemetryOperation('user.login')
 * class LoginTelemetryDto extends AbstractTelemetryDto {
 *   @TelemetryAttribute('app.user.id') userId!: string;
 *   @TelemetryAttribute('app.user.email') email!: string;
 * }
 * ```
 */
export abstract class AbstractTelemetryDto implements TelemetryDto {
  buildSpanMap(): TelemetryAttributes {
    const attributes: TelemetryAttributes = {};
    const ctor = this.constructor;
    const proto = Object.getPrototypeOf(this);

    const operationKey = Reflect.getMetadata(TELEMETRY_OPERATION_KEY, ctor);
    const operationName = Reflect.getMetadata(TELEMETRY_OPERATION_NAME, ctor);
    if (operationKey !== undefined && operationName !== undefined) {
      attributes[operationKey] = operationName;
    }

    const propertyKeys: (string | symbol)[] =
      Reflect.getMetadata(TELEMETRY_ATTRIBUTE_KEYS, proto) ?? [];
    for (const propertyKey of propertyKeys) {
      const attributeKey = Reflect.getMetadata(
        TELEMETRY_ATTRIBUTE,
        proto,
        propertyKey,
      );
      const value = (this as Record<string | symbol, unknown>)[propertyKey];
      if (value === undefined || value === null) {
        continue;
      }
      attributes[attributeKey] = toAttributeValue(value);
    }

    return attributes;
  }

  buildSpanName(): string | undefined {
    return Reflect.getMetadata(TELEMETRY_OPERATION_NAME, this.constructor);
  }
}

/**
 * Coerce an arbitrary property value into a valid OpenTelemetry
 * {@link AttributeValue}. Primitives pass through unchanged; arrays are
 * stringified element-wise; everything else is stringified.
 */
function toAttributeValue(value: unknown): AttributeValue {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return String(value);
}
