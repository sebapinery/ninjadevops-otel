import { Controller, Get, Param, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // The HTTP server span is created by auto-instrumentation; the service's
  // @Span methods nest underneath it automatically.
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.orders.getById(id);
  }

  @Post(':id/checkout')
  checkout(@Param('id') id: string) {
    return this.orders.checkout(id);
  }
}
