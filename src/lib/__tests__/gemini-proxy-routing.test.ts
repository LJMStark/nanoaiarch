import { describe, expect, it, vi } from 'vitest';
import {
  GEMINI_PROXIED_HOSTS,
  registerGeminiProxyRouting,
  resolveDispatchHost,
  shouldProxyGeminiHost,
} from '../gemini-proxy-routing';

describe('gemini-proxy-routing', () => {
  it('resolves hosts from string and URL origins', () => {
    expect(
      resolveDispatchHost('https://generativelanguage.googleapis.com/v1beta')
    ).toBe('generativelanguage.googleapis.com');
    expect(
      resolveDispatchHost(new URL('https://aiplatform.googleapis.com'))
    ).toBe('aiplatform.googleapis.com');
    expect(resolveDispatchHost(undefined)).toBeNull();
  });

  it('only proxies configured Gemini hosts', () => {
    expect(shouldProxyGeminiHost('generativelanguage.googleapis.com')).toBe(
      true
    );
    expect(shouldProxyGeminiHost('aiplatform.googleapis.com')).toBe(true);
    expect(
      shouldProxyGeminiHost('pub-9cd3efeb49d4491d998c51f6f540fdfe.r2.dev')
    ).toBe(false);
  });

  it('installs a dispatcher that only routes Gemini hosts via proxy', () => {
    const directDispatch = vi.fn(() => true);
    const proxyDispatch = vi.fn(() => true);
    const setGlobalDispatcher = vi.fn();
    const log = vi.fn();

    class FakeDispatcher {
      dispatch(): boolean {
        return false;
      }
    }

    class FakeProxyAgent {
      dispatch = proxyDispatch;
    }

    let installedDispatcher: {
      dispatch: (
        opts: { origin?: string | URL },
        handler: Record<string, never>
      ) => boolean;
    } | null = null;

    setGlobalDispatcher.mockImplementation((dispatcher) => {
      installedDispatcher = dispatcher as typeof installedDispatcher;
    });

    registerGeminiProxyRouting({
      undici: {
        Dispatcher: FakeDispatcher as never,
        ProxyAgent: FakeProxyAgent as never,
        getGlobalDispatcher: () =>
          ({
            dispatch: directDispatch,
          }) as never,
        setGlobalDispatcher,
      },
      proxyUrl: 'http://proxy.example.com:8080',
      log,
    });

    expect(setGlobalDispatcher).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      `[instrumentation] routing ${[...GEMINI_PROXIED_HOSTS].join(', ')} via proxy.example.com:8080`
    );

    expect(installedDispatcher).not.toBeNull();

    installedDispatcher!.dispatch(
      { origin: 'https://generativelanguage.googleapis.com' },
      {}
    );
    installedDispatcher!.dispatch({ origin: 'https://nanoaiarch.com' }, {});

    expect(proxyDispatch).toHaveBeenCalledTimes(1);
    expect(directDispatch).toHaveBeenCalledTimes(1);
  });

  it('stays inert when GEMINI_HTTPS_PROXY is empty', () => {
    const setGlobalDispatcher = vi.fn();

    const result = registerGeminiProxyRouting({
      undici: {
        Dispatcher: class {
          dispatch(): boolean {
            return false;
          }
        } as never,
        ProxyAgent: class {
          dispatch(): boolean {
            return false;
          }
        } as never,
        getGlobalDispatcher: () =>
          ({
            dispatch: vi.fn(),
          }) as never,
        setGlobalDispatcher,
      },
      proxyUrl: '   ',
    });

    expect(result).toEqual({ enabled: false });
    expect(setGlobalDispatcher).not.toHaveBeenCalled();
  });
});
