import {
  AbstractTelemetryDto,
  TelemetryAttribute,
  TelemetryOperation,
} from 'ninjadevops-otel';

/**
 * Declarative telemetry DTO for the login operation.
 *
 * - `@TelemetryOperation('user.login')` sets the span name AND records the
 *   attribute `operation=user.login`.
 * - each `@TelemetryAttribute` maps a property to a span attribute key.
 * - `undefined`/`null` properties are skipped when the map is built.
 */
@TelemetryOperation('user.login')
export class LoginTelemetryDto extends AbstractTelemetryDto {
  @TelemetryAttribute('app.user.id')
  userId!: string;

  @TelemetryAttribute('app.user.email')
  email?: string;

  @TelemetryAttribute('app.auth.attempts')
  attempts!: number;

  static of(userId: string, email: string, attempts: number) {
    const dto = new LoginTelemetryDto();
    dto.userId = userId;
    dto.email = email;
    dto.attempts = attempts;
    return dto;
  }
}
