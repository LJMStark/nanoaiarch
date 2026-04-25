import { beforeEach, describe, expect, it, vi } from 'vitest';

const subscribeMock = vi.fn();
const isNewsletterConfiguredMock = vi.fn();
const scheduleNewsletterSubscribeJobMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('@/newsletter', () => ({
  subscribe: subscribeMock,
  isNewsletterConfigured: isNewsletterConfiguredMock,
}));

vi.mock('../jobs', () => ({
  scheduleNewsletterSubscribeJob: scheduleNewsletterSubscribeJobMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    newsletter: {
      warn: loggerWarnMock,
      error: loggerErrorMock,
    },
  },
}));

describe('ensureNewsletterSignupSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNewsletterConfiguredMock.mockReturnValue(true);
  });

  it('subscribes immediately and skips queueing when provider succeeds', async () => {
    subscribeMock.mockResolvedValueOnce(true);

    const { ensureNewsletterSignupSubscription } = await import('../signup');
    const result = await ensureNewsletterSignupSubscription({
      userId: 'user-1',
      email: 'user@example.com',
    });

    expect(subscribeMock).toHaveBeenCalledWith('user@example.com');
    expect(scheduleNewsletterSubscribeJobMock).not.toHaveBeenCalled();
    expect(result).toEqual({ delivered: true, queued: false, skipped: false });
  });

  it('queues a retry when the immediate subscription attempt fails', async () => {
    subscribeMock.mockResolvedValueOnce(false);
    scheduleNewsletterSubscribeJobMock.mockResolvedValueOnce(undefined);

    const { ensureNewsletterSignupSubscription } = await import('../signup');
    const result = await ensureNewsletterSignupSubscription({
      userId: 'user-2',
      email: 'retry@example.com',
    });

    expect(scheduleNewsletterSubscribeJobMock).toHaveBeenCalledWith({
      userId: 'user-2',
      email: 'retry@example.com',
    });
    expect(loggerWarnMock).toHaveBeenCalled();
    expect(result).toEqual({ delivered: false, queued: true, skipped: false });
  });

  it('skips entirely when the newsletter provider is not configured', async () => {
    isNewsletterConfiguredMock.mockReturnValue(false);

    const { ensureNewsletterSignupSubscription } = await import('../signup');
    const result = await ensureNewsletterSignupSubscription({
      userId: 'user-3',
      email: 'noconfig@example.com',
    });

    expect(subscribeMock).not.toHaveBeenCalled();
    expect(scheduleNewsletterSubscribeJobMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ delivered: false, queued: false, skipped: true });
  });
});
