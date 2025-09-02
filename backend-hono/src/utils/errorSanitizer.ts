/**
 * Utility to sanitize error objects and prevent token leakage in logs
 */

const SENSITIVE_PATTERNS = [
  /access_token/gi,
  /refresh_token/gi,
  /accessToken/gi,
  /refreshToken/gi,
  /bearer\s+[\w-]+/gi,
  /jwt\s+[\w.-]+/gi,
  /oauth_token/gi,
  /api_key/gi,
  /client_secret/gi,
  /password/gi,
  /authorization:\s*bearer\s+[\w.-]+/gi,
  /authorization:\s*basic\s+[\w=+/]+/gi
];

const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key', 
  'x-auth-token',
  'cookie',
  'set-cookie'
];

/**
 * Sanitize error object to remove sensitive information
 */
export function sanitizeError(error: any): any {
  if (!error) return error;

  // Handle primitive types
  if (typeof error === 'string') {
    return sanitizeString(error);
  }

  if (typeof error !== 'object') {
    return error;
  }

  // Handle Error objects
  if (error instanceof Error) {
    const sanitized: any = {
      name: error.name,
      message: sanitizeString(error.message),
      stack: sanitizeString(error.stack || ''),
    };

    // Add any additional enumerable properties (but sanitize them)
    for (const key in error) {
      if (error.hasOwnProperty(key) && !['name', 'message', 'stack'].includes(key)) {
        const errorObj = error as any;
        sanitized[key] = sanitizeValue(errorObj[key]);
      }
    }

    return sanitized;
  }

  // Handle arrays
  if (Array.isArray(error)) {
    return error.map(item => sanitizeValue(item));
  }

  // Handle plain objects
  const sanitized: any = {};
  for (const key in error) {
    if (error.hasOwnProperty(key)) {
      // Skip sensitive headers
      if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Sanitize the value
      sanitized[key] = sanitizeValue(error[key]);
    }
  }

  return sanitized;
}

/**
 * Recursively sanitize any value
 */
function sanitizeValue(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'object') {
    return sanitizeError(value);
  }

  return value;
}

/**
 * Sanitize string content to remove sensitive patterns
 */
function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') {
    return str;
  }

  let sanitized = str;

  // Replace sensitive patterns with [REDACTED]
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
}

/**
 * Safe console.error that automatically sanitizes error objects
 */
export function safeConsoleError(message: string, error?: any): void {
  if (error) {
    const sanitized = sanitizeError(error);
    console.error(message, sanitized);
  } else {
    console.error(message);
  }
}

/**
 * Safe console.log that automatically sanitizes objects
 */
export function safeConsoleLog(message: string, data?: any): void {
  if (data) {
    const sanitized = sanitizeError(data);
    console.log(message, sanitized);
  } else {
    console.log(message);
  }
}

/**
 * Create a sanitized error response for API responses (without message property)
 */
export function createSafeErrorResponse(error: any): { details?: any } {
  const sanitized = sanitizeError(error);
  
  return {
    ...(process.env.NODE_ENV === 'development' && { details: sanitized })
  };
}