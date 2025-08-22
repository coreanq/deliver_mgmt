import fs from 'fs/promises'
import path from 'path'

export interface FilterPreference {
  id: string
  name: string
  query: string
  orderBy: string
  includeStarred: boolean
  includeShared: boolean
  createdAt: string
  lastUsedAt: string
  useCount: number
}

export interface RecentSearch {
  query: string
  timestamp: string
  resultCount: number
}

export class FilterPreferencesService {
  private preferencesFilePath: string
  private recentSearchesFilePath: string

  constructor() {
    this.preferencesFilePath = path.join(process.cwd(), 'data', 'filter-preferences.json')
    this.recentSearchesFilePath = path.join(process.cwd(), 'data', 'recent-searches.json')
    this.ensureDataDirectory()
  }

  /**
   * 데이터 디렉토리 생성
   */
  private async ensureDataDirectory() {
    try {
      const dataDir = path.join(process.cwd(), 'data')
      await fs.mkdir(dataDir, { recursive: true })
    } catch (error) {
      // 디렉토리가 이미 존재하면 무시
    }
  }

  /**
   * 필터 선호도 저장
   */
  async saveFilterPreference(preference: Omit<FilterPreference, 'id' | 'createdAt' | 'lastUsedAt' | 'useCount'>): Promise<FilterPreference> {
    try {
      const preferences = await this.loadFilterPreferences()
      
      const newPreference: FilterPreference = {
        id: Date.now().toString(),
        ...preference,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        useCount: 1
      }

      // 중복 이름 체크
      const existingIndex = preferences.findIndex(p => p.name === preference.name)
      if (existingIndex >= 0) {
        // 기존 것 업데이트
        preferences[existingIndex] = {
          ...preferences[existingIndex],
          ...preference,
          lastUsedAt: new Date().toISOString(),
          useCount: preferences[existingIndex].useCount + 1
        }
        await this.saveFilterPreferences(preferences)
        return preferences[existingIndex]
      } else {
        // 새로 추가
        preferences.push(newPreference)
        await this.saveFilterPreferences(preferences)
        return newPreference
      }

    } catch (error) {
      console.error('필터 선호도 저장 실패:', error)
      throw error
    }
  }

  /**
   * 모든 필터 선호도 조회
   */
  async getAllFilterPreferences(): Promise<FilterPreference[]> {
    try {
      const preferences = await this.loadFilterPreferences()
      // 최근 사용순으로 정렬
      return preferences.sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())
    } catch (error) {
      console.error('필터 선호도 조회 실패:', error)
      return []
    }
  }

  /**
   * 특정 필터 선호도 조회
   */
  async getFilterPreference(id: string): Promise<FilterPreference | null> {
    try {
      const preferences = await this.loadFilterPreferences()
      return preferences.find(p => p.id === id) || null
    } catch (error) {
      console.error('필터 선호도 조회 실패:', error)
      return null
    }
  }

  /**
   * 필터 선호도 사용 기록 업데이트
   */
  async updateFilterUsage(id: string): Promise<boolean> {
    try {
      const preferences = await this.loadFilterPreferences()
      const index = preferences.findIndex(p => p.id === id)
      
      if (index >= 0) {
        preferences[index].lastUsedAt = new Date().toISOString()
        preferences[index].useCount += 1
        await this.saveFilterPreferences(preferences)
        return true
      }
      
      return false
    } catch (error) {
      console.error('필터 사용 기록 업데이트 실패:', error)
      return false
    }
  }

  /**
   * 필터 선호도 삭제
   */
  async deleteFilterPreference(id: string): Promise<boolean> {
    try {
      const preferences = await this.loadFilterPreferences()
      const filteredPreferences = preferences.filter(p => p.id !== id)
      
      if (filteredPreferences.length !== preferences.length) {
        await this.saveFilterPreferences(filteredPreferences)
        return true
      }
      
      return false
    } catch (error) {
      console.error('필터 선호도 삭제 실패:', error)
      return false
    }
  }

  /**
   * 최근 검색어 저장
   */
  async saveRecentSearch(query: string, resultCount: number): Promise<void> {
    try {
      const recentSearches = await this.loadRecentSearches()
      
      const newSearch: RecentSearch = {
        query: query.trim(),
        timestamp: new Date().toISOString(),
        resultCount
      }

      // 중복 제거 (같은 검색어는 최신 것만 유지)
      const filteredSearches = recentSearches.filter(s => s.query !== newSearch.query)
      filteredSearches.unshift(newSearch)

      // 최대 50개까지만 유지
      const limitedSearches = filteredSearches.slice(0, 50)
      
      await this.saveRecentSearches(limitedSearches)
    } catch (error) {
      console.error('최근 검색어 저장 실패:', error)
    }
  }

  /**
   * 최근 검색어 조회
   */
  async getRecentSearches(limit: number = 10): Promise<RecentSearch[]> {
    try {
      const searches = await this.loadRecentSearches()
      return searches.slice(0, limit)
    } catch (error) {
      console.error('최근 검색어 조회 실패:', error)
      return []
    }
  }

  /**
   * 인기 검색어 조회 (최근 30일 기준)
   */
  async getPopularSearches(limit: number = 10): Promise<{ query: string; count: number }[]> {
    try {
      const searches = await this.loadRecentSearches()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // 최근 30일 검색어만 필터링
      const recentSearches = searches.filter(s => 
        new Date(s.timestamp) >= thirtyDaysAgo
      )

      // 검색어별 카운트
      const queryCount: { [key: string]: number } = {}
      recentSearches.forEach(s => {
        queryCount[s.query] = (queryCount[s.query] || 0) + 1
      })

      // 카운트 순으로 정렬
      const popularQueries = Object.entries(queryCount)
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)

      return popularQueries
    } catch (error) {
      console.error('인기 검색어 조회 실패:', error)
      return []
    }
  }

  /**
   * 최근 검색어 삭제
   */
  async clearRecentSearches(): Promise<void> {
    try {
      await this.saveRecentSearches([])
    } catch (error) {
      console.error('최근 검색어 삭제 실패:', error)
    }
  }

  // Private methods
  private async loadFilterPreferences(): Promise<FilterPreference[]> {
    try {
      const content = await fs.readFile(this.preferencesFilePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      return []
    }
  }

  private async saveFilterPreferences(preferences: FilterPreference[]): Promise<void> {
    await fs.writeFile(this.preferencesFilePath, JSON.stringify(preferences, null, 2))
  }

  private async loadRecentSearches(): Promise<RecentSearch[]> {
    try {
      const content = await fs.readFile(this.recentSearchesFilePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      return []
    }
  }

  private async saveRecentSearches(searches: RecentSearch[]): Promise<void> {
    await fs.writeFile(this.recentSearchesFilePath, JSON.stringify(searches, null, 2))
  }
}

export default new FilterPreferencesService()