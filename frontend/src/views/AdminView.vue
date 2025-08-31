<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="text-h5">
            <v-icon start>mdi-cog</v-icon>
            관리자 설정
          </v-card-title>
          
          <v-card-text>
            <v-row>
              <!-- Google Sheets Integration -->
              <v-col cols="12" md="6">
                <v-card variant="outlined">
                  <v-card-title class="text-h6">
                    <v-icon start>mdi-google</v-icon>
                    구글 스프레드시트 연동
                  </v-card-title>
                  
                  <v-card-text>
                    <v-chip
                      :color="authStore.isGoogleAuthenticated ? 'success' : 'error'"
                      class="mb-4"
                    >
                      {{ authStore.isGoogleAuthenticated ? '연결됨' : '연결 안됨' }}
                    </v-chip>
                    
                    <div v-if="!authStore.isGoogleAuthenticated">
                      <p class="mb-4">구글 스프레드시트와 연동하여 주문 데이터를 관리합니다.</p>
                      <v-btn
                        color="primary"
                        variant="elevated"
                        @click="connectGoogleSheets"
                        :loading="googleLoading"
                      >
                        <v-icon start>mdi-google</v-icon>
                        구글 스프레드시트 연결하기
                      </v-btn>
                    </div>
                    
                    <div v-else>
                      
                      <!-- Selected Date Section (moved to top) -->
                      <v-row v-if="selectedDateString" class="mb-4">
                        <v-col cols="12">
                          <v-card variant="outlined">
                            <v-card-title>선택된 날짜</v-card-title>
                            <v-card-text>
                              <div class="d-flex justify-space-between align-center mb-2">
                                <v-chip color="primary" size="large">
                                  {{ formatDateDisplay(selectedDateString) }}
                                </v-chip>
                                <v-chip color="success" size="small">{{ authStore.googleSpreadsheets.length }}개 스프레드시트</v-chip>
                              </div>
                              <small class="text-grey">시트명: {{ selectedDateString }}</small>
                            </v-card-text>
                          </v-card>
                        </v-col>
                      </v-row>

                      <!-- Calendar Section -->
                      <v-row class="mb-4">
                        <v-col cols="12">
                          <v-card variant="outlined">
                            <v-card-title>날짜 선택</v-card-title>
                            <v-card-text>
                              <!-- Embedded Calendar for All Devices -->
                              <div class="d-flex justify-center">
                                <div class="calendar-container">
                                  <div class="calendar-header">
                                    <button @click="prevMonth" class="calendar-nav-btn">‹</button>
                                    <h3 class="calendar-title">{{ currentMonthDisplay }}</h3>
                                    <button @click="nextMonth" class="calendar-nav-btn">›</button>
                                  </div>
                                  <div class="embedded-calendar">
                                    <div class="calendar-weekdays">
                                      <div v-for="day in weekdays" :key="day" class="weekday">{{ day }}</div>
                                    </div>
                                    <div class="calendar-days">
                                      <div 
                                        v-for="date in calendarDays" 
                                        :key="date.key"
                                        @click="selectDate(date)"
                                        :class="[
                                          'calendar-day',
                                          { 
                                            'other-month': date.isOtherMonth,
                                            'selected': date.isSelected,
                                            'today': date.isToday,
                                            'disabled': date.isDisabled
                                          }
                                        ]"
                                      >
                                        {{ date.day }}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </v-card-text>
                          </v-card>
                        </v-col>
                      </v-row>

                      <!-- Data Table Section -->
                      <v-row v-if="sheetData.length > 0">
                        <v-col cols="12">
                          <v-card variant="outlined">
                            <v-card-title>
                              배송 데이터 ({{ selectedDateString }})
                              <v-chip 
                                v-if="selectedStaff !== '전체'" 
                                color="primary" 
                                size="small" 
                                class="ml-2"
                              >
                                {{ selectedStaff }}
                              </v-chip>
                              <v-spacer></v-spacer>
                              <v-chip 
                                color="info" 
                                size="small" 
                                class="mr-2"
                              >
                                {{ filteredData.length }}건
                              </v-chip>
                              <v-btn
                                size="small"
                                variant="outlined"
                                @click="refreshData"
                                :loading="dataLoading"
                              >
                                <v-icon start>mdi-refresh</v-icon>
                                새로고침
                              </v-btn>
                            </v-card-title>
                            <v-card-text>
                              <!-- Filter Controls -->
                              <v-row class="mb-4">
                                <v-col cols="12">
                                  <v-select
                                    v-model="selectedStaff"
                                    label="담당자"
                                    :items="availableStaff"
                                    prepend-inner-icon="mdi-account"
                                    variant="outlined"
                                    density="compact"
                                  ></v-select>
                                </v-col>
                                <!-- Dynamic Filter System -->
                                <v-col cols="12">
                                  <div class="d-flex align-center gap-2 mb-3">
                                    <v-btn
                                      color="primary"
                                      variant="outlined"
                                      size="small"
                                      prepend-icon="mdi-filter-plus"
                                      @click="addFilter"
                                      :disabled="activeFilters.length >= availableColumns.length"
                                    >
                                      필터 추가
                                    </v-btn>
                                    <v-btn
                                      v-if="activeFilters.length > 0"
                                      color="error"
                                      variant="outlined"
                                      size="small"
                                      prepend-icon="mdi-filter-remove"
                                      @click="clearAllFilters"
                                    >
                                      모든 필터 지우기
                                    </v-btn>
                                  </div>
                                  
                                  <!-- Active Filters -->
                                  <v-row v-if="activeFilters.length > 0" class="mb-2">
                                    <v-col 
                                      v-for="filter in activeFilters" 
                                      :key="filter.id" 
                                      cols="12" 
                                      md="4"
                                      class="pb-2"
                                    >
                                      <div class="d-flex gap-2 align-center">
                                        <v-select
                                          :model-value="filter.column"
                                          @update:model-value="updateFilterColumn(filter.id, $event)"
                                          :items="availableColumns"
                                          label="컬럼 선택"
                                          variant="outlined"
                                          density="compact"
                                          style="min-width: 120px;"
                                        ></v-select>
                                        <v-text-field
                                          :model-value="filter.value"
                                          @update:model-value="updateFilterValue(filter.id, $event)"
                                          :label="filter.column + ' 검색'"
                                          prepend-inner-icon="mdi-magnify"
                                          clearable
                                          variant="outlined"
                                          density="compact"
                                          style="flex: 2; min-width: 200px;"
                                        ></v-text-field>
                                        <v-btn
                                          icon="mdi-close"
                                          size="small"
                                          variant="text"
                                          color="error"
                                          @click="removeFilter(filter.id)"
                                        ></v-btn>
                                      </div>
                                    </v-col>
                                  </v-row>
                                </v-col>
                              </v-row>

                              <!-- Unified Card View for All Devices -->
                              <div class="unified-card-container">
                                <div v-if="dataLoading" class="text-center py-8">
                                  <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
                                  <p class="mt-4">데이터 로딩 중...</p>
                                </div>
                                
                                <div v-else>
                                  <!-- Summary Info -->
                                  <div class="stats-grid mb-8">
                                    <div class="stat-card total">
                                      <div class="stat-header">
                                        <div class="stat-icon">
                                          <v-icon size="24" color="white">mdi-format-list-numbered</v-icon>
                                        </div>
                                      </div>
                                      <div class="stat-number">{{ filteredData.length }}</div>
                                      <div class="stat-label">총 배송 건수</div>
                                      <div class="progress-bar">
                                        <div class="progress-fill" :style="{ width: '100%' }"></div>
                                      </div>
                                    </div>

                                    <div class="stat-card completed">
                                      <div class="stat-header">
                                        <div class="stat-icon">
                                          <v-icon size="24" color="white">mdi-check-circle</v-icon>
                                        </div>
                                      </div>
                                      <div class="stat-number">{{ getCompletedOrdersCount() }}</div>
                                      <div class="stat-label">배송 완료</div>
                                      <div class="progress-bar">
                                        <div class="progress-fill" :style="{ width: getCompletionRate() + '%' }"></div>
                                      </div>
                                    </div>

                                    <div class="stat-card pending">
                                      <div class="stat-header">
                                        <div class="stat-icon">
                                          <v-icon size="24" color="white">mdi-clock-outline</v-icon>
                                        </div>
                                      </div>
                                      <div class="stat-number">{{ getPendingOrdersCount() }}</div>
                                      <div class="stat-label">배송 미완료</div>
                                      <div class="progress-bar">
                                        <div class="progress-fill" :style="{ width: (100 - getCompletionRate()) + '%' }"></div>
                                      </div>
                                    </div>

                                    <div class="stat-card percentage">
                                      <div class="stat-header">
                                        <div class="stat-icon">
                                          <v-icon size="24" color="white">mdi-percent</v-icon>
                                        </div>
                                      </div>
                                      <div class="stat-number">{{ getCompletionRate() }}%</div>
                                      <div class="stat-label">완료율</div>
                                      <div class="progress-bar">
                                        <div class="progress-fill" :style="{ width: getCompletionRate() + '%' }"></div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <!-- Card Grid -->
                                  <v-row>
                                    
                                    <v-col 
                                      v-for="(item, index) in paginatedData" 
                                      :key="item.rowIndex || index"
                                      cols="12"
                                      class="pb-3"
                                    >
                                      <v-tooltip location="top">
                                        <template v-slot:activator="{ props }">
                                          <v-card 
                                            variant="outlined" 
                                            class="unified-data-card customer-card-hover"
                                            :class="{ 'completed-order': isOrderCompleted(item) }"
                                            elevation="2"
                                            v-bind="props"
                                          >
                                            <v-card-text class="pa-4">
                                              <!-- Order Header -->
                                              <div class="unified-card-header">
                                                <div class="order-info">
                                                  <h3 class="order-title-unified">{{ getOrderTitle(item) }}</h3>
                                                  <div class="order-row-info d-flex justify-space-between align-center">
                                                    <!-- 배송 준비중 상태일 때 좌우 배치 -->
                                                    <template v-if="getOrderStatus(item) === '배송 준비중' && getStaffName(item)">
                                                      <div class="left-section d-flex align-center">
                                                        <v-chip 
                                                          :color="getOrderStatusColor(item)"
                                                          size="small" 
                                                          variant="elevated"
                                                          class="status-chip-unified"
                                                        >
                                                          {{ getOrderStatus(item) }}
                                                        </v-chip>
                                                      </div>
                                                      <div class="right-section d-flex align-center">
                                                        <span class="status-separator mr-2">배송담당자:</span>
                                                        <v-btn
                                                          size="x-small"
                                                          variant="outlined"
                                                          color="primary"
                                                          @click="openStaffPage(getStaffName(item))"
                                                          class="staff-name-btn mr-2"
                                                        >
                                                          <v-icon start size="12">mdi-account-tie</v-icon>
                                                          {{ getStaffName(item) }}
                                                        </v-btn>
                                                        <v-btn
                                                          size="x-small"
                                                          variant="outlined"
                                                          color="secondary"
                                                          @click="generateQR(getStaffName(item))"
                                                          :disabled="!selectedDateString"
                                                          class="qr-btn"
                                                        >
                                                          <v-icon start size="12">mdi-qrcode</v-icon>
                                                          QR Code
                                                        </v-btn>
                                                      </div>
                                                    </template>
                                                  </div>
                                                </div>
                                                <div class="status-section">
                                                  <!-- 기타 상태는 별도로 표시 -->
                                                  <div v-if="!(getOrderStatus(item) === '배송 준비중' && getStaffName(item))" class="status-chip-only">
                                                    <v-chip 
                                                      :color="getOrderStatusColor(item)"
                                                      size="small" 
                                                      variant="elevated"
                                                      class="status-chip-unified"
                                                    >
                                                      {{ getOrderStatus(item) }}
                                                    </v-chip>
                                                  </div>
                                                </div>
                                              </div>
                                            </v-card-text>
                                          </v-card>
                                        </template>
                                        <div class="customer-tooltip-content">
                                          <div v-for="header in displayableHeaders" :key="header">
                                            <div v-if="header.includes('배송지') || header.includes('주소')" class="tooltip-row">
                                              <v-icon size="16" color="primary">mdi-map-marker</v-icon>
                                              <strong>{{ header }}:</strong> {{ item[header] || '-' }}
                                            </div>
                                            <div v-else-if="header.includes('연락처') || header.includes('전화')" class="tooltip-row">
                                              <v-icon size="16" color="success">mdi-phone</v-icon>
                                              <strong>{{ header }}:</strong> {{ item[header] || '-' }}
                                            </div>
                                            <div v-else-if="header.includes('담당자') && getStaffName(item)" class="tooltip-row">
                                              <v-icon size="16" color="green">mdi-account-tie</v-icon>
                                              <strong>배송 담당자:</strong> {{ getStaffName(item) || '-' }}
                                            </div>
                                          </div>
                                        </div>
                                      </v-tooltip>
                                    </v-col>
                                    
                                    <!-- Pagination -->
                                    <v-col v-if="filteredData.length > itemsPerPage" cols="12" class="text-center mt-4">
                                      <v-pagination
                                        v-model="currentPage"
                                        :length="totalPages"
                                        :total-visible="5"
                                        color="primary"
                                        class="unified-pagination"
                                      ></v-pagination>
                                    </v-col>
                                  </v-row>
                                </div>
                              </div>
                            </v-card-text>
                          </v-card>
                        </v-col>
                      </v-row>

                      <!-- No Data Message -->
                      <v-row v-else-if="selectedDateString && !dataLoading">
                        <v-col cols="12">
                          <v-card variant="outlined">
                            <v-card-text class="text-center py-8">
                              <v-icon size="64" color="grey-lighten-2" class="mb-4">mdi-calendar-remove</v-icon>
                              <p class="text-h6 mb-2">{{ selectedDateString }} 시트를 찾을 수 없습니다</p>
                              <p class="text-body-2 text-grey">해당 날짜의 배송 데이터가 없거나 시트가 생성되지 않았습니다.</p>
                            </v-card-text>
                          </v-card>
                        </v-col>
                      </v-row>

                      <v-btn
                        color="error"
                        variant="outlined"
                        @click="disconnectGoogleSheets"
                        class="mt-4"
                      >
                        Google 연결 해제
                      </v-btn>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>

              <!-- SOLAPI Integration -->
              <v-col cols="12" md="6">
                <v-card variant="outlined">
                  <v-card-title class="text-h6">
                    <v-icon start>mdi-message-text</v-icon>
                    SOLAPI 카카오톡 연동
                  </v-card-title>
                  
                  <v-card-text>
                    <v-chip
                      :color="authStore.isSolapiAuthenticated ? 'success' : 'error'"
                      class="mb-4"
                    >
                      {{ authStore.isSolapiAuthenticated ? '연결됨' : '연결 안됨' }}
                    </v-chip>
                    
                    <div v-if="!authStore.isSolapiAuthenticated">
                      <p class="mb-4">SOLAPI를 통해 배송 완료 알림을 고객에게 발송합니다.</p>
                      <v-btn
                        color="primary"
                        variant="elevated"
                        @click="connectSolapi"
                        :loading="solapiLoading"
                      >
                        <v-icon start>mdi-message-text</v-icon>
                        SOLAPI로 로그인
                      </v-btn>
                    </div>
                    
                    <div v-else>
                      <div class="mb-4">
                        <v-card variant="outlined" color="info">
                          <v-card-title class="text-subtitle-1">
                            <v-icon start>mdi-account-cash</v-icon>
                            계정 정보
                          </v-card-title>
                          <v-card-text>
                            <div class="d-flex justify-space-between align-center mb-2">
                              <span>잔액:</span>
                              <v-chip color="success" size="small">
                                {{ solapiBalance || '확인 중...' }}
                              </v-chip>
                            </div>
                            <v-btn
                              variant="outlined"
                              size="small"
                              @click="loadAccountInfo"
                              :loading="accountInfoLoading"
                              class="mt-2"
                            >
                              <v-icon start>mdi-refresh</v-icon>
                              정보 새로고침
                            </v-btn>
                          </v-card-text>
                        </v-card>
                      </div>
                      
                      <!-- SMS 발송 섹션 - 완전히 새로 구현 -->
                      <v-card variant="outlined" class="mb-4">
                        <v-card-title class="d-flex align-center">
                          <v-icon start>mdi-message</v-icon>
                          SMS 발송
                        </v-card-title>
                        <v-card-text>
                          <v-form @submit.prevent="handleSmsSubmit">
                            <v-row>
                              <!-- 발신번호 -->
                              <v-col cols="12" sm="6">
                                <v-text-field
                                  v-model="newSmsForm.fromNumber"
                                  label="발신번호"
                                  placeholder="010-0000-0000"
                                  variant="outlined"
                                  prepend-inner-icon="mdi-phone-outgoing"
                                  required
                                ></v-text-field>
                              </v-col>
                              
                              <!-- 수신번호 -->
                              <v-col cols="12" sm="6">
                                <v-text-field
                                  v-model="newSmsForm.toNumber"
                                  label="수신번호"
                                  placeholder="010-0000-0000"
                                  variant="outlined"
                                  prepend-inner-icon="mdi-phone-incoming"
                                  required
                                ></v-text-field>
                              </v-col>
                              
                              <!-- 메시지 내용 -->
                              <v-col cols="12">
                                <v-textarea
                                  v-model="newSmsForm.message"
                                  label="메시지 내용"
                                  placeholder="전송할 메시지를 입력하세요"
                                  variant="outlined"
                                  rows="4"
                                  required
                                ></v-textarea>
                                
                                <!-- 문자 카운터 -->
                                <div class="d-flex justify-space-between align-center mt-2">
                                  <v-chip
                                    :color="messageLength > 90 ? 'warning' : 'info'"
                                    size="small"
                                  >
                                    {{ messageType }} ({{ messageLength }}/90자)
                                  </v-chip>
                                  
                                  <div class="d-flex gap-2">
                                    <v-btn
                                      variant="outlined"
                                      color="grey"
                                      @click="clearSmsForm"
                                    >
                                      초기화
                                    </v-btn>
                                    
                                    <v-btn
                                      variant="elevated"
                                      color="primary"
                                      type="submit"
                                      :disabled="!canSubmit"
                                      :loading="isSending"
                                    >
                                      <v-icon start>mdi-send</v-icon>
                                      전송하기
                                    </v-btn>
                                  </div>
                                </div>
                              </v-col>
                            </v-row>
                          </v-form>
                        </v-card-text>
                      </v-card>
                      
                      <v-btn
                        color="error"
                        variant="outlined"
                        @click="disconnectSolapi"
                      >
                        연결 해제
                      </v-btn>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>

              <!-- Automation Section -->
              <v-col cols="12" v-if="authStore.isGoogleAuthenticated && authStore.isSolapiAuthenticated">
                <v-card variant="outlined">
                  <v-card-title class="d-flex align-center">
                    <v-icon start>mdi-robot</v-icon>
                    자동화 설정
                  </v-card-title>
                  
                  <v-card-text>
                    <!-- 조건 설정 -->
                    <div class="mb-4">
                      <v-row>
                        <v-col cols="12" sm="6" md="3">
                          <v-select
                            v-model="automationForm.conditionColumn"
                            :items="sheetColumns"
                            label="컬럼 선택"
                            variant="outlined"
                            density="compact"
                            placeholder="컬럼 선택"
                          />
                        </v-col>
                        <v-col cols="12" sm="6" md="3" class="d-flex align-center">
                          <span class="text-body-2">이(가)</span>
                        </v-col>
                        <v-col cols="12" sm="6" md="6">
                          <v-text-field
                            v-model="automationForm.triggerValue"
                            label="결제 완료로 변경 시"
                            variant="outlined"
                            density="compact"
                            placeholder="예: 결제 완료"
                          />
                        </v-col>
                      </v-row>
                    </div>

                    <!-- 동작 설정 -->
                    <div class="mb-4">
                      <v-select
                        v-model="automationForm.actionType"
                        :items="[
                          { title: '문자메시지 발송하기', value: 'sms' },
                          { title: '카카오톡 발송하기', value: 'kakao' }
                        ]"
                        label="동작"
                        variant="outlined"
                        density="compact"
                      />
                    </div>

                    <!-- 발신번호 및 수신자 설정 -->
                    <v-row class="mb-4">
                      <v-col cols="12" md="6">
                        <v-text-field
                          v-model="automationForm.senderNumber"
                          label="발신번호 (메시지 보낼 번호)"
                          variant="outlined"
                          density="compact"
                          placeholder="010-0000-0000"
                        />
                      </v-col>
                      <v-col cols="12" md="6">
                        <v-select
                          v-model="automationForm.recipientColumn"
                          :items="sheetColumns"
                          label="수신자 선택"
                          variant="outlined"
                          density="compact"
                          placeholder="전화번호 컬럼 선택"
                        />
                      </v-col>
                    </v-row>

                    <!-- 메시지 템플릿 -->
                    <div class="mb-4">
                      <v-textarea
                        v-model="automationForm.messageTemplate"
                        label="메시지 내용"
                        variant="outlined"
                        rows="4"
                        hint="변수 사용법: #{컬럼명} (예: #{고객명}, #{주문번호})"
                        persistent-hint
                        placeholder="#{고객명}님, 배송 완료되었습니다. 감사합니다."
                      />
                      <div class="text-caption mt-2">
                        <v-icon size="small" color="info">mdi-information</v-icon>
                        스프레드시트 컬럼명을 #{컬럼명} 형식으로 사용하면 실제 데이터로 치환됩니다.
                      </div>
                    </div>

                    <!-- 액션 버튼 -->
                    <v-card-actions class="px-0">
                      <v-btn
                        color="primary"
                        variant="elevated"
                        @click="saveAutomationRule"
                        :disabled="!canSaveAutomation"
                        :loading="automationSaving"
                      >
                        <v-icon start>mdi-content-save</v-icon>
                        자동화 규칙 저장
                      </v-btn>
                      
                      <v-btn
                        color="success"
                        variant="outlined"
                        @click="testAutomation"
                        :disabled="!canTestAutomation"
                        :loading="automationTesting"
                      >
                        <v-icon start>mdi-test-tube</v-icon>
                        테스트 발송
                      </v-btn>

                      <v-spacer></v-spacer>

                      <v-btn
                        color="warning"
                        variant="text"
                        @click="resetAutomationForm"
                      >
                        <v-icon start>mdi-refresh</v-icon>
                        초기화
                      </v-btn>
                    </v-card-actions>

                    <!-- 저장된 규칙 목록 -->
                    <v-divider class="my-4"></v-divider>
                    <div>
                      <h4 class="text-subtitle-1 mb-3 d-flex align-center">
                        <v-icon start>mdi-robot</v-icon>
                        저장된 자동화 규칙 ({{ automationRules.length }}/20)
                        <v-spacer></v-spacer>
                        <v-chip
                          v-if="authStore.isGoogleAuthenticated"
                          size="small"
                          color="success"
                          variant="outlined"
                        >
                          <v-icon start size="small">mdi-google</v-icon>
                          계정별 영구 저장
                        </v-chip>
                      </h4>
                      
                      <!-- 20개 제한 경고 -->
                      <v-alert
                        v-if="automationRules.length >= 20"
                        type="warning"
                        variant="outlined"
                        class="mb-3"
                        density="compact"
                      >
                        <v-icon start>mdi-alert</v-icon>
                        자동화 규칙이 최대 개수(20개)에 도달했습니다. 새 규칙을 추가하려면 기존 규칙을 삭제해주세요.
                      </v-alert>
                      
                      <div v-if="automationRules.length > 0">
                      <v-list density="compact">
                        <v-list-item
                          v-for="rule in automationRules"
                          :key="rule.id"
                          class="border rounded mb-2"
                        >
                          <template v-slot:prepend>
                            <v-icon :color="rule.enabled ? 'success' : 'error'">
                              {{ rule.enabled ? 'mdi-check-circle' : 'mdi-pause-circle' }}
                            </v-icon>
                          </template>
                          
                          <div class="flex-grow-1">
                            <v-list-item-title class="text-subtitle-2 font-weight-bold">
                              {{ rule.name }}
                            </v-list-item-title>
                            <v-list-item-subtitle class="mb-1">
                              조건: {{ rule.conditions.columnName }} → {{ rule.conditions.triggerValue }}
                            </v-list-item-subtitle>
                            <v-list-item-subtitle class="text-caption">
                              <v-chip
                                size="x-small"
                                color="primary"
                                variant="outlined"
                                class="mr-2"
                              >
                                시트: {{ rule.spreadsheetName || rule.targetDate || '미지정' }}
                              </v-chip>
                              <v-chip
                                size="x-small"
                                color="secondary"
                                variant="outlined"
                                class="mr-2"
                              >
                                ID: {{ rule.spreadsheetId ? rule.spreadsheetId.substring(0, 8) + '...' : '미지정' }}
                              </v-chip>
                              <v-chip
                                v-if="rule.userEmail"
                                size="x-small"
                                color="info"
                                variant="outlined"
                                class="mr-2"
                              >
                                <v-icon start size="x-small">mdi-account</v-icon>
                                {{ rule.userEmail }}
                              </v-chip>
                              <span class="text-grey">
                                생성: {{ formatDate(rule.createdAt) }}
                              </span>
                            </v-list-item-subtitle>
                          </div>

                          <template v-slot:append>
                            <v-btn
                              size="small"
                              icon
                              variant="text"
                              @click="toggleRule(rule)"
                            >
                              <v-icon>{{ rule.enabled ? 'mdi-pause' : 'mdi-play' }}</v-icon>
                            </v-btn>
                            <v-btn
                              size="small"
                              icon
                              variant="text"
                              color="error"
                              @click="deleteRule(rule)"
                            >
                              <v-icon>mdi-delete</v-icon>
                            </v-btn>
                          </template>
                        </v-list-item>
                      </v-list>
                      </div>
                      <div v-else class="text-center text-medium-emphasis py-4">
                        <v-icon size="48" color="medium-emphasis">mdi-robot-outline</v-icon>
                        <p class="mt-2">저장된 자동화 규칙이 없습니다.</p>
                        <p class="text-caption">위에서 자동화 규칙을 설정하고 저장해보세요.</p>
                      </div>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- QR Code Modal -->
    <v-dialog v-model="qrDialog" max-width="400">
      <v-card>
        <v-card-title class="text-center">
          <v-icon start color="primary">mdi-qrcode</v-icon>
          QR 코드
        </v-card-title>
        <v-card-text class="text-center">
          <div v-if="qrLoading" class="py-8">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
            <p class="mt-4">QR 코드 생성 중...</p>
          </div>
          <div v-else-if="qrImageData" class="py-4">
            <img :src="qrImageData" alt="QR Code" style="max-width: 100%; height: auto;" />
            <v-chip color="primary" size="small" class="mt-4">
              {{ qrStaffName }}
            </v-chip>
            <br>
            <small class="text-grey">{{ formatDateDisplay(selectedDateString) }}</small>
            <v-alert type="info" variant="tonal" class="mt-4 text-left">
              <strong>사용법:</strong><br>
              1. 카메라로 QR 코드를 스캔하세요<br>
              2. 자동으로 배송 관리 페이지가 열립니다<br>
              3. 배송 현황을 확인하고 상태를 업데이트하세요
            </v-alert>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="closeQRDialog">닫기</v-btn>
          <v-btn 
            v-if="qrImageData" 
            color="primary" 
            variant="elevated" 
            @click="downloadQRCode"
          >
            <v-icon start>mdi-download</v-icon>
            다운로드
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { API_BASE_URL } from '@/config/api';

const authStore = useAuthStore();

// Loading states
const googleLoading = ref(false);
const solapiLoading = ref(false);

// Google Sheets data
const connectedSheetName = ref<string>('');

// SOLAPI data
const solapiBalance = ref<string>('');

// Automation data
const automationEnabled = ref<boolean>(true);
const automationRules = ref<any[]>([]);
const automationSaving = ref<boolean>(false);
const automationTesting = ref<boolean>(false);
const automationForm = ref({
  conditionColumn: '',
  triggerValue: '',
  actionType: 'sms',
  senderNumber: '',
  recipientColumn: '',
  messageTemplate: '#{고객명}님, 주문해주셔서 대단히 감사합니다.'
});
const accountInfoLoading = ref(false);

// Alert function for user notifications
const showAlert = (message: string, type: 'info' | 'warning' | 'error' = 'info'): void => {
  // Simple alert for now - can be enhanced with toast notifications later
  const prefix = type === 'error' ? '❌ ' : type === 'warning' ? '⚠️ ' : 'ℹ️ ';
  alert(prefix + message);
};

// SMS 발송 관련
// 새로운 SMS 폼 구현
const newSmsForm = ref({
  fromNumber: '',
  toNumber: '',
  message: ''
});

const isSending = ref(false);

// 메시지 길이 계산 - computed 속성으로 자동 반응
const messageLength = computed(() => newSmsForm.value.message.length);
const messageType = computed(() => messageLength.value > 90 ? 'LMS' : 'SMS');

// 폼 유효성 검사
const canSubmit = computed(() => {
  return newSmsForm.value.fromNumber.trim() && 
         newSmsForm.value.toNumber.trim() && 
         newSmsForm.value.message.trim() &&
         !isSending.value;
});

// Automation computed properties
const sheetColumns = computed(() => {
  return dynamicHeaders.value || [];
});

const canSaveAutomation = computed(() => {
  return automationForm.value.conditionColumn &&
         automationForm.value.triggerValue &&
         automationForm.value.actionType &&
         automationForm.value.senderNumber &&
         automationForm.value.recipientColumn &&
         automationForm.value.messageTemplate;
});

const canTestAutomation = computed(() => {
  return canSaveAutomation.value && sheetData.value.length > 0;
});

// Form validation rules

// Staff management
const staffList = ref<{ name: string }[]>([
  { name: '김배송' },
  { name: '박운송' },
  { name: '이택배' },
  { name: '정물류' },
  { name: '최배송' }
]);

// Calendar and data management
const selectedDate = ref<Date | null>(null);
const selectedDateString = ref<string>('');
const sheetData = ref<any[]>([]);
const sheetDataByStaff = ref<{ [staffName: string]: any[] }>({});
const dynamicHeaders = ref<string[]>([]);
const currentSpreadsheetId = ref<string>(''); // 현재 연결된 스프레드시트 ID
const dataLoading = ref(false);
const itemsPerPage = ref(10);
const selectedStaff = ref<string>('전체');

// Mobile pagination
const currentPage = ref(1);

// Dynamic Filters system
const activeFilters = ref<Array<{id: string, column: string, value: string}>>([]);

// QR Code modal
const qrDialog = ref(false);
const qrLoading = ref(false);
const qrImageData = ref<string>('');
const qrStaffName = ref<string>('');

// Future use: table headers for data display
// const tableHeaders = computed(() => {
//   const baseHeaders: Array<{ title: string; key: string; width?: string }> = [
//     { title: '행', key: 'rowIndex', width: '80px' },
//   ];
//   
//   // Use dynamic headers from the actual sheet only
//   if (dynamicHeaders.value.length > 0) {
//     dynamicHeaders.value.forEach(header => {
//       if (header !== 'rowIndex' && header !== 'staffName') {
//         baseHeaders.push({ 
//           title: header, 
//           key: header
//         });
//       }
//     });
//   }
//   
//   return baseHeaders;
// });

// Future use: form validation rules
// const rules = {
//   required: (value: string): boolean | string => !!value || '필수 입력 항목입니다.',
// };

// Computed
const availableStaff = computed(() => {
  const staffNames = Object.keys(sheetDataByStaff.value);
  return ['전체', ...staffNames];
});



const currentDisplayData = computed(() => {
  if (selectedStaff.value === '전체') {
    return sheetData.value;
  } else {
    return sheetDataByStaff.value[selectedStaff.value] || [];
  }
});

const filteredData = computed(() => {
  return currentDisplayData.value.filter(item => {
    // Check each active filter
    return activeFilters.value.every(filter => {
      if (!filter.value || !item[filter.column]) return true;
      
      const itemValue = String(item[filter.column]).toLowerCase();
      const filterValue = filter.value.toLowerCase();
      
      return itemValue.includes(filterValue);
    });
  });
});

// Filter management methods
const addFilter = (): void => {
  const newId = `filter_${Date.now()}`;
  activeFilters.value.push({
    id: newId,
    column: availableColumns.value[0] || '',
    value: ''
  });
};

const removeFilter = (filterId: string): void => {
  activeFilters.value = activeFilters.value.filter(f => f.id !== filterId);
};

const updateFilterColumn = (filterId: string, column: string): void => {
  const filter = activeFilters.value.find(f => f.id === filterId);
  if (filter) {
    filter.column = column;
  }
};

const updateFilterValue = (filterId: string, value: string): void => {
  const filter = activeFilters.value.find(f => f.id === filterId);
  if (filter) {
    filter.value = value;
  }
};

const clearAllFilters = (): void => {
  activeFilters.value = [];
};

// Available columns for filters (exclude rowIndex)
const availableColumns = computed(() => {
  return dynamicHeaders.value.filter(header => header !== 'rowIndex' && header !== 'staffName');
});

// Mobile view computed properties
const displayableHeaders = computed(() => {
  return dynamicHeaders.value.filter(header => 
    header !== 'rowIndex' && header !== 'staffName'
  );
});

const totalPages = computed(() => {
  return Math.ceil(filteredData.value.length / itemsPerPage.value);
});


const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredData.value.slice(start, end);
});

// Mobile utility methods
const getOrderTitle = (order: any): string => {
  // Find customer name or use row index
  const nameHeaders = displayableHeaders.value.filter(header => 
    header.includes('이름') || header.includes('고객') || header.includes('성명')
  );
  
  if (nameHeaders.length > 0 && order[nameHeaders[0]]) {
    return order[nameHeaders[0]];
  }
  
  return `배송 #${order.rowIndex || '미상'}`;
};

const getOrderStatus = (order: any): string => {
  // More specific status header detection to avoid matching "배송지"
  const statusHeaders = displayableHeaders.value.filter(header => {
    const lowerHeader = header.toLowerCase();
    return (
      lowerHeader.includes('배송상태') ||
      lowerHeader.includes('배송상태') ||
      lowerHeader === '상태' ||
      lowerHeader === '배송' ||
      lowerHeader.includes('진행상태') ||
      lowerHeader.includes('status')
    ) && !lowerHeader.includes('배송지') && !lowerHeader.includes('주소');
  });
  
  if (statusHeaders.length > 0) {
    return order[statusHeaders[0]] || '미상';
  }
  
  // Fallback: check if there's a specific "배송상태" header
  if (order['배송상태']) {
    return order['배송상태'];
  }
  
  return '미상';
};

const getOrderStatusColor = (order: any): string => {
  const status = getOrderStatus(order);
  
  switch (status) {
    case '주문 완료': return 'blue-grey';
    case '상품 준비중': return 'orange';
    case '배송 준비중': return 'warning';
    case '배송 출발': return 'info';
    case '배송 완료': return 'success';
    default: return 'grey';
  }
};

const isOrderCompleted = (order: any): boolean => {
  const status = getOrderStatus(order).trim().toLowerCase();
  
  // Only consider specific delivery/shipment completion statuses
  // Exclude generic '완료' to avoid counting '주문 완료' as completed
  const completedStatuses = [
    '배송 완료', '배송완료', 
    '배송 완료', '배송완료',
    '수령 완료', '수령완료'
  ];
  
  return completedStatuses.some(completedStatus => 
    status === completedStatus.toLowerCase()
  );
};

// Additional methods for unified card view
const getCompletedOrdersCount = (): number => {
  return filteredData.value.filter(order => isOrderCompleted(order)).length;
};

const getPendingOrdersCount = (): number => {
  return filteredData.value.filter(order => !isOrderCompleted(order)).length;
};

const getCompletionRate = (): number => {
  if (filteredData.value.length === 0) return 0;
  return Math.round((getCompletedOrdersCount() / filteredData.value.length) * 100);
};

const getStaffName = (order: any): string => {
  // More specific staff header detection
  const staffHeaders = displayableHeaders.value.filter(header => {
    const lowerHeader = header.toLowerCase();
    return (
      lowerHeader.includes('담당자') ||
      lowerHeader.includes('배송담당자') ||
      lowerHeader.includes('배송담당자') ||
      lowerHeader.includes('직원') ||
      (lowerHeader.includes('배송') && lowerHeader.includes('담당'))
    ) && !lowerHeader.includes('상태') && !lowerHeader.includes('배송지');
  });
  
  if (staffHeaders.length > 0) {
    return order[staffHeaders[0]] || '';
  }
  
  // Fallback: check specific header names
  if (order['배송 담당자']) {
    return order['배송 담당자'];
  }
  
  return '';
};

// Removed copyOrderInfo function as copy button was removed from card view

const openStaffPage = (staffName: string): void => {
  if (staffName && selectedDateString.value) {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/delivery/${selectedDateString.value}/${encodeURIComponent(staffName)}`;
    window.open(url, '_blank');
  }
};

// Google Sheets integration methods
const connectGoogleSheets = async (): Promise<void> => {
  googleLoading.value = true;
  try {
    // TODO: Implement Google OAuth2 flow
    console.log('Connecting to Google Sheets...');
    // Redirect to backend OAuth endpoint
    window.location.href = `${API_BASE_URL}/api/auth/google`;
  } catch (error) {
    console.error('Google Sheets connection failed:', error);
  } finally {
    googleLoading.value = false;
  }
};

const disconnectGoogleSheets = async (): Promise<void> => {
  try {
    await authStore.logoutGoogle();
    connectedSheetName.value = '';
    staffList.value = [];
  } catch (error) {
    console.error('Failed to disconnect Google Sheets:', error);
  }
};

// SOLAPI integration methods
const connectSolapi = async (): Promise<void> => {
  solapiLoading.value = true;
  try {
    // Check if Google authentication is available first
    if (!authStore.isGoogleAuthenticated) {
      // Show guidance to connect Google first
      showAlert('SOLAPI 연결을 위해서는 먼저 Google 계정으로 로그인해주세요.', 'warning');
      solapiLoading.value = false;
      return;
    }

    console.log('Connecting to SOLAPI...');
    
    // Try to get SOLAPI auth URL
    const response = await fetch(`${API_BASE_URL}/api/solapi/auth/login`, {
      method: 'GET',
      credentials: 'include'
    });

    if (response.ok) {
      // Successful redirect URL, navigate there
      window.location.href = `${API_BASE_URL}/api/solapi/auth/login`;
    } else {
      // Handle guidance response
      const result = await response.json();
      
      if (result.requiresGoogleAuth) {
        showAlert(result.message + '\n\n1. ' + result.guide.step1 + '\n2. ' + result.guide.step2, 'info');
      } else {
        showAlert(result.message || 'SOLAPI 연결에 실패했습니다.', 'error');
      }
    }
  } catch (error) {
    console.error('SOLAPI connection failed:', error);
    showAlert('SOLAPI 연결 중 오류가 발생했습니다.', 'error');
  } finally {
    solapiLoading.value = false;
  }
};

const disconnectSolapi = async (): Promise<void> => {
  try {
    await authStore.logoutSolapi();
    solapiBalance.value = '';
    smsPricing.value = '';
    clearSmsForm(); // SMS 폼도 초기화
  } catch (error) {
    console.error('Failed to disconnect SOLAPI:', error);
  }
};

const loadAccountInfo = async (): Promise<void> => {
  accountInfoLoading.value = true;
  try {
    // Load balance information
    const balanceResponse = await fetch(`${API_BASE_URL}/api/solapi/account/balance`, {
      method: 'GET',
      credentials: 'include',
    });

    if (balanceResponse.ok) {
      const balanceData = await balanceResponse.json();
      if (balanceData.success && balanceData.data) {
        solapiBalance.value = `${balanceData.data.balance || 0}원 / ${balanceData.data.point || 0}P`;
      }
    }


  } catch (error) {
    console.error('Failed to load account info:', error);
    solapiBalance.value = '조회 실패';
  } finally {
    accountInfoLoading.value = false;
  }
};

// SMS 발송 관련 메서드들
// SMS 폼 초기화
const clearSmsForm = () => {
  newSmsForm.value = {
    fromNumber: '',
    toNumber: '',
    message: ''
  };
};

// SMS 전송 처리 - 완전히 새로운 구현
const handleSmsSubmit = async () => {
  if (!canSubmit.value) return;
  
  try {
    isSending.value = true;
    
    const response = await fetch(`${API_BASE_URL}/api/solapi/message/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        from: newSmsForm.value.fromNumber.replace(/-/g, ''),
        to: newSmsForm.value.toNumber.replace(/-/g, ''),
        text: newSmsForm.value.message,
        type: messageType.value
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('SMS 전송 성공:', result);
      alert(`SMS 전송 성공!\n메시지 ID: ${result.data.messageId || 'N/A'}`);
      clearSmsForm();
    } else {
      throw new Error(result.message || 'SMS 전송 실패');
    }
  } catch (error: any) {
    console.error('SMS 전송 오류:', error);
    alert(`SMS 전송 실패: ${error.message || '알 수 없는 오류'}`);
  } finally {
    isSending.value = false;
  }
};

// Staff management methods - removed addStaff as input field is now used for filtering



const generateQR = async (staffName: string): Promise<void> => {
  if (!selectedDateString.value) {
    console.warn('No date selected for QR generation');
    return;
  }
  
  qrStaffName.value = staffName;
  qrDialog.value = true;
  qrLoading.value = true;
  qrImageData.value = '';
  
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/delivery/qr/generate-mobile/${encodeURIComponent(staffName)}/${selectedDateString.value}`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      qrImageData.value = result.data.qrImage;
      console.log('QR code generated for:', staffName);
      console.log('Mobile URL:', result.data.qrUrl);
    } else {
      console.error('QR generation failed:', result.message);
      // Close modal on error
      qrDialog.value = false;
    }
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    // Close modal on error
    qrDialog.value = false;
  } finally {
    qrLoading.value = false;
  }
};

const closeQRDialog = (): void => {
  qrDialog.value = false;
  qrImageData.value = '';
  qrStaffName.value = '';
};

const downloadQRCode = (): void => {
  if (qrImageData.value && qrStaffName.value && selectedDateString.value) {
    const link = document.createElement('a');
    link.href = qrImageData.value;
    link.download = `qr-${qrStaffName.value}-${selectedDateString.value}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Calendar and data methods



// Calendar computed properties
const currentMonthDisplay = computed(() => {
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  return `${currentYear.value}년 ${monthNames[currentMonth.value]}`;
});

const calendarDays = computed(() => {
  const firstDay = new Date(currentYear.value, currentMonth.value, 1);
  new Date(currentYear.value, currentMonth.value + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  const days = [];
  const today = new Date();
  const maxDate = new Date();
  
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    const isCurrentMonth = date.getMonth() === currentMonth.value;
    const isToday = date.toDateString() === today.toDateString();
    const isSelected = selectedDateString.value === formatDateToYYYYMMDD(date);
    const isDisabled = date > maxDate;
    
    days.push({
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      day: date.getDate(),
      date: date,
      isOtherMonth: !isCurrentMonth,
      isToday: isToday,
      isSelected: isSelected,
      isDisabled: isDisabled
    });
  }
  
  return days;
});

// Calendar methods
const prevMonth = (): void => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
};

const nextMonth = (): void => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
};

const selectDate = (date: any): void => {
  if (date.isDisabled) return;
  
  selectedDate.value = date.date;
  selectedDateString.value = formatDateToYYYYMMDD(date.date);
  loadSheetData(selectedDateString.value);
};

const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const formatDateDisplay = (dateString: string): string => {
  if (dateString.length === 8) {
    const year = dateString.slice(0, 4);
    const month = dateString.slice(4, 6);
    const day = dateString.slice(6, 8);
    return `${year}년 ${month}월 ${day}일`;
  }
  return dateString;
};

// Helper function to get session headers
const getSessionHeaders = (): HeadersInit => {
  const headers: Record<string, string> = {};
  
  // Session is now managed via httpOnly cookies automatically
  // No need to manually add session headers - cookies are sent automatically
  
  return headers;
};

const loadSheetData = async (dateString: string): Promise<void> => {
  if (!dateString) return;
  
  dataLoading.value = true;
  try {
    // Load data grouped by staff
    const staffResponse = await fetch(`${API_BASE_URL}/api/sheets/date/${dateString}/by-staff`, {
      method: 'GET',
      credentials: 'include',
      headers: getSessionHeaders(),
    });
    
    const staffResult = await staffResponse.json();
    
    if (staffResult.success) {
      sheetDataByStaff.value = staffResult.data.ordersByStaff || {};
      dynamicHeaders.value = staffResult.headers || [];
      currentSpreadsheetId.value = staffResult.data.spreadsheetId || ''; // spreadsheetId 저장
      // Clear existing filters when loading new data
      activeFilters.value = [];
      
      // Flatten all staff data for "전체" view
      const allData = Object.values(sheetDataByStaff.value).flat();
      sheetData.value = allData;
      
      // Update staff list from actual sheet data
      const detectedStaff = Object.keys(sheetDataByStaff.value).map(name => ({ name }));
      staffList.value = detectedStaff;
      
      console.log('Sheet data by staff loaded:', staffResult.data);
      console.log('Current spreadsheetId:', currentSpreadsheetId.value);
      console.log('Raw ordersByStaff:', sheetDataByStaff.value);
      console.log('AllData after flatten:', allData);
      console.log('Headers:', dynamicHeaders.value);
      console.log('Total items:', allData.length);
      console.log('Detected staff:', detectedStaff);
    } else {
      // Fallback to original API for backwards compatibility
      const response = await fetch(`${API_BASE_URL}/api/sheets/date/${dateString}`, {
        method: 'GET',
        credentials: 'include',
        headers: getSessionHeaders(),
      });
      
      const result = await response.json();
      
      if (result.success) {
        sheetData.value = result.data.orders || result.data || [];
        dynamicHeaders.value = result.headers || [];
        currentSpreadsheetId.value = result.data.spreadsheetId || ''; // spreadsheetId 저장
        // Clear existing filters when loading new data
        
        sheetDataByStaff.value = {};
        staffList.value = [];
        console.log('Sheet data loaded (fallback):', result.data);
        console.log('Current spreadsheetId (fallback):', currentSpreadsheetId.value);
        console.log('Headers (fallback):', dynamicHeaders.value);
      } else {
        sheetData.value = [];
        sheetDataByStaff.value = {};
        dynamicHeaders.value = [];
        staffList.value = [];
        console.warn('No data found for date:', dateString, result.message);
      }
    }
  } catch (error) {
    console.error('Failed to load sheet data:', error);
    sheetData.value = [];
    sheetDataByStaff.value = {};
    dynamicHeaders.value = [];
    staffList.value = [];
  } finally {
    dataLoading.value = false;
  }
};

const refreshData = (): void => {
  if (selectedDateString.value) {
    loadSheetData(selectedDateString.value);
  }
};



// Removed unused functions for simplified workflow

// Mobile calendar data
const currentMonth = ref(new Date().getMonth());
const currentYear = ref(new Date().getFullYear());
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

// Initialize and check auth status
onMounted(async () => {
  console.log('AdminView mounted, checking auth status...');
  
  // Check URL parameters for OAuth callbacks
  const urlParams = new URLSearchParams(window.location.search);
  
  // Session is now managed via httpOnly cookies - no need to handle sessionId from URL
  
  await authStore.checkAuthStatus();
  
  if (urlParams.get('auth') === 'success') {
    console.log('Authentication successful');
    await authStore.checkAuthStatus(); // Refresh status
    // Clean URL (remove all OAuth params)
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  if (urlParams.get('google_auth') === 'success') {
    console.log('Google authentication successful');
    await authStore.checkAuthStatus(); // Refresh status
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  if (urlParams.get('solapi') === 'success') {
    console.log('SOLAPI authentication successful');  
    await authStore.checkAuthStatus(); // Refresh status
    await loadAccountInfo(); // Load account info after successful auth
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  // Load automation rules only if Google is authenticated
  if (authStore.isGoogleAuthenticated) {
    await loadAutomationRules();
  }
});

// Watch for auth status changes to update UI data
watch(() => authStore.isGoogleAuthenticated, (newValue) => {
  if (newValue) {
    // Load Google Sheets data and automation rules when authenticated
    connectedSheetName.value = 'Connected Spreadsheet';
    loadAutomationRules();
  } else {
    // Clear data when not authenticated
    connectedSheetName.value = '';
    staffList.value = [];
    automationRules.value = [];
  }
});

watch(() => authStore.isSolapiAuthenticated, (newValue) => {
  if (newValue) {
    // Load SOLAPI data when authenticated
    loadAccountInfo();
  } else {
    solapiBalance.value = '';
  }
});

watch(selectedDateString, (newDate) => {
  if (newDate) {
    loadSheetData(newDate);
    currentPage.value = 1; // Reset pagination
  }
});

watch(filteredData, () => {
  currentPage.value = 1; // Reset pagination when data changes
});

// Automation methods
const saveAutomationRule = async (): Promise<void> => {
  if (!canSaveAutomation.value) return;
  
  automationSaving.value = true;
  try {
    const ruleName = `${automationForm.value.conditionColumn} → ${automationForm.value.triggerValue}`;
    
    const response = await fetch(`${API_BASE_URL}/api/automation/rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        name: ruleName,
        spreadsheetId: currentSpreadsheetId.value, // 현재 달력 선택된 시트 ID
        spreadsheetName: selectedDateString.value, // 현재 달력 선택된 날짜/시트명
        targetDate: selectedDateString.value, // 달력에서 선택한 날짜 기준
        conditions: {
          columnName: automationForm.value.conditionColumn,
          triggerValue: automationForm.value.triggerValue,
          operator: 'changes_to'
        },
        actions: {
          type: automationForm.value.actionType,
          senderNumber: automationForm.value.senderNumber,
          recipientColumn: automationForm.value.recipientColumn,
          messageTemplate: automationForm.value.messageTemplate
        }
      })
    });

    const result = await response.json();
    
    if (result.success) {
      automationRules.value.push(result.data);
      resetAutomationForm();
      console.log('자동화 규칙이 저장되었습니다:', result.data.name);
    } else {
      console.error('자동화 규칙 저장 실패:', result.message);
    }
  } catch (error) {
    console.error('자동화 규칙 저장 중 오류:', error);
  } finally {
    automationSaving.value = false;
  }
};

const testAutomation = async (): Promise<void> => {
  if (!canTestAutomation.value) return;
  
  automationTesting.value = true;
  try {
    // Use first row of sheet data for testing
    const testData = sheetData.value[0];
    
    const response = await fetch(`${API_BASE_URL}/api/automation/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        ruleId: 'test-rule',
        testData: testData
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('자동화 테스트가 완료되었습니다');
    } else {
      console.error('자동화 테스트 실패:', result.message);
    }
  } catch (error) {
    console.error('자동화 테스트 중 오류:', error);
  } finally {
    automationTesting.value = false;
  }
};

const resetAutomationForm = (): void => {
  automationForm.value = {
    conditionColumn: '',
    triggerValue: '',
    actionType: 'sms',
    senderNumber: '',
    recipientColumn: '',
    messageTemplate: '#{고객명}님, 주문해주셔서 대단히 감사합니다.'
  };
};

const toggleRule = async (rule: any): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/automation/rules/${rule.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        ...rule,
        enabled: !rule.enabled
      })
    });

    const result = await response.json();
    
    if (result.success) {
      rule.enabled = !rule.enabled;
      console.log(`자동화 규칙 ${rule.enabled ? '활성화' : '비활성화'}:`, rule.name);
    }
  } catch (error) {
    console.error('자동화 규칙 상태 변경 중 오류:', error);
  }
};

const deleteRule = async (rule: any): Promise<void> => {
  if (!confirm('정말로 이 자동화 규칙을 삭제하시겠습니까?')) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/automation/rules/${rule.id}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    const result = await response.json();
    
    if (result.success) {
      const index = automationRules.value.findIndex(r => r.id === rule.id);
      if (index > -1) {
        automationRules.value.splice(index, 1);
      }
      console.log('자동화 규칙이 삭제되었습니다:', rule.name);
    }
  } catch (error) {
    console.error('자동화 규칙 삭제 중 오류:', error);
  }
};

const loadAutomationRules = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/automation/rules`, {
      method: 'GET',
      credentials: 'include'
    });

    const result = await response.json();
    
    if (result.success) {
      automationRules.value = result.data || [];
    }
  } catch (error) {
    console.error('자동화 규칙 로드 중 오류:', error);
  }
};

// Format date for display
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString || '';
  }
};
</script>

<style scoped>
/* Modern Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  animation: slideInUp 0.6s ease forwards;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--accent-color);
}

.stat-card.total {
  --accent-color: linear-gradient(45deg, #667eea, #764ba2);
}

.stat-card.completed {
  --accent-color: linear-gradient(45deg, #56ab2f, #a8e6cf);
}

.stat-card.pending {
  --accent-color: linear-gradient(45deg, #f7971e, #ffd200);
}

.stat-card.percentage {
  --accent-color: linear-gradient(45deg, #06beb6, #48b1bf);
}

.stat-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 1.5rem;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-color);
}

.stat-number {
  font-size: 3rem;
  font-weight: 800;
  color: #2d3748;
  line-height: 1;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.9rem;
  color: #718096;
  font-weight: 500;
  margin-bottom: 1rem;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-color);
  border-radius: 3px;
  transition: width 0.3s ease;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stat-card:nth-child(1) { animation-delay: 0.1s; }
.stat-card:nth-child(2) { animation-delay: 0.2s; }
.stat-card:nth-child(3) { animation-delay: 0.3s; }
.stat-card:nth-child(4) { animation-delay: 0.4s; }

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  
  .stat-card {
    padding: 1.5rem;
  }
  
  .stat-number {
    font-size: 2.5rem;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }
  
  .stat-card {
    padding: 1rem;
  }
  
  .stat-number {
    font-size: 2rem;
  }
  
  .stat-label {
    font-size: 0.8rem;
  }
  
  .stat-icon {
    width: 40px;
    height: 40px;
  }
}

/* Unified Card View Styles */
.unified-card-container {
  width: 100%;
}

/* Summary Cards */
.summary-card {
  height: 140px;
  display: flex;
  align-items: center;
}

.summary-card .v-card-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.v-card.v-theme--light.v-card--variant-tonal {
  border-radius: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.v-card.v-theme--light.v-card--variant-tonal:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

/* Unified Data Cards */
.unified-data-card {
  border-radius: 16px;
  transition: all 0.3s ease;
  position: relative;
  height: 100%;
  background: linear-gradient(135deg, #ffffff 0%, #fafafa 100%);
}

.unified-data-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15) !important;
}

/* Customer Card Hover Effect */
.customer-card-hover {
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.customer-card-hover:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2) !important;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%);
  border-color: #1976d2 !important;
}

.unified-data-card.completed-order {
  border-left: 6px solid #4caf50;
  background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 50%, #ffffff 100%);
}

.unified-data-card.completed-order::before {
  content: '✓';
  position: absolute;
  top: 12px;
  right: 12px;
  background: #4caf50;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

/* Unified card header */
.unified-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid #f0f0f0;
}

.order-info {
  flex: 1;
}

.order-title-unified {
  font-size: 20px;
  font-weight: 800;
  color: #1565c0;
  margin: 0;
  line-height: 1.2;
}

.order-row-info {
  font-size: 12px;
  color: #666;
  margin: 4px 0 0 0;
  font-weight: 500;
}

.status-chip-unified {
  font-size: 13px;
  font-weight: 700;
  height: 28px;
  padding: 0 12px;
  border-radius: 14px;
}

/* Unified card content */
.unified-card-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.detail-row-unified {
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.detail-row-unified:hover {
  transform: translateX(4px);
}

.field-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.field-label-unified {
  font-size: 14px;
  font-weight: 600;
  color: #555;
}

/* Unified address section */
.address-section-unified {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  padding: 16px 20px;
  border-radius: 12px;
  border-left: 6px solid #1976d2;
  position: relative;
}

.address-text-unified {
  font-size: 16px;
  font-weight: 600;
  color: #1565c0;
  line-height: 1.5;
  word-break: break-word;
  padding-left: 26px;
}

/* Unified phone section */
.phone-section-unified {
  background-color: #e8f5e8;
  padding: 16px 20px;
  border-radius: 12px;
  border-left: 6px solid #4caf50;
}

.phone-link-unified {
  color: #2e7d32;
  text-decoration: none;
  font-weight: 700;
  font-size: 16px;
  display: block;
  padding-left: 26px;
  transition: all 0.2s ease;
}

.phone-link-unified:hover {
  text-decoration: underline;
  color: #1b5e20;
  transform: scale(1.02);
}

/* Unified customer section */
.customer-section-unified {
  background-color: #fff3e0;
  padding: 16px 20px;
  border-radius: 12px;
  border-left: 6px solid #ff9800;
}

.customer-name-unified {
  font-size: 17px;
  font-weight: 800;
  color: #f57c00;
  padding-left: 26px;
}

.staff-section-unified {
  background-color: #f5f5f5;
  padding: 16px 20px;
  border-radius: 12px;
  border-left: 6px solid #757575;
}

.staff-name-unified {
  font-size: 17px;
  font-weight: 800;
  color: #424242;
  padding-left: 26px;
}

/* Unified other fields */
.other-field-unified {
  background-color: #f8f9fa;
  padding: 12px 16px;
  border-radius: 10px;
  border-left: 3px solid #e0e0e0;
}

.field-value-unified {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  padding-left: 26px;
  display: block;
  margin-top: 4px;
}

/* Card actions */
.unified-card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  border-top: 1px solid #f0f0f0;
  padding-top: 16px;
}

.action-btn {
  font-size: 12px;
  font-weight: 600;
  height: 32px;
  border-radius: 16px;
  min-width: 80px;
}

/* Pagination */
.unified-pagination {
  margin-top: 24px;
}

/* Field labels and values */
.field-label-mobile {
  font-size: 13px;
  font-weight: 500;
  color: #666;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.field-value-mobile {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

/* Mobile pagination */
.mobile-pagination {
  margin-top: 16px;
}

/* Mobile filter enhancements */
.mobile-filter-section {
  margin-bottom: 20px;
}

.filter-card {
  border-radius: 12px;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
}

.mobile-filter-btn {
  font-weight: 600;
  min-width: 120px;
}

.mobile-filters-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Status Inline Row */
.status-inline-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.status-chip-only {
  display: flex;
  justify-content: flex-end;
}

.status-separator {
  font-size: 13px;
  font-weight: 500;
  color: #666;
  margin: 0 4px;
}

.staff-name-btn {
  font-size: 11px;
  font-weight: 600;
  height: 24px;
  min-width: auto;
  padding: 0 8px;
}

.qr-btn {
  font-size: 11px;
  font-weight: 600;
  height: 24px;
  min-width: auto;
  padding: 0 8px;
}

/* Customer Tooltip Styles */
.customer-tooltip-content {
  max-width: 350px;
  padding: 8px 0;
}

.tooltip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 14px;
  line-height: 1.4;
  color: white !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.tooltip-row:last-child {
  border-bottom: none;
}

.tooltip-row strong {
  min-width: 80px;
  color: white !important;
  font-weight: 600;
}

.tooltip-row .v-icon {
  flex-shrink: 0;
  color: white !important;
}

.mobile-filter-item {
  border-radius: 12px;
}

/* Mobile staff management */
/* Removed staff management styles as section was removed */

.staff-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.staff-info {
  display: flex;
  align-items: center;
}

.staff-name {
  font-size: 18px;
  font-weight: 700;
  color: #1565c0;
  margin: 0;
}

.staff-subtitle {
  font-size: 13px;
  color: #666;
  margin: 2px 0 0 0;
}

.staff-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.mobile-action-btn {
  font-size: 12px;
  font-weight: 600;
  min-width: 100px;
  height: 36px;
  border-radius: 18px;
}

/* Desktop Date Picker */
.compact-date-picker {
  max-width: 320px !important;
  width: 100% !important;
}

.compact-date-picker .v-picker__body {
  padding: 8px !important;
}

.compact-date-picker .v-date-picker-controls {
  padding: 8px 12px !important;
  font-size: 14px !important;
}

.compact-date-picker .v-date-picker-month {
  padding: 8px 12px 12px 12px !important;
}

.compact-date-picker .v-date-picker-month__day-btn {
  font-size: 12px !important;
  min-width: 32px !important;
  height: 32px !important;
}

/* Embedded Calendar */
.calendar-container {
  width: 100%;
  max-width: 350px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #1976d2;
  color: white;
}

.calendar-nav-btn {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  font-weight: bold;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.calendar-nav-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.calendar-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.embedded-calendar {
  padding: 16px;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: #666;
  padding: 8px 4px;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #333;
  background: white;
}

.calendar-day:hover:not(.disabled) {
  background: #e3f2fd;
  transform: scale(1.05);
}

.calendar-day.other-month {
  color: #bbb;
}

.calendar-day.today {
  background: #bbdefb;
  color: #1565c0;
  font-weight: 700;
}

.calendar-day.selected {
  background: #1976d2;
  color: white;
  font-weight: 700;
}

.calendar-day.disabled {
  color: #ccc;
  cursor: not-allowed;
}

.calendar-day.disabled:hover {
  background: white;
  transform: none;
}

/* Mobile responsive */
@media (max-width: 480px) {
  .calendar-container {
    max-width: 300px;
  }
  
  .calendar-header {
    padding: 12px 16px;
  }
  
  .calendar-title {
    font-size: 16px;
  }
  
  .embedded-calendar {
    padding: 12px;
  }
  
  .calendar-day {
    font-size: 13px;
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  /* Show mobile layouts */
  .d-block.d-md-none {
    display: block !important;
  }
  
  .d-none.d-md-block {
    display: none !important;
  }
  
  /* Simplify filter layout on mobile */
  .mobile-filter-btn {
    min-width: 100px;
    flex: 1;
  }
  
  /* Adjust card spacing */
  .mobile-data-card {
    margin-bottom: 8px;
  }
  
  .mobile-card-content {
    gap: 8px;
  }
  
  /* Smaller text on very small screens */
  .order-title {
    font-size: 16px;
  }
  
  .address-text-mobile,
  .phone-link-mobile,
  .customer-name-mobile {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .mobile-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .status-chip {
    align-self: flex-end;
  }
  
  .other-field-mobile {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  /* Removed staff management mobile adjustments */
  
  .staff-card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .staff-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .mobile-action-btn {
    flex: 1;
    min-width: auto;
  }
  
  /* Filter adjustments for small screens */
  .mobile-filter-btn {
    min-width: 80px;
    font-size: 12px;
  }
}

/* Status Section with Actions */
.status-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.status-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

/* Tooltip Text Styling */
.tooltip-text {
  cursor: help;
  transition: all 0.2s ease;
  display: block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tooltip-text:hover {
  color: #1976d2;
  background-color: rgba(25, 118, 210, 0.04);
  border-radius: 4px;
  padding: 2px 4px;
}

.address-text-unified.tooltip-text {
  font-size: 13px;
  line-height: 1.4;
  color: #424242;
}

.phone-link-unified.tooltip-text {
  text-decoration: none;
  color: #2e7d32;
  font-weight: 500;
}

.phone-link-unified.tooltip-text:hover {
  color: #1b5e20;
  text-decoration: underline;
}

.staff-name-unified.tooltip-text {
  color: #2e7d32;
  font-weight: 600;
}

/* Responsive Status Actions */
@media (max-width: 768px) {
  .status-section {
    align-items: center;
  }
  
  .status-actions {
    flex-direction: column;
    gap: 2px;
  }
  
  .tooltip-text {
    max-width: 150px;
  }
}
</style>