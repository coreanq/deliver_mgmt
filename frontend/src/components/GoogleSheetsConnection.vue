<template>
  <div>
    <!-- Google OAuth 인증 섹션 -->
    <v-card class="mb-6" v-if="!adminStore.isGoogleAuthenticated">
      <v-card-title>
        <v-icon class="me-2">mdi-google-drive</v-icon>
        구글 드라이브 연동
      </v-card-title>
      <v-card-text>
        <p class="mb-4">스프레드시트를 관리하려면 먼저 구글 계정으로 인증하세요.</p>
        <div class="d-flex gap-2">
          <v-btn 
            color="primary" 
            @click="authenticateGoogle" 
            :loading="adminStore.loading.auth"
          >
            <v-icon start>mdi-google</v-icon>
            구글 계정으로 인증
          </v-btn>
          <v-btn 
            color="secondary" 
            variant="outlined"
            @click="authenticateGoogleNewTab" 
          >
            <v-icon start>mdi-open-in-new</v-icon>
            새 탭에서 인증
          </v-btn>
          <v-btn 
            color="info" 
            variant="outlined"
            @click="refreshPage"
          >
            <v-icon start>mdi-refresh</v-icon>
            새로고침
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- 스프레드시트 목록 섹션 -->
    <v-card v-if="adminStore.isGoogleAuthenticated">
      <v-card-title class="d-flex justify-space-between align-center">
        <div>
          <v-icon class="me-2">mdi-file-table</v-icon>
          스프레드시트 목록
        </div>
        <div class="d-flex gap-2">
          <v-btn 
            color="warning" 
            variant="outlined"
            @click="disconnectGoogle" 
            :loading="adminStore.loading.auth"
          >
            <v-icon start>mdi-logout</v-icon>
            다른 계정으로 로그인
          </v-btn>
          <v-btn 
            color="success" 
            @click="connectSelectedSheets" 
            :disabled="selectedSheets.length === 0" 
            :loading="connectLoading"
          >
            <v-icon start>mdi-link</v-icon>
            선택한 시트 연동 ({{ selectedSheets.length }})
          </v-btn>
        </div>
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
        <v-row class="mb-4" v-if="adminStore.filterPreferences.length > 0">
          <v-col cols="12">
            <v-card variant="outlined">
              <v-card-subtitle>저장된 검색 필터</v-card-subtitle>
              <v-card-text>
                <v-chip-group>
                  <v-chip
                    v-for="filter in adminStore.filterPreferences"
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
        <div v-if="adminStore.loading.sheets" class="text-center py-4">
          <v-progress-circular indeterminate color="primary" />
          <p class="mt-2">스프레드시트를 불러오는 중...</p>
        </div>

        <v-data-table
          v-else
          v-model="selectedSheets"
          :headers="tableHeaders"
          :items="adminStore.spreadsheets"
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
        <div class="d-flex justify-center mt-4" v-if="adminStore.nextPageToken">
          <v-btn @click="loadMoreSheets" :loading="adminStore.loading.sheets">
            더 보기
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- 현재 연동된 시트 목록 -->
    <v-card class="mt-6" v-if="adminStore.connectedSheets.length > 0">
      <v-card-title>
        <v-icon class="me-2">mdi-check-circle</v-icon>
        연동된 스프레드시트
      </v-card-title>
      <v-card-text>
        <v-list>
          <v-list-item v-for="sheet in adminStore.connectedSheets" :key="sheet.id">
            <v-list-item-title>{{ sheet.name }}</v-list-item-title>
            <v-list-item-subtitle>{{ sheet.id }}</v-list-item-subtitle>
            <template v-slot:append>
              <v-btn icon="mdi-delete" size="small" @click="disconnectSheet(sheet.id)" />
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminStore } from '@/stores/adminStore'
import axios from 'axios'

const adminStore = useAdminStore()

// 반응형 데이터
const selectedSheets = ref([])
const connectLoading = ref(false)
const searchQuery = ref('')
const sortBy = ref('modifiedTime desc')
const filterType = ref('all')
const saveFilterDialog = ref(false)
const filterName = ref('')

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

// 컴포넌트 마운트
onMounted(async () => {
  if (adminStore.isGoogleAuthenticated) {
    await searchSheets()
  }
})

// 구글 인증 (팝업)
const authenticateGoogle = async () => {
  try {
    await adminStore.authenticateGoogle()
    emitNotification('Google 인증이 완료되었습니다!', 'success')
  } catch (error) {
    console.error('Google 인증 실패:', error)
    emitNotification('Google 인증에 실패했습니다. 새 탭에서 인증을 시도해보세요.', 'error')
  }
}

// 구글 인증 (새 탭)
const authenticateGoogleNewTab = async () => {
  try {
    const response = await axios.get('/api/admin/google-auth-url')
    window.open(response.data.authUrl, '_blank')
    emitNotification('새 탭에서 인증을 완료한 후 새로고침 버튼을 클릭해주세요.', 'info')
  } catch (error) {
    console.error('Google 인증 URL 생성 실패:', error)
    emitNotification('인증 URL 생성에 실패했습니다.', 'error')
  }
}

// 페이지 새로고침
const refreshPage = () => {
  window.location.reload()
}

// 구글 로그아웃
const disconnectGoogle = async () => {
  try {
    await adminStore.disconnectGoogle()
    emitNotification('구글 계정 로그아웃이 완료되었습니다. 다른 계정으로 로그인할 수 있습니다.', 'success')
  } catch (error) {
    console.error('구글 로그아웃 실패:', error)
    emitNotification('구글 로그아웃에 실패했습니다.', 'error')
  }
}

// 스프레드시트 검색
const searchSheets = async () => {
  try {
    await adminStore.searchSpreadsheets({
      query: searchQuery.value,
      orderBy: sortBy.value,
      pageSize: 20,
      filterType: filterType.value
    })
  } catch (error) {
    console.error('스프레드시트 검색 실패:', error)
  }
}

// 더 많은 시트 로드
const loadMoreSheets = async () => {
  try {
    await adminStore.searchSpreadsheets({
      query: searchQuery.value,
      orderBy: sortBy.value,
      pageSize: 20,
      pageToken: adminStore.nextPageToken,
      filterType: filterType.value
    })
  } catch (error) {
    console.error('추가 시트 로드 실패:', error)
  }
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
    const sheetIds = selectedSheets.value.map((sheet: any) => sheet.id)
    await adminStore.connectSpreadsheets(sheetIds)
    
    selectedSheets.value = []
    emitNotification(`${sheetIds.length}개 시트가 성공적으로 연동되었습니다.`, 'success')
  } catch (error) {
    emitNotification('시트 연동에 실패했습니다.', 'error')
    console.error('시트 연동 실패:', error)
  } finally {
    connectLoading.value = false
  }
}

// 개별 시트 연동
const connectSingleSheet = async (sheet: any) => {
  try {
    await adminStore.connectSpreadsheets([sheet.id])
    emitNotification(`${sheet.name}이(가) 연동되었습니다.`, 'success')
  } catch (error) {
    emitNotification('시트 연동에 실패했습니다.', 'error')
    console.error('개별 시트 연동 실패:', error)
  }
}

// 시트 연동 해제
const disconnectSheet = async (sheetId: string) => {
  try {
    await adminStore.disconnectSheet(sheetId)
    emitNotification('시트 연동이 해제되었습니다.', 'success')
  } catch (error) {
    emitNotification('시트 연동 해제에 실패했습니다.', 'error')
    console.error('시트 연동 해제 실패:', error)
  }
}

// 즐겨찾기 토글
const toggleStar = async (sheet: any) => {
  try {
    const starred = await adminStore.toggleSheetStar(sheet.id)
    emitNotification(
      starred ? '즐겨찾기에 추가되었습니다.' : '즐겨찾기에서 제거되었습니다.',
      'success'
    )
  } catch (error) {
    emitNotification('즐겨찾기 설정에 실패했습니다.', 'error')
    console.error('즐겨찾기 토글 실패:', error)
  }
}

// 필터 적용
const applyFilter = async (filter: any) => {
  searchQuery.value = filter.query
  sortBy.value = filter.orderBy
  
  try {
    // 필터 사용 기록 업데이트 (API가 있다면)
    await searchSheets()
  } catch (error) {
    console.error('필터 적용 실패:', error)
  }
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

    await adminStore.saveFilterPreference(filterData)
    
    emitNotification('검색 필터가 저장되었습니다.', 'success')
    saveFilterDialog.value = false
    filterName.value = ''
  } catch (error) {
    emitNotification('필터 저장에 실패했습니다.', 'error')
    console.error('필터 저장 실패:', error)
  }
}

// 필터 삭제
const deleteFilter = async (filterId: string) => {
  try {
    await adminStore.deleteFilterPreference(filterId)
    emitNotification('필터가 삭제되었습니다.', 'success')
  } catch (error) {
    emitNotification('필터 삭제에 실패했습니다.', 'error')
    console.error('필터 삭제 실패:', error)
  }
}

// 유틸리티 함수들
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('ko-KR')
}

const openInNewTab = (url: string) => {
  window.open(url, '_blank')
}

const emitNotification = (message: string, type: string = 'success') => {
  document.dispatchEvent(new CustomEvent('admin-notification', {
    detail: { message, type }
  }))
}
</script>