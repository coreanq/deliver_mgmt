import crypto from 'crypto'

/**
 * 보안 관련 유틸리티 서비스
 */
export class SecurityService {
  private static readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '32_character_secret_key_here!!'
  private static readonly ALGORITHM = 'aes-256-gcm'

  /**
   * 전화번호 암호화
   */
  static encryptPhone(phoneNumber: string): string {
    if (!phoneNumber) return ''

    try {
      // 16바이트 IV 생성
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipher(this.ALGORITHM, this.ENCRYPTION_KEY)
      cipher.setAAD(Buffer.from('phone', 'utf8'))

      let encrypted = cipher.update(phoneNumber, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      const authTag = cipher.getAuthTag()
      
      // IV + AuthTag + 암호화된 데이터를 결합
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
    } catch (error) {
      console.error('전화번호 암호화 실패:', error)
      throw new Error('전화번호 암호화에 실패했습니다.')
    }
  }

  /**
   * 전화번호 복호화
   */
  static decryptPhone(encryptedPhone: string): string {
    if (!encryptedPhone) return ''

    try {
      const parts = encryptedPhone.split(':')
      if (parts.length !== 3) {
        throw new Error('잘못된 암호화 형식입니다.')
      }

      const iv = Buffer.from(parts[0], 'hex')
      const authTag = Buffer.from(parts[1], 'hex')
      const encrypted = parts[2]

      const decipher = crypto.createDecipher(this.ALGORITHM, this.ENCRYPTION_KEY)
      decipher.setAAD(Buffer.from('phone', 'utf8'))
      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      console.error('전화번호 복호화 실패:', error)
      throw new Error('전화번호 복호화에 실패했습니다.')
    }
  }

  /**
   * 전화번호 마스킹 (로그용)
   */
  static maskPhone(phoneNumber: string): string {
    if (!phoneNumber) return ''
    
    // 010-1234-5678 -> 010-****-5678
    if (phoneNumber.length === 11) {
      return phoneNumber.substring(0, 3) + '-****-' + phoneNumber.substring(7)
    }
    
    // 일반적인 마스킹
    if (phoneNumber.length > 4) {
      return phoneNumber.substring(0, 3) + '*'.repeat(phoneNumber.length - 6) + phoneNumber.substring(phoneNumber.length - 3)
    }
    
    return '****'
  }

  /**
   * 전화번호 유효성 검증
   */
  static validatePhoneNumber(phoneNumber: string): boolean {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return false
    }

    // 한국 전화번호 패턴
    const koreanPhonePattern = /^01[0-9]-?\d{3,4}-?\d{4}$/
    const generalPhonePattern = /^(\d{2,3})-?(\d{3,4})-?(\d{4})$/
    
    const digitsOnly = phoneNumber.replace(/[^\d]/g, '')
    
    return koreanPhonePattern.test(phoneNumber) || 
           generalPhonePattern.test(phoneNumber) ||
           (digitsOnly.length >= 8 && digitsOnly.length <= 11)
  }

  /**
   * 전화번호 정규화 (형식 통일)
   */
  static normalizePhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) return ''
    
    // 숫자만 추출
    const digitsOnly = phoneNumber.replace(/[^\d]/g, '')
    
    // 11자리 휴대폰 번호 (010-1234-5678)
    if (digitsOnly.length === 11 && digitsOnly.startsWith('01')) {
      return `${digitsOnly.substring(0, 3)}-${digitsOnly.substring(3, 7)}-${digitsOnly.substring(7)}`
    }
    
    // 10자리 일반전화 (02-1234-5678)
    if (digitsOnly.length === 10) {
      return `${digitsOnly.substring(0, 2)}-${digitsOnly.substring(2, 6)}-${digitsOnly.substring(6)}`
    }
    
    // 9자리 일반전화 (031-123-4567)
    if (digitsOnly.length === 9) {
      return `${digitsOnly.substring(0, 3)}-${digitsOnly.substring(3, 6)}-${digitsOnly.substring(6)}`
    }
    
    return digitsOnly // 원본 숫자만 반환
  }

  /**
   * 데이터 해싱 (비가역적)
   */
  static hashData(data: string, salt?: string): string {
    const saltToUse = salt || crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(data, saltToUse, 10000, 64, 'sha256')
    
    return saltToUse + ':' + hash.toString('hex')
  }

  /**
   * 해시 검증
   */
  static verifyHash(data: string, hash: string): boolean {
    try {
      const [salt, originalHash] = hash.split(':')
      const dataHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha256')
      
      return originalHash === dataHash.toString('hex')
    } catch (error) {
      return false
    }
  }

  /**
   * 안전한 랜덤 문자열 생성
   */
  static generateSecureRandomString(length: number = 32): string {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length)
  }

  /**
   * 입력값 새니타이제이션 (SQL 인젝션 방지)
   */
  static sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') return ''
    
    return input
      .replace(/[<>]/g, '') // HTML 태그 제거
      .replace(/['"]/g, '') // 따옴표 제거
      .replace(/[;\\]/g, '') // SQL 인젝션 패턴 제거
      .trim()
  }

  /**
   * IP 주소 검증
   */
  static validateIpAddress(ip: string): boolean {
    if (!ip) return false
    
    // IPv4 패턴
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
    // IPv6 패턴 (간단한 형태)
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
    
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip) || ip === 'localhost'
  }

  /**
   * 의심스러운 활동 패턴 감지
   */
  static detectSuspiciousActivity(userAgent: string, ip: string): {
    suspicious: boolean,
    reasons: string[]
  } {
    const reasons: string[] = []
    let suspicious = false

    // 의심스러운 User-Agent 패턴
    const suspiciousUserAgents = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /python-requests/i,
      /curl/i,
      /wget/i
    ]

    if (suspiciousUserAgents.some(pattern => pattern.test(userAgent))) {
      suspicious = true
      reasons.push('의심스러운 User-Agent 감지')
    }

    // 개발 도구 감지 (일부 패턴)
    if (!userAgent || userAgent.length < 10) {
      suspicious = true
      reasons.push('비정상적인 User-Agent')
    }

    // 로컬이 아닌 IP에서 개발자 도구 사용
    if (!this.validateIpAddress(ip) || (!ip.includes('localhost') && !ip.includes('127.0.0.1') && !ip.startsWith('192.168.'))) {
      // 프로덕션 환경에서는 추가 검증 필요
    }

    return { suspicious, reasons }
  }

  /**
   * 민감한 정보 로그 필터링
   */
  static filterSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') return data

    const sensitiveKeys = ['password', 'secret', 'token', 'key', 'phone', 'email', 'ssn']
    const filtered = { ...data }

    Object.keys(filtered).forEach(key => {
      const lowerKey = key.toLowerCase()
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        filtered[key] = '[FILTERED]'
      } else if (typeof filtered[key] === 'object') {
        filtered[key] = this.filterSensitiveData(filtered[key])
      }
    })

    return filtered
  }

  /**
   * 보안 감사 로그 생성
   */
  static createAuditLog(action: string, userId: string, details: any = {}): void {
    const auditData = {
      timestamp: new Date().toISOString(),
      action,
      userId,
      details: this.filterSensitiveData(details),
      sessionId: crypto.randomUUID()
    }

    // 실제 구현에서는 보안 로그 시스템에 전송
    console.log('SECURITY_AUDIT:', JSON.stringify(auditData))
  }
}

export default SecurityService