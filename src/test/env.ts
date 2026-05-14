export const TEST_BASE_URL = 'http://localhost:3000';

export function applyTestBaseUrl(): void {
  process.env.NEXT_PUBLIC_BASE_URL = TEST_BASE_URL;
}
