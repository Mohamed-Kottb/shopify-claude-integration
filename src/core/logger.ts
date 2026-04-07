type LogData = Record<string, unknown> | unknown[] | string | number | null;

export const logger = {
  info: (message: string, data?: LogData): void => {
    console.log(`[INFO]  ${timestamp()} ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
  },
  warn: (message: string, data?: LogData): void => {
    console.warn(`[WARN]  ${timestamp()} ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
  },
  error: (message: string, error?: unknown): void => {
    console.error(`[ERROR] ${timestamp()} ${message}`, error instanceof Error ? error.message : error);
  },
  success: (message: string, data?: LogData): void => {
    console.log(`[OK]    ${timestamp()} ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
  },
};

function timestamp(): string {
  return new Date().toISOString();
}
