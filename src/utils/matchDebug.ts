const MATCH_DEBUG_PREFIX = '[match]';

export function logMatchDebug(message: string, context?: Record<string, unknown>) {
  if (!import.meta.env.DEV) {
    return;
  }

  if (context) {
    console.info(`${MATCH_DEBUG_PREFIX} ${message}`, context);
    return;
  }

  console.info(`${MATCH_DEBUG_PREFIX} ${message}`);
}
