import { registerGeminiProxyRouting } from './src/lib/gemini-proxy-routing';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const proxyUrl = process.env.GEMINI_HTTPS_PROXY?.trim();
  if (!proxyUrl) {
    return;
  }

  const undici = await import('undici');
  registerGeminiProxyRouting({
    undici,
    proxyUrl,
  });
}
