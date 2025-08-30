import type { Env, UserProfile, UserSession, GoogleTokens, AutomationRule } from '../types';

/**
 * Google 계정 기반 사용자 세션 관리 서비스
 * 세션이 끊어져도 Google 이메일 기반으로 데이터 영속성 보장
 */
export class UserSessionService {
  constructor(private env: Env) {}

  /**
   * Google 이메일에서 유효한 키 생성 (특수문자 처리)
   */
  private sanitizeEmail(email: string): string {
    return email.toLowerCase().replace(/[^a-zA-Z0-9@.-]/g, '_');
  }

  /**
   * 사용자 프로필 저장 (Google + SOLAPI 토큰 포함)
   */
  async saveUserProfile(email: string, googleTokens: GoogleTokens, solapiTokens?: any): Promise<void> {
    const sanitizedEmail = this.sanitizeEmail(email);
    const userKey = `user_profile:${sanitizedEmail}`;
    
    const profile: UserProfile = {
      email: sanitizedEmail,
      googleTokens,
      solapiTokens,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    // 사용자 프로필 저장 (1년 보관)
    await this.env.SESSIONS.put(userKey, JSON.stringify(profile), { 
      expirationTtl: 31536000 // 1년 (365 * 24 * 60 * 60)
    });

    console.log(`User profile saved for: ${sanitizedEmail}`);
  }

  /**
   * 사용자 프로필 조회
   */
  async getUserProfile(email: string): Promise<UserProfile | null> {
    const sanitizedEmail = this.sanitizeEmail(email);
    const userKey = `user_profile:${sanitizedEmail}`;
    
    try {
      const profileData = await this.env.SESSIONS.get(userKey);
      if (!profileData) return null;
      
      return JSON.parse(profileData) as UserProfile;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }

  /**
   * 자동화 규칙 저장 (Google 계정별 영구 저장)
   */
  async saveAutomationRules(email: string, rules: AutomationRule[]): Promise<void> {
    const sanitizedEmail = this.sanitizeEmail(email);
    const rulesKey = `automation_rules:${sanitizedEmail}`;
    
    // 자동화 규칙 영구 저장 (1년 보관)
    await this.env.SESSIONS.put(rulesKey, JSON.stringify(rules), {
      expirationTtl: 31536000 // 1년
    });

    console.log(`Automation rules saved for ${sanitizedEmail}: ${rules.length} rules`);
  }

  /**
   * 자동화 규칙 조회 (Google 계정별)
   */
  async getAutomationRules(email: string): Promise<AutomationRule[]> {
    const sanitizedEmail = this.sanitizeEmail(email);
    const rulesKey = `automation_rules:${sanitizedEmail}`;
    
    try {
      const rulesData = await this.env.SESSIONS.get(rulesKey);
      if (!rulesData) return [];
      
      return JSON.parse(rulesData) as AutomationRule[];
    } catch (error) {
      console.error('Failed to get automation rules:', error);
      return [];
    }
  }

  /**
   * 활성 세션 등록 (브라우저별 세션 추적)
   */
  async registerSession(email: string, sessionId: string, userAgent?: string): Promise<void> {
    const sanitizedEmail = this.sanitizeEmail(email);
    const sessionKey = `user_sessions:${sanitizedEmail}`;
    
    const session: UserSession = {
      email: sanitizedEmail,
      sessionId,
      createdAt: new Date().toISOString(),
      lastAccessAt: new Date().toISOString(),
      userAgent
    };

    // 세션 정보 저장 (24시간)
    await this.env.SESSIONS.put(sessionKey, JSON.stringify(session), {
      expirationTtl: 86400 // 24시간
    });

    // 기존 세션 방식도 병행 유지 (하위 호환성)
    await this.env.SESSIONS.put(sessionId, JSON.stringify({
      ...session,
      email: sanitizedEmail
    }), { expirationTtl: 86400 });
  }

  /**
   * 사용자 세션 조회
   */
  async getUserSession(email: string): Promise<UserSession | null> {
    const sanitizedEmail = this.sanitizeEmail(email);
    const sessionKey = `user_sessions:${sanitizedEmail}`;
    
    try {
      const sessionData = await this.env.SESSIONS.get(sessionKey);
      if (!sessionData) return null;
      
      return JSON.parse(sessionData) as UserSession;
    } catch (error) {
      console.error('Failed to get user session:', error);
      return null;
    }
  }

  /**
   * Google 이메일 추출 (Google OAuth 토큰에서)
   */
  async extractGoogleEmail(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        console.error('Failed to get Google user info:', response.status);
        return null;
      }

      const userInfo = await response.json();
      return userInfo.email || null;
    } catch (error) {
      console.error('Error extracting Google email:', error);
      return null;
    }
  }

  /**
   * 세션에서 이메일 조회 (하위 호환성)
   */
  async getEmailFromSession(sessionId: string): Promise<string | null> {
    try {
      const sessionData = await this.env.SESSIONS.get(sessionId);
      if (!sessionData) return null;
      
      const session = JSON.parse(sessionData);
      return session.email || null;
    } catch (error) {
      console.error('Failed to get email from session:', error);
      return null;
    }
  }

  /**
   * 사용자 데이터 정리 (로그아웃시)
   */
  async cleanupUserSession(email: string, sessionId?: string): Promise<void> {
    const sanitizedEmail = this.sanitizeEmail(email);
    
    // 활성 세션만 정리 (사용자 프로필과 자동화 규칙은 유지)
    const sessionKey = `user_sessions:${sanitizedEmail}`;
    await this.env.SESSIONS.delete(sessionKey);
    
    if (sessionId) {
      await this.env.SESSIONS.delete(sessionId);
    }

    console.log(`Session cleaned up for: ${sanitizedEmail}`);
  }
}