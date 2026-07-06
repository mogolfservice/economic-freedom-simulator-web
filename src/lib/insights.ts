export type PlannerInsightTone = 'good' | 'warn' | 'default'

export type PlannerInsight = {
  tone: PlannerInsightTone
  message: string
}

export type PlannerInsightInput = {
  progress: number
  yearsToFi: number | null
  unlockedFiAssets: number
  fiNumber: number
  lockedFiAssets: number
  nextUnlockAge: number | null
  monthlyRetirementExpense: number
  totalMonthlyRetirementIncome: number
  expenseReductionImpact: number
}

const formatPercent = (value: number) => `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value * 100)}%`

function formatKoreanShortMoney(value: number): string {
  const safe = Math.max(0, Math.round(value))
  const eok = Math.floor(safe / 100_000_000)
  const man = Math.round((safe % 100_000_000) / 10_000)
  if (eok > 0 && man > 0) return `${eok}억 ${new Intl.NumberFormat('ko-KR').format(man)}만원`
  if (eok > 0) return `${eok}억원`
  return `${new Intl.NumberFormat('ko-KR').format(Math.round(safe / 10_000))}만원`
}

export function buildPlannerInsights(input: PlannerInsightInput): PlannerInsight[] {
  const insights: PlannerInsight[] = []

  if (input.progress >= 1 || input.yearsToFi === 0) {
    insights.push({ tone: 'good', message: '현재 사용가능 FI 자산만으로도 목표를 넘었습니다. 지금 은퇴 가능 조건입니다.' })
  } else if (input.yearsToFi === null) {
    insights.push({ tone: 'warn', message: '현재 조건으로는 은퇴 후 현금흐름 안정성을 만족하기 어렵습니다. 지출, 저축, 수익률 가정을 조정해 보세요.' })
  } else {
    insights.push({ tone: input.yearsToFi <= 10 ? 'good' : 'default', message: `현재 사용가능 FI 자산은 목표의 ${formatPercent(input.progress)}입니다.` })
  }

  if (input.monthlyRetirementExpense > 0) {
    insights.push({
      tone: 'default',
      message: `은퇴 후 월 생활비 ${formatKoreanShortMoney(input.monthlyRetirementExpense)} 중 연금/현금흐름으로 ${formatKoreanShortMoney(input.totalMonthlyRetirementIncome)}이 보전됩니다.`,
    })
  }

  if (input.lockedFiAssets > 0 && input.nextUnlockAge !== null) {
    insights.push({
      tone: 'default',
      message: `잠긴 FI 자산 ${formatKoreanShortMoney(input.lockedFiAssets)}은 ${input.nextUnlockAge}세 이후 인출 재원으로 반영됩니다.`,
    })
  }

  if (input.expenseReductionImpact > 0) {
    insights.push({
      tone: 'default',
      message: `지출을 10% 낮추면 목표 자산이 약 ${formatKoreanShortMoney(input.expenseReductionImpact)} 줄어듭니다.`,
    })
  }

  return insights
}
