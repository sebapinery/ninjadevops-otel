import { Controller, Get } from '@nestjs/common';
import type { Span } from '@opentelemetry/api';
import { CurrentSpan } from 'ninjadevops-otel';

@Controller('health')
export class HealthController {
  /**
   * `@CurrentSpan()` injects the active span (the HTTP server span here), or
   * `undefined` when tracing is disabled — always guard with optional chaining.
   */
  @Get()
  check(@CurrentSpan() span?: Span) {
    span?.setAttribute('app.handler', 'health.check');
    return { ok: true };
  }
}
