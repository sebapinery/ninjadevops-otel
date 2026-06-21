import 'reflect-metadata';
import {
  DEFAULT_OPERATION_ATTRIBUTE_KEY,
  TELEMETRY_OPERATION_KEY,
  TELEMETRY_OPERATION_NAME,
} from './telemetry.constants';

/**
 * Class decorator that declares the operation a telemetry DTO represents.
 *
 * The operation name becomes the span name produced by
 * {@link AbstractTelemetryDto.buildSpanName} (and overrides any name passed to
 * `TraceService.startActiveSpanWith`). It is also recorded as a span attribute
 * under `attributeKey` (defaults to `operation`).
 *
 * ```ts
 * @TelemetryOperation('user.login')                 // attribute: operation=user.login
 * @TelemetryOperation('app.operation', 'user.login') // attribute: app.operation=user.login
 * class LoginDto extends AbstractTelemetryDto {}
 * ```
 *
 * @param name Operation name (single-argument form).
 */
export function TelemetryOperation(name: string): ClassDecorator;
/**
 * @param attributeKey Span attribute key under which the operation is recorded.
 * @param name Operation name.
 */
export function TelemetryOperation(
  attributeKey: string,
  name: string,
): ClassDecorator;
export function TelemetryOperation(
  attributeKeyOrName: string,
  name?: string,
): ClassDecorator {
  const attributeKey =
    name === undefined ? DEFAULT_OPERATION_ATTRIBUTE_KEY : attributeKeyOrName;
  const operationName = name === undefined ? attributeKeyOrName : name;

  return (target) => {
    Reflect.defineMetadata(TELEMETRY_OPERATION_KEY, attributeKey, target);
    Reflect.defineMetadata(TELEMETRY_OPERATION_NAME, operationName, target);
  };
}
