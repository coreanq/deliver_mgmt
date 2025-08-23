/**
 * 배달 상태 관리 서비스
 * 상태 전환 검증 및 관리를 담당
 */
export class DeliveryStatusService {
  // 유효한 상태 전환 규칙
  private static readonly validTransitions: Record<string, string[]> = {
    '대기': ['준비중'],
    '준비중': ['출발'],
    '출발': ['완료'],
    '완료': [] // 완료 상태에서는 더 이상 전환 불가
  }

  // 모든 유효한 상태 목록
  private static readonly validStatuses = ['대기', '준비중', '출발', '완료']

  /**
   * 상태 전환이 유효한지 확인
   */
  static isValidTransition(currentStatus: string, newStatus: string): boolean {
    // 현재 상태가 유효하지 않으면 false
    if (!this.validStatuses.includes(currentStatus)) {
      return false
    }

    // 새 상태가 유효하지 않으면 false
    if (!this.validStatuses.includes(newStatus)) {
      return false
    }

    // 같은 상태로 전환은 허용 (상태 새로고침 등을 위해)
    if (currentStatus === newStatus) {
      return true
    }

    // 정의된 전환 규칙에 따라 확인
    const allowedTransitions = this.validTransitions[currentStatus]
    return allowedTransitions ? allowedTransitions.includes(newStatus) : false
  }

  /**
   * 상태가 유효한지 확인
   */
  static isValidStatus(status: string): boolean {
    return this.validStatuses.includes(status)
  }

  /**
   * 모든 유효한 상태 목록 반환
   */
  static getValidStatuses(): string[] {
    return [...this.validStatuses]
  }

  /**
   * 특정 상태에서 가능한 다음 상태들 반환
   */
  static getNextValidStatuses(currentStatus: string): string[] {
    if (!this.validStatuses.includes(currentStatus)) {
      return []
    }
    return this.validTransitions[currentStatus] || []
  }

  /**
   * 상태 전환 불가 이유 반환
   */
  static getTransitionError(currentStatus: string, newStatus: string): string {
    if (!this.validStatuses.includes(currentStatus)) {
      return `현재 상태 '${currentStatus}'가 유효하지 않습니다. 유효한 상태: ${this.validStatuses.join(', ')}`
    }

    if (!this.validStatuses.includes(newStatus)) {
      return `새로운 상태 '${newStatus}'가 유효하지 않습니다. 유효한 상태: ${this.validStatuses.join(', ')}`
    }

    if (currentStatus === newStatus) {
      return '' // 같은 상태로 전환은 오류가 아님
    }

    const allowedTransitions = this.validTransitions[currentStatus]
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      const nextStates = this.getNextValidStatuses(currentStatus)
      if (nextStates.length === 0) {
        return `'${currentStatus}' 상태에서는 더 이상 변경할 수 없습니다.`
      }
      return `'${currentStatus}' 상태에서 '${newStatus}'로 변경할 수 없습니다. 가능한 다음 상태: ${nextStates.join(', ')}`
    }

    return ''
  }

  /**
   * 상태가 완료 상태인지 확인
   */
  static isCompleted(status: string): boolean {
    return status === '완료'
  }

  /**
   * 상태가 진행 중인지 확인 (대기, 준비중, 출발)
   */
  static isInProgress(status: string): boolean {
    return ['대기', '준비중', '출발'].includes(status)
  }

  /**
   * 상태별 설명 반환
   */
  static getStatusDescription(status: string): string {
    const descriptions: Record<string, string> = {
      '대기': '주문 접수 완료, 준비 대기 중',
      '준비중': '음식 준비 중',
      '출발': '배달 출발',
      '완료': '배달 완료'
    }
    return descriptions[status] || '알 수 없는 상태'
  }

  /**
   * 상태별 색상 코드 반환 (UI용)
   */
  static getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      '대기': 'grey',
      '준비중': 'orange',
      '출발': 'blue',
      '완료': 'green'
    }
    return colors[status] || 'grey'
  }

  /**
   * 상태별 아이콘 반환 (UI용)
   */
  static getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      '대기': 'mdi-clock-outline',
      '준비중': 'mdi-chef-hat',
      '출발': 'mdi-truck-delivery',
      '완료': 'mdi-check-circle'
    }
    return icons[status] || 'mdi-help-circle'
  }
}

export default new DeliveryStatusService()