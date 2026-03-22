import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LayoutError from '../error';

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useLocaleRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

describe('LayoutError', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it('refreshes the current route for regular errors', async () => {
    const user = userEvent.setup();
    const resetMock = vi.fn();
    const reloadMock = vi.fn();

    vi.stubGlobal('location', {
      ...window.location,
      reload: reloadMock,
    });

    render(
      <LayoutError error={new Error('server exploded')} reset={resetMock} />
    );

    await user.click(screen.getByRole('button', { name: 'tryAgain' }));

    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(resetMock).toHaveBeenCalledTimes(1);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('reloads the page when a chunk fails to load', async () => {
    const user = userEvent.setup();
    const resetMock = vi.fn();
    const reloadMock = vi.fn();

    vi.stubGlobal('location', {
      ...window.location,
      reload: reloadMock,
    });

    const error = Object.assign(
      new Error(
        'ChunkLoadError: Failed to load chunk /_next/static/chunks/856f1cd8cbe8fb8c.js'
      ),
      {
        name: 'ChunkLoadError',
      }
    );

    render(<LayoutError error={error} reset={resetMock} />);

    await user.click(screen.getByRole('button', { name: 'tryAgain' }));

    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(refreshMock).not.toHaveBeenCalled();
    expect(resetMock).not.toHaveBeenCalled();
  });
});
