import { describe, expect, it } from 'vitest';
import {
  getLoginErrorMessage,
  isHandledAuthClientError,
} from '../auth-error-messages';

describe('getLoginErrorMessage', () => {
  const t = (key: string) => key;

  it('maps raw credential errors to a localized key', () => {
    expect(getLoginErrorMessage(401, 'Invalid email or password', t)).toBe(
      'invalidCredentials'
    );
  });

  it('maps credential error codes to a localized key when message is missing', () => {
    expect(
      getLoginErrorMessage(undefined, undefined, t, 'INVALID_EMAIL_OR_PASSWORD')
    ).toBe('invalidCredentials');
  });

  it('maps verification errors to a localized key', () => {
    expect(getLoginErrorMessage(403, 'Email not verified', t)).toBe(
      'emailNotVerified'
    );
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(getLoginErrorMessage(500, 'Internal error', t)).toBe('loginFailed');
  });

  it('treats handled client auth failures as non-fatal', () => {
    expect(isHandledAuthClientError(401, 'Invalid email or password')).toBe(
      true
    );
    expect(isHandledAuthClientError(429, 'Too many attempts')).toBe(true);
    expect(isHandledAuthClientError(undefined, 'access_denied')).toBe(true);
    expect(
      isHandledAuthClientError(
        undefined,
        undefined,
        'INVALID_EMAIL_OR_PASSWORD'
      )
    ).toBe(true);
  });

  it('keeps unexpected client and server failures as errors', () => {
    expect(isHandledAuthClientError(400, 'Bad request')).toBe(false);
    expect(isHandledAuthClientError(401, 'Failed to create session')).toBe(
      false
    );
    expect(isHandledAuthClientError(500, 'Internal server error')).toBe(false);
  });
});
