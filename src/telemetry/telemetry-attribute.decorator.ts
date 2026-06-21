import 'reflect-metadata';
import {
  TELEMETRY_ATTRIBUTE,
  TELEMETRY_ATTRIBUTE_KEYS,
} from './telemetry.constants';

/**
 * Property decorator that maps a DTO property to a span attribute key.
 *
 * {@link AbstractTelemetryDto.buildSpanMap} reads these to build the attribute
 * map, using the property's runtime value as the attribute value. `undefined`
 * and `null` values are skipped.
 *
 * ```ts
 * class LoginDto extends AbstractTelemetryDto {
 *   @TelemetryAttribute('app.user.id') userId!: string;
 * }
 * ```
 *
 * @param attributeKey The span attribute key this property maps to.
 */
export function TelemetryAttribute(attributeKey: string): PropertyDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata(
      TELEMETRY_ATTRIBUTE,
      attributeKey,
      target,
      propertyKey,
    );

    const existing: (string | symbol)[] =
      Reflect.getMetadata(TELEMETRY_ATTRIBUTE_KEYS, target) ?? [];
    if (!existing.includes(propertyKey)) {
      Reflect.defineMetadata(
        TELEMETRY_ATTRIBUTE_KEYS,
        [...existing, propertyKey],
        target,
      );
    }
  };
}
