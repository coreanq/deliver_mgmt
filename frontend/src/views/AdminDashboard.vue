<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-6">스프레드시트 연동 관리</h1>
        
        <!-- Google OAuth 인증 섹션 -->
        <v-card class="mb-6" v-if="!isAuthenticated">
          <v-card-title>
            <v-icon class="me-2">mdi-google-drive</v-icon>
            구글 드라이브 연동
          </v-card-title>
          <v-card-text>
            <p class="mb-4">스프레드시트를 관리하려면 먼저 구글 계정으로 인증하세요.</p>
            <v-btn color="primary" @click="authenticateGoogle" :loading="authLoading">
              <v-icon start>mdi-google</v-icon>
              구글 계정으로 인증
            </v-btn>
          </v-card-text>
        </v-card>

        <!-- 스프레드시트 목록 섹션 -->
        <v-card v-if="isAuthenticated">
          <v-card-title class="d-flex justify-space-between align-center">
            <div>
              <v-icon class="me-2">mdi-file-table</v-icon>
              스프레드시트 목록
            </div>
            <v-btn color="success" @click="connectSelectedSheets" :disabled="selectedSheets.length === 0" :loading="connectLoading">
              <v-icon start>mdi-link</v-icon>
              선택한 시트 연동 ({{ selectedSheets.length }})
            </v-btn>
          </v-card-title>

          <v-card-text>
            <!-- 검색 및 필터 -->
            <v-row class="mb-4">
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="searchQuery"
                  label="스프레드시트 검색"
                  prepend-inner-icon="mdi-magnify"
                  clearable
                  @keyup.enter="searchSheets"
                  @click:clear="clearSearch"
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="sortBy"
                  :items="sortOptions"
                  label="정렬 기준"
                  @update:model-value="searchSheets"
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-btn-toggle v-model="filterType" mandatory>
                  <v-btn value="all" size="small">전체</v-btn>
                  <v-btn value="starred" size="small">즐겨찾기</v-btn>
                  <v-btn value="my" size="small">내 파일</v-btn>
                </v-btn-toggle>
              </v-col>
            </v-row>

            <!-- 저장된 검색 필터 -->
            <v-row class="mb-4" v-if="savedFilters.length > 0">
              <v-col cols="12">
                <v-card variant="outlined">
                  <v-card-subtitle>저장된 검색 필터</v-card-subtitle>
                  <v-card-text>
                    <v-chip-group>
                      <v-chip
                        v-for="filter in savedFilters"
                        :key="filter.id"
                        @click="applyFilter(filter)"
                        closable
                        @click:close="deleteFilter(filter.id)"
                      >
                        {{ filter.name }}
                      </v-chip>
                    </v-chip-group>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <!-- 검색 결과 -->
            <div v-if="loading" class="text-center py-4">
              <v-progress-circular indeterminate color="primary" />
              <p class="mt-2">스프레드시트를 불러오는 중...</p>
            </div>

            <v-data-table
              v-else
              v-model="selectedSheets"
              :headers="tableHeaders"
              :items="spreadsheets"
              :items-per-page="20"
              show-select
              class="elevation-1"
            >
              <template v-slot:item.name="{ item }">
                <div class="d-flex align-center">
                  <v-icon class="me-2" color="green">mdi-file-table</v-icon>
                  <div>
                    <div class="font-weight-medium">{{ item.name }}</div>
                    <div class="text-caption text-grey">{{ item.id }}</div>
                  </div>
                </div>
              </template>

              <template v-slot:item.owners="{ item }">
                <v-chip size="small" v-for="owner in item.owners" :key="owner">
                  {{ owner }}
                </v-chip>
              </template>

              <template v-slot:item.modifiedTime="{ item }">
                {{ formatDate(item.modifiedTime) }}
              </template>

              <template v-slot:item.starred="{ item }">
                <v-btn
                  icon
                  size="small"
                  @click="toggleStar(item)"
                  :color="item.starred ? 'yellow' : 'grey'"
                >
                  <v-icon>{{ item.starred ? 'mdi-star' : 'mdi-star-outline' }}</v-icon>
                </v-btn>
              </template>

              <template v-slot:item.actions="{ item }">
                <v-menu>
                  <template v-slot:activator="{ props }">
                    <v-btn icon="mdi-dots-vertical" v-bind="props" size="small" />
                  </template>
                  <v-list>
                    <v-list-item @click="openInNewTab(item.webViewLink)">
                      <v-list-item-title>
                        <v-icon start>mdi-open-in-new</v-icon>
                        시트 열기
                      </v-list-item-title>
                    </v-list-item>
                    <v-list-item @click="connectSingleSheet(item)">
                      <v-list-item-title>
                        <v-icon start>mdi-link</v-icon>
                        개별 연동
                      </v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-menu>
              </template>
            </v-data-table>

            <!-- 페이지네이션 -->
            <div class="d-flex justify-center mt-4" v-if="nextPageToken">
              <v-btn @click="loadMoreSheets" :loading="loading">
                더 보기
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <!-- 현재 연동된 시트 목록 -->
        <v-card class="mt-6" v-if="connectedSheets.length > 0">
          <v-card-title>
            <v-icon class="me-2">mdi-check-circle</v-icon>
            연동된 스프레드시트
          </v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item v-for="sheet in connectedSheets" :key="sheet.id">
                <v-list-item-title>{{ sheet.name }}</v-list-item-title>
                <v-list-item-subtitle>{{ sheet.id }}</v-list-item-subtitle>
                <template v-slot:append>
                  <v-btn icon="mdi-delete" size="small" @click="disconnectSheet(sheet.id)" />
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 필터 저장 다이얼로그 -->
    <v-dialog v-model="saveFilterDialog" max-width="400">
      <v-card>
        <v-card-title>검색 필터 저장</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="filterName"
            label="필터 이름"
            placeholder="예: 2025년 1월 배송시트"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="saveFilterDialog = false">취소</v-btn>
          <v-btn color="primary" @click="saveCurrentFilter" :disabled="!filterName">저장</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 알림 스낵바 -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color">
      {{ snackbar.message }}
      <template v-slot:actions>
        <v-btn icon="mdi-close" @click="snackbar.show = false" />
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'

interface SpreadsheetInfo {
  id: string
  name: string
  createdTime: string
  modifiedTime: string
  owners: string[]
  webViewLink: string
  size?: number
  starred: boolean
  shared: boolean
}

interface FilterPreference {
  id: string
  name: string
  query: string
  orderBy: string
  includeStarred: boolean
  includeShared: boolean
}

// 반응형 데이터
const isAuthenticated = ref(false)
const authLoading = ref(false)
const loading = ref(false)
const connectLoading = ref(false)

const spreadsheets = ref<SpreadsheetInfo[]>([])
const selectedSheets = ref<SpreadsheetInfo[]>([])
const connectedSheets = ref<SpreadsheetInfo[]>([])
const savedFilters = ref<FilterPreference[]>([])

const searchQuery = ref('')
const sortBy = ref('modifiedTime desc')
const filterType = ref('all')
const nextPageToken = ref<string | null>(null)

const saveFilterDialog = ref(false)
const filterName = ref('')

const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

// 테이블 헤더
const tableHeaders = [
  { title: '이름', key: 'name', sortable: false },
  { title: '소유자', key: 'owners', sortable: false },
  { title: '수정 일시', key: 'modifiedTime', sortable: false },
  { title: '즐겨찾기', key: 'starred', sortable: false },
  { title: '작업', key: 'actions', sortable: false }
]

// 정렬 옵션
const sortOptions = [
  { title: '최근 수정순', value: 'modifiedTime desc' },
  { title: '이름순', value: 'name' },
  { title: '생성일순', value: 'createdTime desc' }
]

// 컴포넌트 마운트 시
onMounted(async () => {
  await checkAuthStatus()
  await loadSavedFilters()
  if (isAuthenticated.value) {
    await searchSheets()
  }
})

// 구글 인증 상태 확인
const checkAuthStatus = async () => {
  try {
    const response = await axios.get('/api/admin/auth-status')
    isAuthenticated.value = response.data.authenticated
  } catch (error) {
    console.error('인증 상태 확인 실패:', error)
  }
}

// 구글 OAuth 인증
const authenticateGoogle = async () => {
  try {
    authLoading.value = true
    const response = await axios.get('/api/admin/google-auth-url')
    window.location.href = response.data.authUrl
  } catch (error) {
    showSnackbar('구글 인증 URL 생성에 실패했습니다.', 'error')
  } finally {
    authLoading.value = false
  }
}

// 스프레드시트 검색
const searchSheets = async (loadMore = false) => {
  if (!isAuthenticated.value) return

  try {
    loading.value = true
    
    const params: any = {
      query: searchQuery.value,
      orderBy: sortBy.value,
      pageSize: 20
    }

    if (loadMore && nextPageToken.value) {
      params.pageToken = nextPageToken.value
    }

    if (filterType.value === 'starred') {
      const response = await axios.get('/api/admin/spreadsheets/starred')
      if (loadMore) {
        spreadsheets.value.push(...response.data)
      } else {
        spreadsheets.value = response.data
      }
      nextPageToken.value = null
    } else {
      const response = await axios.get('/api/admin/spreadsheets', { params })
      
      if (loadMore) {
        spreadsheets.value.push(...response.data.files)
      } else {
        spreadsheets.value = response.data.files
      }
      nextPageToken.value = response.data.nextPageToken || null
    }

    // 검색어가 있으면 최근 검색어로 저장
    if (searchQuery.value?.trim()) {
      await saveRecentSearch(searchQuery.value, spreadsheets.value.length)
    }

  } catch (error: any) {
    showSnackbar('스프레드시트 목록을 불러오는데 실패했습니다.', 'error')
    console.error('검색 실패:', error)
  } finally {
    loading.value = false
  }
}

// 더 많은 시트 로드
const loadMoreSheets = () => {
  searchSheets(true)
}

// 검색 초기화
const clearSearch = () => {
  searchQuery.value = ''
  searchSheets()
}

// 선택한 시트들 연동
const connectSelectedSheets = async () => {
  if (selectedSheets.value.length === 0) return

  try {
    connectLoading.value = true
    
    const sheetIds = selectedSheets.value.map(sheet => sheet.id)
    const response = await axios.post('/api/admin/spreadsheets/bulk-connect', {
      spreadsheetIds: sheetIds
    })

    showSnackbar(`${selectedSheets.value.length}개 시트가 성공적으로 연동되었습니다.`, 'success')
    selectedSheets.value = []
    
    // 연동된 시트 목록 새로고침
    await loadConnectedSheets()

  } catch (error: any) {
    showSnackbar('시트 연동에 실패했습니다.', 'error')
    console.error('연동 실패:', error)
  } finally {
    connectLoading.value = false
  }
}

// 개별 시트 연동
const connectSingleSheet = async (sheet: SpreadsheetInfo) => {
  try {
    await axios.post('/api/admin/spreadsheets/bulk-connect', {
      spreadsheetIds: [sheet.id]
    })

    showSnackbar(`${sheet.name}이(가) 연동되었습니다.`, 'success')
    await loadConnectedSheets()

  } catch (error) {
    showSnackbar('시트 연동에 실패했습니다.', 'error')
  }
}

// 연동된 시트 목록 로드
const loadConnectedSheets = async () => {
  try {
    const response = await axios.get('/api/admin/connected-sheets')
    connectedSheets.value = response.data
  } catch (error) {
    console.error('연동된 시트 목록 로드 실패:', error)
  }
}

// 시트 연동 해제
const disconnectSheet = async (sheetId: string) => {
  try {
    await axios.delete(`/api/admin/connected-sheets/${sheetId}`)
    showSnackbar('시트 연동이 해제되었습니다.', 'success')
    await loadConnectedSheets()
  } catch (error) {
    showSnackbar('시트 연동 해제에 실패했습니다.', 'error')
  }
}

// 즐겨찾기 토글
const toggleStar = async (sheet: SpreadsheetInfo) => {
  try {
    const response = await axios.post(`/api/admin/spreadsheets/${sheet.id}/toggle-star`)
    sheet.starred = response.data.starred
    showSnackbar(
      sheet.starred ? '즐겨찾기에 추가되었습니다.' : '즐겨찾기에서 제거되었습니다.',
      'success'
    )
  } catch (error) {
    showSnackbar('즐겨찾기 설정에 실패했습니다.', 'error')
  }
}

// 저장된 필터 로드
const loadSavedFilters = async () => {
  try {
    const response = await axios.get('/api/admin/filter-preferences')
    savedFilters.value = response.data
  } catch (error) {
    console.error('저장된 필터 로드 실패:', error)
  }
}

// 필터 적용
const applyFilter = async (filter: FilterPreference) => {
  searchQuery.value = filter.query
  sortBy.value = filter.orderBy
  
  // 필터 사용 기록 업데이트
  await axios.post(`/api/admin/filter-preferences/${filter.id}/use`)
  
  await searchSheets()
}

// 현재 필터 저장
const saveCurrentFilter = async () => {
  try {
    const filterData = {
      name: filterName.value,
      query: searchQuery.value,
      orderBy: sortBy.value,
      includeStarred: filterType.value === 'starred',
      includeShared: filterType.value === 'shared'
    }

    await axios.post('/api/admin/filter-preferences', filterData)
    
    showSnackbar('검색 필터가 저장되었습니다.', 'success')
    saveFilterDialog.value = false
    filterName.value = ''
    
    await loadSavedFilters()

  } catch (error) {
    showSnackbar('필터 저장에 실패했습니다.', 'error')
  }
}

// 필터 삭제
const deleteFilter = async (filterId: string) => {
  try {
    await axios.delete(`/api/admin/filter-preferences/${filterId}`)
    showSnackbar('필터가 삭제되었습니다.', 'success')
    await loadSavedFilters()
  } catch (error) {
    showSnackbar('필터 삭제에 실패했습니다.', 'error')
  }
}

// 최근 검색어 저장
const saveRecentSearch = async (query: string, resultCount: number) => {
  try {
    await axios.post('/api/admin/recent-searches', { query, resultCount })
  } catch (error) {
    console.error('최근 검색어 저장 실패:', error)
  }
}

// 유틸리티 함수들
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('ko-KR')
}

const openInNewTab = (url: string) => {
  window.open(url, '_blank')
}

const showSnackbar = (message: string, color: string = 'success') => {
  snackbar.value = {
    show: true,
    message,
    color
  }
}
</script>