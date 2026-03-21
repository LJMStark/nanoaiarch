import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from '../login-form';

const { signInEmailMock, authWarnMock, authErrorMock } = vi.hoisted(() => ({
  signInEmailMock: vi.fn(),
  authWarnMock: vi.fn(),
  authErrorMock: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      email: signInEmailMock,
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    auth: {
      debug: vi.fn(),
      warn: authWarnMock,
      error: authErrorMock,
    },
  },
}));

vi.mock('@/actions/validate-captcha', () => ({
  validateCaptchaAction: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  LocaleLink: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../social-login-button', () => ({
  SocialLoginButton: () => null,
}));

describe('LoginForm', () => {
  beforeEach(() => {
    signInEmailMock.mockReset();
    authWarnMock.mockReset();
    authErrorMock.mockReset();
  });

  it('shows a credential error message and logs it as a warning', async () => {
    signInEmailMock.mockImplementation(
      async (
        _values: unknown,
        callbacks: {
          onRequest?: () => void;
          onResponse?: () => void;
          onError?: (ctx: {
            error: {
              status?: number;
              message?: string;
              code?: string;
            };
          }) => void;
        }
      ) => {
        callbacks.onRequest?.();
        callbacks.onResponse?.();
        callbacks.onError?.({
          error: {
            status: 401,
            code: 'INVALID_EMAIL_OR_PASSWORD',
          },
        });
      }
    );

    const user = userEvent.setup();

    render(<LoginForm callbackUrl="/zh/ai/image" />);

    await user.type(screen.getByLabelText('email'), 'nobody@example.com');
    await user.type(screen.getByPlaceholderText('******'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'signIn' }));

    expect(await screen.findByText('invalidCredentials')).toBeInTheDocument();

    await waitFor(() => {
      expect(authWarnMock).toHaveBeenCalledWith('login rejected', {
        status: 401,
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: undefined,
      });
    });
    expect(authErrorMock).not.toHaveBeenCalled();
  });

  it('keeps unexpected client failures as errors', async () => {
    signInEmailMock.mockImplementation(
      async (
        _values: unknown,
        callbacks: {
          onRequest?: () => void;
          onResponse?: () => void;
          onError?: (ctx: {
            error: {
              status?: number;
              message?: string;
              code?: string;
            };
          }) => void;
        }
      ) => {
        callbacks.onRequest?.();
        callbacks.onResponse?.();
        callbacks.onError?.({
          error: {
            status: 400,
            message: 'Bad request',
          },
        });
      }
    );

    const user = userEvent.setup();

    render(<LoginForm callbackUrl="/zh/ai/image" />);

    await user.type(screen.getByLabelText('email'), 'nobody@example.com');
    await user.type(screen.getByPlaceholderText('******'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'signIn' }));

    expect(await screen.findByText('loginFailed')).toBeInTheDocument();

    await waitFor(() => {
      expect(authErrorMock).toHaveBeenCalledWith(
        'login error',
        expect.objectContaining({
          status: 400,
          message: 'Bad request',
        }),
        {
          status: 400,
          code: undefined,
          message: 'Bad request',
        }
      );
    });
    expect(authWarnMock).not.toHaveBeenCalled();
  });
});
