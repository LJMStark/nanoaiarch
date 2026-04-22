const TEMP_ID_PREFIX = 'temp-';

export function isTemporaryId(id?: string | null): boolean {
  return typeof id === 'string' && id.startsWith(TEMP_ID_PREFIX);
}
