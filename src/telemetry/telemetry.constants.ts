/**
 * `reflect-metadata` keys used by the telemetry DTO bridge. They are namespaced
 * so they never collide with NestJS' own metadata or with the keys other
 * libraries store on the same classes.
 */

/** Class metadata: attribute key under which the operation name is recorded. */
export const TELEMETRY_OPERATION_KEY = 'ninjadevops:telemetry:operation:key';

/** Class metadata: the operation name, also used as the span name. */
export const TELEMETRY_OPERATION_NAME = 'ninjadevops:telemetry:operation:name';

/** Property metadata: the span attribute key a decorated property maps to. */
export const TELEMETRY_ATTRIBUTE = 'ninjadevops:telemetry:attribute';

/** Prototype metadata: the list of properties carrying `@TelemetryAttribute`. */
export const TELEMETRY_ATTRIBUTE_KEYS = 'ninjadevops:telemetry:attribute:keys';

/**
 * Default attribute key used by `@TelemetryOperation(name)` when no explicit key
 * is given.
 */
export const DEFAULT_OPERATION_ATTRIBUTE_KEY = 'operation';
