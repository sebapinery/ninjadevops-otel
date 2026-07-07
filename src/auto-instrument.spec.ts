import { Controller, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NoSpan } from './decorators/no-span.decorator';
import { Span } from './decorators/span.decorator';
import type { AutoInstrumentOptions } from './open-telemetry.interfaces';
import { OpenTelemetryModule } from './open-telemetry.module';

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
afterAll(async () => provider.shutdown());

const names = (): string[] =>
  exporter
    .getFinishedSpans()
    .map((s: ReadableSpan) => s.name)
    .sort();

/**
 * Prototype wrapping is process-global and permanent, so every test builds a
 * fresh set of classes to stay isolated (and to mirror a real one-shot boot).
 */
function fixtures() {
  @Injectable()
  class TokensService {
    revokeAllAccessToken(userId: string) {
      return `revoked:${userId}`;
    }

    @Span('explicit.name')
    withExplicitSpan() {
      return 'explicit';
    }

    @NoSpan()
    isExpired() {
      return false;
    }

    _private() {
      return 'private';
    }
  }

  @Injectable()
  @NoSpan()
  class HealthService {
    ping() {
      return 'pong';
    }
  }

  @Controller()
  class TokensController {
    constructor(readonly tokens: TokensService) {}
  }

  return { TokensService, HealthService, TokensController };
}

async function boot(autoInstrument: boolean | AutoInstrumentOptions) {
  const { TokensService, HealthService, TokensController } = fixtures();
  const moduleRef = await Test.createTestingModule({
    imports: [OpenTelemetryModule.forRoot({ autoInstrument })],
    controllers: [TokensController],
    providers: [TokensService, HealthService],
  }).compile();
  // Lifecycle hooks (onModuleInit) only fire once the module is initialised.
  await moduleRef.init();
  return { moduleRef, TokensService, HealthService };
}

describe('autoInstrument', () => {
  it('wraps a plain method, naming it instance.method()', async () => {
    const { moduleRef, TokensService } = await boot(true);
    moduleRef.get(TokensService).revokeAllAccessToken('u1');
    expect(names()).toContain('tokensService.revokeAllAccessToken()');
    await moduleRef.close();
  });

  it('leaves an explicit @Span name untouched (no double-wrap)', async () => {
    const { moduleRef, TokensService } = await boot(true);
    moduleRef.get(TokensService).withExplicitSpan();
    expect(names()).toEqual(['explicit.name']);
    await moduleRef.close();
  });

  it('skips @NoSpan methods and @NoSpan classes', async () => {
    const { moduleRef, TokensService, HealthService } = await boot(true);
    moduleRef.get(TokensService).isExpired();
    moduleRef.get(HealthService).ping();
    expect(names()).toHaveLength(0);
    await moduleRef.close();
  });

  it('skips _-prefixed methods unless includePrivate', async () => {
    const off = await boot(true);
    off.moduleRef.get(off.TokensService)._private();
    expect(names()).toHaveLength(0);
    await off.moduleRef.close();

    const on = await boot({ includePrivate: true });
    on.moduleRef.get(on.TokensService)._private();
    expect(names()).toContain('tokensService._private()');
    await on.moduleRef.close();
  });

  it('honours a custom naming formatter', async () => {
    const naming = (cls: string, method: string) => `${cls}#${method}`;
    const { moduleRef, TokensService } = await boot({ naming });
    moduleRef.get(TokensService).revokeAllAccessToken('u1');
    expect(names()).toContain('TokensService#revokeAllAccessToken');
    await moduleRef.close();
  });

  it('does nothing when disabled', async () => {
    const { moduleRef, TokensService } = await boot(false);
    moduleRef.get(TokensService).revokeAllAccessToken('u1');
    expect(names()).toHaveLength(0);
    await moduleRef.close();
  });
});
