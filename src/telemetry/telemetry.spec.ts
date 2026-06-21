import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { TraceService } from '../trace/trace.service';
import { AbstractTelemetryDto } from './telemetry.dto';
import { TelemetryAttribute } from './telemetry-attribute.decorator';
import { TelemetryOperation } from './telemetry-operation.decorator';

const exporter = new InMemorySpanExporter();
let provider: BasicTracerProvider;

beforeAll(() => {
  provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  trace.setGlobalTracerProvider(provider);
  context.setGlobalContextManager(
    new AsyncLocalStorageContextManager().enable(),
  );
});

afterEach(() => exporter.reset());

afterAll(async () => {
  await provider.shutdown();
});

const finished = (): ReadableSpan[] => exporter.getFinishedSpans();
const trace$ = new TraceService({ tracerName: 'telemetry-test' });

@TelemetryOperation('user.login')
class LoginTelemetryDto extends AbstractTelemetryDto {
  @TelemetryAttribute('app.user.id') userId!: string;
  @TelemetryAttribute('app.user.email') email?: string;
  @TelemetryAttribute('app.user.attempts') attempts!: number;
}

describe('AbstractTelemetryDto', () => {
  it('builds the attribute map from decorated properties and the operation', () => {
    const dto = new LoginTelemetryDto();
    dto.userId = 'u-1';
    dto.email = 'a@b.com';
    dto.attempts = 3;

    expect(dto.buildSpanMap()).toEqual({
      operation: 'user.login',
      'app.user.id': 'u-1',
      'app.user.email': 'a@b.com',
      'app.user.attempts': 3,
    });
    expect(dto.buildSpanName()).toBe('user.login');
  });

  it('skips undefined/null properties', () => {
    const dto = new LoginTelemetryDto();
    dto.userId = 'u-2';
    dto.attempts = 1;
    // email left undefined

    expect(dto.buildSpanMap()).not.toHaveProperty('app.user.email');
  });

  it('supports a custom operation attribute key', () => {
    @TelemetryOperation('app.operation', 'order.create')
    class OrderDto extends AbstractTelemetryDto {}

    const dto = new OrderDto();
    expect(dto.buildSpanMap()).toEqual({ 'app.operation': 'order.create' });
    expect(dto.buildSpanName()).toBe('order.create');
  });
});

describe('TraceService.setAttributes', () => {
  it('attaches DTO attributes to the active span', () => {
    const dto = new LoginTelemetryDto();
    dto.userId = 'u-9';
    dto.attempts = 2;

    trace$.startActiveSpan('manual', () => trace$.setAttributes(dto));

    const span = finished()[0];
    expect(span.attributes['app.user.id']).toBe('u-9');
    expect(span.attributes.operation).toBe('user.login');
  });

  it('accepts a raw attribute map', () => {
    trace$.startActiveSpan('manual', () =>
      trace$.setAttributes({ 'app.order.id': 'o-1' }),
    );
    expect(finished()[0].attributes['app.order.id']).toBe('o-1');
  });

  it('is a no-op with no active span', () => {
    expect(() => trace$.setAttributes({ 'app.x': 1 })).not.toThrow();
    expect(finished()).toHaveLength(0);
  });
});

describe('TraceService.startActiveSpanWith', () => {
  it('names the span from @TelemetryOperation and sets attributes', () => {
    const dto = new LoginTelemetryDto();
    dto.userId = 'u-7';
    dto.attempts = 1;

    const result = trace$.startActiveSpanWith(dto, () => 'done');

    expect(result).toBe('done');
    const span = finished()[0];
    expect(span.name).toBe('user.login');
    expect(span.attributes['app.user.id']).toBe('u-7');
  });

  it('falls back to an explicit name for raw maps', () => {
    trace$.startActiveSpanWith(
      { 'app.order.id': 'o-2' },
      'order.create',
      () => {
        // noop
      },
    );
    const span = finished()[0];
    expect(span.name).toBe('order.create');
    expect(span.attributes['app.order.id']).toBe('o-2');
  });

  it('lets the DTO operation override an explicit name', () => {
    const dto = new LoginTelemetryDto();
    dto.userId = 'u-3';
    dto.attempts = 1;

    trace$.startActiveSpanWith(dto, 'ignored', () => undefined);
    expect(finished()[0].name).toBe('user.login');
  });

  it('records ERROR and ends the span on async failure', async () => {
    await expect(
      trace$.startActiveSpanWith({ 'app.x': 1 }, 'failing', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const span = finished()[0];
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes['app.x']).toBe(1);
  });

  it('throws when no name can be resolved', () => {
    expect(() =>
      trace$.startActiveSpanWith({ 'app.x': 1 }, () => undefined),
    ).toThrow(/requires a span name/);
  });
});
