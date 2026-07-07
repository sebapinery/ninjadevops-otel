import { Injectable } from '@nestjs/common';
import { SpanKind } from '@opentelemetry/api';
import { NoSpan, Span, TraceService } from 'ninjadevops-otel';

@Injectable()
export class OrdersService {
  constructor(private readonly trace: TraceService) {}

  /**
   * No decorator needed: with `autoInstrument` enabled this method is wrapped
   * automatically in an active span named "ordersService.getById()". Any nested
   * DB/HTTP call (already auto-instrumented) becomes a child of it. We enrich the
   * active span with a business attribute via the injected TraceService.
   */
  async getById(orderId: string) {
    this.trace.setAttributes({ 'app.order.id': orderId });

    const order = await this.loadFromDb(orderId);

    this.trace.setAttributes({
      'app.order.total': order.total,
      'app.order.currency': order.currency,
    });
    return order;
  }

  /**
   * An explicit `@Span` always wins over auto-instrumentation — use it when you
   * want a custom name or span kind instead of the default `instance.method()`.
   */
  @Span('orders.checkout', { kind: SpanKind.INTERNAL })
  async checkout(orderId: string) {
    await this.charge(orderId);
    return { ok: true };
  }

  /**
   * `@NoSpan()` opts a hot/trivial method out of auto-instrumentation to avoid
   * span noise.
   */
  @NoSpan()
  private async loadFromDb(orderId: string) {
    return { id: orderId, total: 4200, currency: 'USD' };
  }

  private async charge(_orderId: string) {
    /* payment gateway call */
  }
}
