import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SpanKind } from '@opentelemetry/api';
import { TraceService } from 'ninjadevops-otel';
import { LoginTelemetryDto } from './login.telemetry-dto';

@Injectable()
export class AuthService {
  constructor(private readonly trace: TraceService) {}

  /**
   * Opens a dedicated "user.login" span (name taken from the DTO's
   * @TelemetryOperation), pre-populated with the DTO's attributes. The work runs
   * INSIDE the span, so failures mark it ERROR and nested calls nest correctly.
   */
  async login(userId: string, email: string) {
    const dto = LoginTelemetryDto.of(userId, email, 1);

    return this.trace.startActiveSpanWith(
      dto,
      async () => {
        const ok = await this.verify(userId);
        if (!ok) {
          // Throwing here marks the span ERROR and records the exception.
          throw new UnauthorizedException();
        }
        return { token: 'jwt-for-' + userId };
      },
      { kind: SpanKind.SERVER },
    );
  }

  /**
   * Alternative: enrich whatever span is already active instead of opening one.
   * `setAttributes` is a no-op when there is no active span.
   */
  recordLogout(userId: string) {
    this.trace.setAttributes({ 'app.user.id': userId, 'app.auth.event': 'logout' });
  }

  private async verify(_userId: string) {
    return true;
  }
}
