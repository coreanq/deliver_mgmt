import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env, ApiResponse, Variables } from '../types';
import { MigrationService } from '../utils/migration';
import { UnifiedUserService } from '../services/unifiedUserService';

const migration = new Hono<{ Bindings: Env; Variables: Variables }>();

// UnifiedUserService 전역 설정
migration.use('*', async (c, next) => {
  c.set('unifiedUserService', new UnifiedUserService(c.env));
  await next();
});

// Session management helper functions
async function getSession(sessionId: string, env: Env): Promise<any | null> {
  try {
    const sessionData = await env.SESSIONS.get(sessionId);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch {
    return null;
  }
}

/**
 * 현재 세션의 데이터를 통합 구조로 마이그레이션
 */
migration.post('/migrate-session', async (c) => {
  try {
    const sessionId = getCookie(c, 'sessionId') || c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 필요합니다.',
      } as ApiResponse, 401);
    }

    const sessionData = await getSession(sessionId, c.env);
    
    if (!sessionData) {
      return c.json({
        success: false,
        message: '세션 데이터를 찾을 수 없습니다.',
      } as ApiResponse, 404);
    }

    if (!sessionData.email) {
      return c.json({
        success: false,
        message: '세션에 이메일 정보가 없어 마이그레이션할 수 없습니다.',
      } as ApiResponse, 400);
    }

    const migrationService = new MigrationService(c.env);
    const success = await migrationService.migrateSessionToUnified(sessionId);

    if (success) {
      return c.json({
        success: true,
        message: `세션 데이터가 통합 구조로 성공적으로 마이그레이션되었습니다. (${sessionData.email})`,
      } as ApiResponse);
    } else {
      return c.json({
        success: false,
        message: '마이그레이션 중 오류가 발생했거나 마이그레이션할 데이터가 없습니다.',
      } as ApiResponse, 500);
    }
  } catch (error: any) {
    console.error('Migration failed:', error);
    return c.json({
      success: false,
      message: '마이그레이션 중 오류가 발생했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * 마이그레이션 상태 확인
 */
migration.get('/status', async (c) => {
  try {
    const sessionId = getCookie(c, 'sessionId') || c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 필요합니다.',
      } as ApiResponse, 401);
    }

    const sessionData = await getSession(sessionId, c.env);
    
    if (!sessionData) {
      return c.json({
        success: false,
        message: '세션 데이터를 찾을 수 없습니다.',
      } as ApiResponse, 404);
    }

    let userEmail = sessionData.email;
    
    // 이메일이 세션에 없으면 추출 시도
    if (!userEmail && sessionData.accessToken) {
      const unifiedUserService = c.get('unifiedUserService');
      userEmail = await unifiedUserService.extractGoogleEmail(sessionData.accessToken);
    }

    if (!userEmail) {
      return c.json({
        success: false,
        message: '사용자 이메일을 찾을 수 없습니다.',
      } as ApiResponse, 400);
    }

    const migrationService = new MigrationService(c.env);
    const status = await migrationService.checkMigrationStatus(userEmail);

    const sessionRulesCount = (sessionData.automationRules || []).length;

    return c.json({
      success: true,
      data: {
        userEmail,
        sessionId: sessionId.substring(0, 8) + '***',
        hasUnifiedData: status.hasUnifiedData,
        unifiedRulesCount: status.automationRulesCount,
        sessionRulesCount,
        needsMigration: sessionRulesCount > 0 && (!status.hasUnifiedData || status.automationRulesCount === 0),
        lastUpdated: status.lastUpdated,
        recommendations: {
          migrate: sessionRulesCount > 0 && !status.hasUnifiedData,
          cleanup: status.hasUnifiedData && sessionRulesCount > 0,
        }
      },
      message: '마이그레이션 상태 조회 완료',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to get migration status:', error);
    return c.json({
      success: false,
      message: '마이그레이션 상태 조회 중 오류가 발생했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * 세션 데이터 정리 (마이그레이션 후)
 */
migration.post('/cleanup-session', async (c) => {
  try {
    const sessionId = getCookie(c, 'sessionId') || c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 필요합니다.',
      } as ApiResponse, 401);
    }

    const sessionData = await getSession(sessionId, c.env);
    
    if (!sessionData || !sessionData.email) {
      return c.json({
        success: false,
        message: '세션 데이터 또는 이메일을 찾을 수 없습니다.',
      } as ApiResponse, 404);
    }

    const migrationService = new MigrationService(c.env);
    const success = await migrationService.cleanupMigratedSessionData(sessionId, sessionData.email);

    if (success) {
      return c.json({
        success: true,
        message: '마이그레이션된 세션 데이터가 성공적으로 정리되었습니다.',
      } as ApiResponse);
    } else {
      return c.json({
        success: false,
        message: '세션 데이터 정리 중 오류가 발생했습니다.',
      } as ApiResponse, 500);
    }
  } catch (error: any) {
    console.error('Cleanup failed:', error);
    return c.json({
      success: false,
      message: '세션 데이터 정리 중 오류가 발생했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * 개발용: 전체 마이그레이션 실행 (알려진 세션 ID들 제공 필요)
 */
migration.post('/migrate-all', async (c) => {
  try {
    // 보안을 위해 개발 환경에서만 허용
    if (c.env.NODE_ENV !== 'development') {
      return c.json({
        success: false,
        message: '이 기능은 개발 환경에서만 사용 가능합니다.',
      } as ApiResponse, 403);
    }

    const body = await c.req.json();
    const { sessionIds } = body;

    if (!sessionIds || !Array.isArray(sessionIds)) {
      return c.json({
        success: false,
        message: 'sessionIds 배열이 필요합니다.',
      } as ApiResponse, 400);
    }

    const migrationService = new MigrationService(c.env);
    const results = await migrationService.scanAndMigrateAllSessions(sessionIds);

    return c.json({
      success: true,
      data: results,
      message: `마이그레이션 완료: ${results.migrated}개 성공, ${results.failed}개 실패`,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Bulk migration failed:', error);
    return c.json({
      success: false,
      message: '일괄 마이그레이션 중 오류가 발생했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

export default migration;