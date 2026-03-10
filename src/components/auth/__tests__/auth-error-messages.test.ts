import { describe, expect, it } from 'vitest';
import { getLoginErrorMessage } from '../auth-error-messages';

describe('getLoginErrorMessage', () => {
  const t = (key: string) => key;

  it('maps raw credential errors to a localized key', () => {
    expect(getLoginErrorMessage(401, 'Invalid email or password', t)).toBe(
      'invalidCredentials'
    );
  });

  it('maps verification errors to a localized key', () => {
    expect(getLoginErrorMessage(403, 'Email not verified', t)).toBe(
      'emailNotVerified'
    );
  });

  it('falls back to a generic message for unknown errors', () => {
    expect(getLoginErrorMessage(500, 'Internal error', t)).toBe('loginFailed');
  });
});
