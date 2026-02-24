/**
 * Generates a deterministic fingerprint for an error based on its key properties.
 * Used to group duplicate errors and prevent noise.
 */
export function generateErrorFingerprint(error: Error): string {
  const parts: string[] = [
    error.name || 'UnknownError',
    error.message || '',
    extractRelevantStack(error.stack),
  ];

  return hashString(parts.join('|'));
}

/**
 * Extracts the most relevant stack frame (first non-library frame).
 */
function extractRelevantStack(stack?: string): string {
  if (!stack) return '';

  const lines = stack.split('\n').filter((line) => line.trim().startsWith('at '));
  const relevantLine = lines.find(
    (line) =>
      !line.includes('node_modules') &&
      !line.includes('datadog-frontend-toolkit') &&
      !line.includes('<anonymous>'),
  );

  return (relevantLine || lines[0] || '').trim();
}

/**
 * Simple but fast string hash (djb2 algorithm).
 * Produces a hex string fingerprint.
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generates a session-unique ID.
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}
