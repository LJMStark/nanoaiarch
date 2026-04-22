import type { Dispatcher } from 'undici';

export const GEMINI_PROXIED_HOSTS = new Set<string>([
  'generativelanguage.googleapis.com',
  'aiplatform.googleapis.com',
]);

type UndiciLike = {
  Dispatcher: typeof Dispatcher;
  ProxyAgent: new (proxyUrl: string) => Dispatcher;
  getGlobalDispatcher: () => Dispatcher;
  setGlobalDispatcher: (dispatcher: Dispatcher) => void;
};

export function resolveDispatchHost(
  origin: Dispatcher.DispatchOptions['origin']
): string | null {
  if (!origin) {
    return null;
  }

  try {
    return typeof origin === 'string'
      ? new URL(origin).hostname
      : origin.hostname;
  } catch {
    return null;
  }
}

export function shouldProxyGeminiHost(
  host: string | null | undefined,
  proxiedHosts: ReadonlySet<string> = GEMINI_PROXIED_HOSTS
): boolean {
  return Boolean(host && proxiedHosts.has(host));
}

export function registerGeminiProxyRouting(params: {
  undici: UndiciLike;
  proxyUrl?: string | null;
  proxiedHosts?: ReadonlySet<string>;
  log?: (message: string) => void;
}): { enabled: boolean } {
  const proxyUrl = params.proxyUrl?.trim();
  if (!proxyUrl) {
    return { enabled: false };
  }

  const proxiedHosts = params.proxiedHosts ?? GEMINI_PROXIED_HOSTS;
  const log = params.log ?? (() => {});
  const direct = params.undici.getGlobalDispatcher();
  const proxy = new params.undici.ProxyAgent(proxyUrl);

  class HostRouteDispatcher extends params.undici.Dispatcher {
    dispatch(
      opts: Dispatcher.DispatchOptions,
      handler: Dispatcher.DispatchHandlers
    ): boolean {
      const host = resolveDispatchHost(opts.origin);
      const target = shouldProxyGeminiHost(host, proxiedHosts) ? proxy : direct;
      return target.dispatch(opts, handler);
    }
  }

  params.undici.setGlobalDispatcher(new HostRouteDispatcher());
  log(
    `[instrumentation] routing ${[...proxiedHosts].join(', ')} via ${new URL(proxyUrl).host}`
  );

  return { enabled: true };
}
