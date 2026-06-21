import { Injectable } from '@nestjs/common';
import { SpanKind } from '@opentelemetry/api';
import { Span, TraceService } from 'ninjadevops-otel';

@Injectable()
export class OrdersService {
  constructor(private readonly trace: TraceService) {}

  /**
   * `@Span()` opens an active span named "OrdersService.getById". Any nested
   * DB/HTTP call (already auto-instrumented) becomes a child of it. We enrich the
   * span with a business attribute via the injected TraceService.
   */
  @Span()
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
   * Explicit span name + kind. Returning a Promise is fine — the span ends when
   * it settles, and is marked ERROR if it rejects.
   */
  @Span('orders.checkout', { kind: SpanKind.INTERNAL })
  async checkout(orderId: string) {
    await this.charge(orderId);
    return { ok: true };
  }

  private async loadFromDb(orderId: string) {
    return { id: orderId, total: 4200, currency: 'USD' };
  }

  private async charge(_orderId: string) {
    /* payment gateway call */
  }
}
