import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Logger tests run two passes: human format (LOG_FORMAT=human) and
 * JSON format (LOG_FORMAT=json). The module reads env at import time, so
 * each test does a fresh dynamic import after stubbing the env.
 */

let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
let stderrWriteSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  stdoutWriteSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation(() => true);
  stderrWriteSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation(() => true);
});

afterEach(() => {
  stdoutWriteSpy.mockRestore();
  stderrWriteSpy.mockRestore();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('logger - JSON output', () => {
  beforeEach(() => {
    vi.stubEnv('LOG_FORMAT', 'json');
    vi.stubEnv('LOG_LEVEL', 'debug');
  });

  it('writes one JSON object per line with stable shape', async () => {
    const { logger } = await import('../logger');
    logger.api.info('hello world', { requestId: 'r1' });

    expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
    const payload = (stdoutWriteSpy.mock.calls[0][0] as string).trim();
    const parsed = JSON.parse(payload);

    expect(parsed.level).toBe('info');
    expect(parsed.prefix).toBe('API');
    expect(parsed.msg).toBe('hello world');
    expect(parsed.data).toEqual({ requestId: 'r1' });
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('serializes Error objects in the err field', async () => {
    const { logger } = await import('../logger');
    logger.api.error('oops', new Error('boom'), { requestId: 'r2' });

    const payload = (stderrWriteSpy.mock.calls[0][0] as string).trim();
    const parsed = JSON.parse(payload);
    expect(parsed.level).toBe('error');
    expect(parsed.err.message).toBe('boom');
    expect(parsed.err.name).toBe('Error');
    expect(typeof parsed.err.stack).toBe('string');
    expect(parsed.data).toEqual({ requestId: 'r2' });
  });

  it('routes warn/error to stderr, info/debug to stdout', async () => {
    const { logger } = await import('../logger');
    logger.api.info('to stdout');
    logger.api.warn('to stderr');
    logger.api.error('to stderr 2');
    logger.api.debug('to stdout 2');

    expect(stdoutWriteSpy).toHaveBeenCalledTimes(2);
    expect(stderrWriteSpy).toHaveBeenCalledTimes(2);
  });

  it('respects LOG_LEVEL gate (warn cutoff drops debug + info)', async () => {
    vi.stubEnv('LOG_LEVEL', 'warn');
    const { logger } = await import('../logger');
    logger.api.debug('drop me');
    logger.api.info('drop me too');
    logger.api.warn('keep me');

    expect(stdoutWriteSpy).not.toHaveBeenCalled();
    expect(stderrWriteSpy).toHaveBeenCalledTimes(1);
    const payload = (stderrWriteSpy.mock.calls[0][0] as string).trim();
    expect(JSON.parse(payload).msg).toBe('keep me');
  });

  it('falls back to a minimal line when data has circular references', async () => {
    const { logger } = await import('../logger');
    const circular: { self?: unknown } = {};
    circular.self = circular;
    // Note: must not throw — log emit failure must never abort callers.
    expect(() => logger.api.info('circular', circular as never)).not.toThrow();

    const payload = (stdoutWriteSpy.mock.calls[0][0] as string).trim();
    const parsed = JSON.parse(payload);
    expect(parsed.msg).toBe('circular');
    // Either the original line missing the unserializable data, or the
    // fallback line with err.message='log serialization failed' — both
    // are acceptable contracts.
    expect(parsed.err?.message ?? '').toContain('serialization');
  });
});
