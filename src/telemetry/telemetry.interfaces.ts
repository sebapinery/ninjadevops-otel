import type { Attributes, AttributeValue } from '@opentelemetry/api';

/**
 * A plain map of span attributes. Mirrors OpenTelemetry's {@link Attributes}
 * (`undefined` values are allowed and skipped by the consumer).
 */
export type TelemetryAttributes = Record<string, AttributeValue | undefined>;

/**
 * Contract for declarative telemetry DTOs. Implemented by
 * {@link AbstractTelemetryDto}; you only need to reference this type directly to
 * accept arbitrary DTO implementations.
 */
export interface TelemetryDto {
  /** Build the span attribute map from the DTO's decorated properties. */
  buildSpanMap(): TelemetryAttributes;

  /** The span name declared via `@TelemetryOperation`, or `undefined`. */
  buildSpanName(): string | undefined;
}

/**
 * Anything the bridge can turn into span attributes: a declarative
 * {@link TelemetryDto} or a raw attribute map.
 */
export type TelemetrySource = TelemetryDto | TelemetryAttributes;

/**
 * Structural type guard for {@link TelemetryDto}. A raw attribute map is *not* a
 * DTO, so this distinguishes the two `TelemetrySource` shapes.
 */
export function isTelemetryDto(
  source: TelemetrySource,
): source is TelemetryDto {
  return (
    typeof (source as TelemetryDto).buildSpanMap === 'function' &&
    typeof (source as TelemetryDto).buildSpanName === 'function'
  );
}

/**
 * Resolve a {@link TelemetrySource} to an {@link Attributes} map, dropping
 * `undefined` values so they are never written to the span.
 */
export function toTelemetryAttributes(source: TelemetrySource): Attributes {
  const raw = isTelemetryDto(source) ? source.buildSpanMap() : source;
  const attributes: Attributes = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined) {
      attributes[key] = value;
    }
  }
  return attributes;
}

/**
 * The span name a {@link TelemetrySource} carries, if any. Raw attribute maps
 * never carry a name.
 */
export function resolveSpanName(source: TelemetrySource): string | undefined {
  return isTelemetryDto(source) ? source.buildSpanName() : undefined;
}
