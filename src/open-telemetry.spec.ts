import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { firstValueFrom, of, throwError } from 'rxjs';
import { Span } from './decorators/span.decorator';
import { Traceable } from './decorators/traceable.decorator';
import { OpenTelemetryModule } from './open-telemetry.module';
import { TraceService } from './trace/trace.service';

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

describe('@Span', () => {
  @Injectable()
  class SampleService {
    @Span()
    syncOk(): string {
      return 'ok';
    }

    @Span('custom.name')
    named(): string {
      return 'named';
    }

    @Span()
    async asyncOk(): Promise<number> {
      return 42;
    }

    @Span()
    async asyncFail(): Promise<never> {
      throw new Error('boom');
    }

    @Span()
    syncFail(): never {
      throw new TypeError('sync-boom');
    }

    @Span()
    observableOk() {
      return of('stream');
    }

    @Span()
    observableFail() {
      return throwError(() => new Error('obs-boom'));
    }
  }

  const service = new SampleService();

  it('creates a span named Class.method by default', () => {
    expect(service.syncOk()).toBe('ok');
    const spans = finished();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('SampleService.syncOk');
    expect(spans[0].status.code).toBe(SpanStatusCode.UNSET);
  });

  it('honours an explicit span name', () => {
    service.named();
    expect(finished()[0].name).toBe('custom.name');
  });

  it('ends the span for async success', async () => {
    await expect(service.asyncOk()).resolves.toBe(42);
    expect(finished()).toHaveLength(1);
    expect(finished()[0].status.code).toBe(SpanStatusCode.UNSET);
  });

  it('records the exception and ERROR status for async failure', async () => {
    await expect(service.asyncFail()).rejects.toThrow('boom');
    const span = finished()[0];
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.status.message).toContain('boom');
    expect(span.events.some((e) => e.name === 'exception')).toBe(true);
  });

  it('records the exception and ERROR status for sync failure', () => {
    expect(() => service.syncFail()).toThrow('sync-boom');
    const span = finished()[0];
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.status.message).toContain('TypeError');
  });

  it('ends the span when an observable completes', async () => {
    await expect(firstValueFrom(service.observableOk())).resolves.toBe(
      'stream',
    );
    expect(finished()).toHaveLength(1);
  });

  it('records ERROR when an observable errors', async () => {
    await expect(firstValueFrom(service.observableFail())).rejects.toThrow(
      'obs-boom',
    );
    expect(finished()[0].status.code).toBe(SpanStatusCode.ERROR);
  });
});

describe('@Traceable', () => {
  @Traceable()
  class TracedService {
    a(): string {
      return 'a';
    }

    b(): string {
      return 'b';
    }
  }

  it('wraps every method in a span', () => {
    const svc = new TracedService();
    svc.a();
    svc.b();
    const names = finished()
      .map((s) => s.name)
      .sort();
    expect(names).toEqual(['TracedService.a', 'TracedService.b']);
  });
});

describe('TraceService', () => {
  it('is provided by the module and exposes the active span inside startActiveSpan', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OpenTelemetryModule.forRoot({ tracerName: 'test-tracer' })],
    }).compile();

    const traceService = moduleRef.get(TraceService);
    expect(traceService).toBeInstanceOf(TraceService);

    const captured = traceService.startActiveSpan('manual', () =>
      traceService.getSpan(),
    );
    expect(captured).toBeDefined();

    const spans = finished();
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe('manual');

    await moduleRef.close();
  });

  it('supports forRootAsync with useFactory', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        OpenTelemetryModule.forRootAsync({
          useFactory: () => ({ tracerName: 'async-tracer' }),
        }),
      ],
    }).compile();

    expect(moduleRef.get(TraceService)).toBeInstanceOf(TraceService);
    await moduleRef.close();
  });
});
