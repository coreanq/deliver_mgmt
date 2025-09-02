/**
 * Secure template replacement engine to prevent injection attacks
 */

/**
 * Sanitize and escape text content to prevent injection attacks
 */
function sanitizeText(text: any): string {
  if (text === null || text === undefined) {
    return '';
  }
  
  const str = String(text);
  
  // Remove potentially dangerous characters and sequences
  return str
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
    .replace(/[<>&"']/g, (char) => { // HTML/XML escape
      switch (char) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&#x27;';
        default: return char;
      }
    })
    .replace(/\${.*?}/g, '') // Remove potential script injection patterns
    .replace(/\$\{/g, '') // Remove remaining injection patterns
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/data:/gi, '') // Remove data: URLs
    .replace(/vbscript:/gi, '') // Remove vbscript: URLs
    .trim();
}

/**
 * Validate column name to prevent injection
 */
function isValidColumnName(columnName: string): boolean {
  // Only allow alphanumeric characters, Korean characters, spaces, and common punctuation
  const validPattern = /^[a-zA-Z0-9가-힣\s\-_.,()[\]]+$/;
  
  // Reject if too long or contains suspicious patterns
  if (columnName.length > 100) return false;
  if (columnName.includes('\\') || columnName.includes('/')) return false;
  if (columnName.includes('<script') || columnName.includes('javascript:')) return false;
  
  return validPattern.test(columnName);
}

/**
 * Secure template variable replacement
 */
export function replaceTemplateVariables(
  template: string, 
  rowData: { [key: string]: any },
  options: {
    maxLength?: number;
    allowedColumns?: string[];
  } = {}
): string {
  if (!template || typeof template !== 'string') {
    return '';
  }

  const { maxLength = 2000, allowedColumns } = options;
  
  // Limit template length to prevent DoS
  if (template.length > maxLength) {
    throw new Error(`템플릿이 너무 깁니다. 최대 ${maxLength}자까지 허용됩니다.`);
  }

  let message = template;
  const processedColumns = new Set<string>();
  
  // Use a safer approach than RegExp constructor
  // Match #{columnName} patterns
  const variablePattern = /#\{([^}]+)\}/g;
  let match;
  
  while ((match = variablePattern.exec(template)) !== null) {
    const fullMatch = match[0]; // #{columnName}
    const columnName = match[1]; // columnName
    
    // Prevent infinite loops
    if (processedColumns.has(columnName)) {
      continue;
    }
    processedColumns.add(columnName);
    
    // Validate column name
    if (!isValidColumnName(columnName)) {
      console.warn(`Invalid column name in template: ${columnName}`);
      continue;
    }
    
    // Check if column is in allowlist (if provided)
    if (allowedColumns && !allowedColumns.includes(columnName)) {
      console.warn(`Column not in allowlist: ${columnName}`);
      continue;
    }
    
    // Get and sanitize the value
    const rawValue = rowData[columnName];
    const sanitizedValue = sanitizeText(rawValue);
    
    // Replace using string replacement (safer than RegExp)
    // Use a global replace to handle multiple instances
    const escapedPattern = fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedPattern, 'g');
    message = message.replace(regex, sanitizedValue);
  }

  // Final sanitization
  message = sanitizeText(message);
  
  // Limit final message length
  if (message.length > maxLength) {
    message = message.substring(0, maxLength - 3) + '...';
  }

  return message;
}

/**
 * Calculate message byte size for SMS/LMS detection
 * Korean characters = 2 bytes, ASCII = 1 byte
 */
export function calculateMessageBytes(message: string): number {
  let bytes = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charAt(i);
    // Korean characters (Hangul)
    if (char.match(/[가-힣]/)) {
      bytes += 2;
    } else {
      bytes += 1;
    }
  }
  return bytes;
}

/**
 * Validate automation rule message template
 */
export function validateMessageTemplate(template: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!template || typeof template !== 'string') {
    errors.push('메시지 템플릿은 필수입니다.');
    return { isValid: false, errors, warnings };
  }
  
  if (template.length > 1000) {
    errors.push('메시지 템플릿이 너무 깁니다. (최대 1000자)');
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /javascript:/gi,
    /vbscript:/gi,
    /data:/gi,
    /<script/gi,
    /on\w+\s*=/gi, // Event handlers like onclick=
    /eval\s*\(/gi,
    /function\s*\(/gi,
    /\${.*}/g, // Template literal injection
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(template)) {
      errors.push('메시지 템플릿에 허용되지 않는 패턴이 포함되어 있습니다.');
      break;
    }
  }
  
  // Check for valid variable syntax
  const variablePattern = /#\{([^}]+)\}/g;
  let match;
  const variables: string[] = [];
  
  while ((match = variablePattern.exec(template)) !== null) {
    const columnName = match[1];
    
    if (!isValidColumnName(columnName)) {
      errors.push(`유효하지 않은 변수명: ${columnName}`);
    } else {
      variables.push(columnName);
    }
  }
  
  if (variables.length === 0) {
    warnings.push('메시지 템플릿에 변수가 포함되지 않았습니다.');
  }
  
  if (variables.length > 10) {
    warnings.push('메시지 템플릿에 변수가 너무 많습니다. (최대 10개 권장)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}