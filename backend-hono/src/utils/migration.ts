import type { Env, AutomationRule, UnifiedUserData, GoogleTokens } from '../types';
import { UnifiedUserService } from '../services/unifiedUserService';

/**
 * 세션 기반 데이터를 통합 구조로 마이그레이션하는 유틸리티
 */
export class MigrationService {
  constructor(private env: Env) {}

  /**
   * 특정 세션의 데이터를 통합 구조로 마이그레이션
   */
  async migrateSessionToUnified(sessionId: string): Promise<boolean> {
    try {
      const sessionDataRaw = await this.env.SESSIONS.get(sessionId);
      if (!sessionDataRaw) {
        console.log(`No session data found for: ${sessionId}`);
        return false;
      }

      const sessionData = JSON.parse(sessionDataRaw);
      
      // 이메일이 없으면 마이그레이션 불가능
      if (!sessionData.email) {
        console.log(`No email found in session: ${sessionId}`);
        return false;
      }

      const unifiedUserService = new UnifiedUserService(this.env);
      const userEmail = sessionData.email;

      // 기존 통합 데이터가 있는지 확인
      let existingUserData = await unifiedUserService.getUserData(userEmail);

      if (existingUserData) {
        console.log(`User data already exists for: ${userEmail}, checking for additional rules...`);
        
        // 세션에만 있는 자동화 룰이 있는지 확인
        const sessionRules = sessionData.automationRules || [];
        const existingRuleIds = existingUserData.automationRules.map(rule => rule.id);
        
        let addedRules = 0;
        for (const sessionRule of sessionRules) {
          if (!existingRuleIds.includes(sessionRule.id)) {
            // 룰에 사용자 이메일 설정
            sessionRule.userEmail = userEmail;
            existingUserData.automationRules.push(sessionRule);
            addedRules++;
          }
        }

        if (addedRules > 0) {
          await unifiedUserService.saveUserData(existingUserData);
          console.log(`Migrated ${addedRules} additional rules for: ${userEmail}`);
        } else {
          console.log(`No additional rules to migrate for: ${userEmail}`);
        }

        return addedRules > 0;
      }

      // 새로운 통합 데이터 생성
      const googleTokens: GoogleTokens = {
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken,
        connectedAt: sessionData.connectedAt || new Date().toISOString(),
        expiryDate: sessionData.expiryDate,
        email: userEmail,
        solapiTokens: sessionData.solapiTokens
      };

      // 세션의 자동화 룰들을 마이그레이션
      const automationRules: AutomationRule[] = (sessionData.automationRules || []).map((rule: any) => ({
        ...rule,
        userEmail: userEmail // 사용자 이메일 설정
      }));

      const unifiedData: UnifiedUserData = {
        email: userEmail,
        emailHash: '', // UnifiedUserService에서 자동 생성됨
        googleTokens,
        solapiTokens: sessionData.solapiTokens,
        automationRules,
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await unifiedUserService.saveUserData(unifiedData);
      
      console.log(`Successfully migrated session ${sessionId} to unified structure for user: ${userEmail}`);
      console.log(`  - ${automationRules.length} automation rules migrated`);
      console.log(`  - Google tokens migrated`);
      if (sessionData.solapiTokens) {
        console.log(`  - SOLAPI tokens migrated`);
      }

      return true;
    } catch (error) {
      console.error(`Failed to migrate session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * 모든 세션 데이터를 스캔하여 마이그레이션 가능한 것들을 찾음
   * 실제로는 KV에서 모든 키를 나열할 수 없으므로 알려진 세션 ID들을 사용해야 함
   */
  async scanAndMigrateAllSessions(knownSessionIds: string[]): Promise<{ migrated: number; failed: number }> {
    let migrated = 0;
    let failed = 0;

    console.log(`Starting migration for ${knownSessionIds.length} known sessions...`);

    for (const sessionId of knownSessionIds) {
      try {
        const success = await this.migrateSessionToUnified(sessionId);
        if (success) {
          migrated++;
        }
      } catch (error) {
        console.error(`Failed to migrate session ${sessionId}:`, error);
        failed++;
      }
    }

    console.log(`Migration completed: ${migrated} migrated, ${failed} failed`);
    return { migrated, failed };
  }

  /**
   * 특정 사용자의 마이그레이션 상태 확인
   */
  async checkMigrationStatus(userEmail: string): Promise<{
    hasUnifiedData: boolean;
    hasSessionData: boolean;
    automationRulesCount: number;
    lastUpdated?: string;
  }> {
    const unifiedUserService = new UnifiedUserService(this.env);
    
    // 통합 데이터 확인
    const unifiedData = await unifiedUserService.getUserData(userEmail);
    
    return {
      hasUnifiedData: !!unifiedData,
      hasSessionData: false, // 세션 ID 없이는 확인 불가능
      automationRulesCount: unifiedData?.automationRules.length || 0,
      lastUpdated: unifiedData?.updatedAt
    };
  }

  /**
   * 마이그레이션 후 세션 데이터 정리 (선택적)
   * 주의: 이 작업은 되돌릴 수 없음
   */
  async cleanupMigratedSessionData(sessionId: string, userEmail: string): Promise<boolean> {
    try {
      // 통합 데이터가 존재하는지 확인
      const unifiedUserService = new UnifiedUserService(this.env);
      const unifiedData = await unifiedUserService.getUserData(userEmail);
      
      if (!unifiedData) {
        console.log(`Cannot cleanup session ${sessionId}: no unified data found for ${userEmail}`);
        return false;
      }

      // 세션에서 자동화 룰과 기타 마이그레이션된 데이터만 제거
      // 기본 세션 정보(토큰 등)는 유지
      const sessionDataRaw = await this.env.SESSIONS.get(sessionId);
      if (sessionDataRaw) {
        const sessionData = JSON.parse(sessionDataRaw);
        
        // 자동화 룰 제거
        delete sessionData.automationRules;
        
        // 정리된 세션 데이터 저장
        await this.env.SESSIONS.put(sessionId, JSON.stringify(sessionData), {
          expirationTtl: 86400 // 24시간
        });
        
        console.log(`Cleaned up migrated data from session: ${sessionId}`);
      }

      return true;
    } catch (error) {
      console.error(`Failed to cleanup session ${sessionId}:`, error);
      return false;
    }
  }
}

/**
 * 마이그레이션 헬퍼 함수들
 */

export async function migrateUserSession(env: Env, sessionId: string): Promise<boolean> {
  const migrationService = new MigrationService(env);
  return await migrationService.migrateSessionToUnified(sessionId);
}

export async function getMigrationStatus(env: Env, userEmail: string) {
  const migrationService = new MigrationService(env);
  return await migrationService.checkMigrationStatus(userEmail);
}