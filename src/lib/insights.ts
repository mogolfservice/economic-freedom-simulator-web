export type PlannerInsightTone = 'good' | 'warn' | 'default'

export type PlannerInsight = {
  tone: PlannerInsightTone
  message: string
}

export type PlannerInsightLanguage = 'ko' | 'en' | 'ja'

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
  language?: PlannerInsightLanguage
  formatMoney?: (value: number) => string
}

const localeFor = (language: PlannerInsightLanguage) => language === 'en' ? 'en-US' : language === 'ja' ? 'ja-JP' : 'ko-KR'
const formatPercent = (value: number, language: PlannerInsightLanguage) => `${new Intl.NumberFormat(localeFor(language), { maximumFractionDigits: 1 }).format(value * 100)}%`

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
  const language = input.language ?? 'ko'
  const money = input.formatMoney ?? formatKoreanShortMoney

  if (input.progress >= 1 || input.yearsToFi === 0) {
    insights.push({ tone: 'good', message: language === 'en' ? 'Currently usable FI assets already exceed the target. Retirement is possible now under these assumptions.' : language === 'ja' ? '現在利用可能なFI資産だけで目標を上回っています。この条件では今すぐ退職可能です。' : '현재 사용가능 FI 자산만으로도 목표를 넘었습니다. 지금 은퇴 가능 조건입니다.' })
  } else if (input.yearsToFi === null) {
    insights.push({ tone: 'warn', message: language === 'en' ? 'Under the current assumptions, retirement cashflow stability is hard to satisfy. Try adjusting spending, savings, or return assumptions.' : language === 'ja' ? '現在の条件では退職後キャッシュフローの安定性を満たすのが難しいです。支出、貯蓄、リターン仮定を調整してください。' : '현재 조건으로는 은퇴 후 현금흐름 안정성을 만족하기 어렵습니다. 지출, 저축, 수익률 가정을 조정해 보세요.' })
  } else {
    insights.push({ tone: input.yearsToFi <= 10 ? 'good' : 'default', message: language === 'en' ? `Currently usable FI assets are ${formatPercent(input.progress, language)} of the target.` : language === 'ja' ? `現在利用可能なFI資産は目標の${formatPercent(input.progress, language)}です。` : `현재 사용가능 FI 자산은 목표의 ${formatPercent(input.progress, language)}입니다.` })
  }

  if (input.monthlyRetirementExpense > 0) {
    insights.push({
      tone: 'default',
      message: language === 'en' ? `${money(input.totalMonthlyRetirementIncome)} of monthly retirement spending ${money(input.monthlyRetirementExpense)} is covered by pensions/cashflows.` : language === 'ja' ? `退職後の月間生活費${money(input.monthlyRetirementExpense)}のうち、年金/キャッシュフローで${money(input.totalMonthlyRetirementIncome)}が補填されます。` : `은퇴 후 월 생활비 ${money(input.monthlyRetirementExpense)} 중 연금/현금흐름으로 ${money(input.totalMonthlyRetirementIncome)}이 보전됩니다.`,
    })
  }

  if (input.lockedFiAssets > 0 && input.nextUnlockAge !== null) {
    insights.push({
      tone: 'default',
      message: language === 'en' ? `Locked FI assets of ${money(input.lockedFiAssets)} are counted as drawdown resources after age ${input.nextUnlockAge}.` : language === 'ja' ? `ロックFI資産${money(input.lockedFiAssets)}は${input.nextUnlockAge}歳以降の取り崩し原資として反映されます。` : `잠긴 FI 자산 ${money(input.lockedFiAssets)}은 ${input.nextUnlockAge}세 이후 인출 재원으로 반영됩니다.`,
    })
  }

  if (input.expenseReductionImpact > 0) {
    insights.push({
      tone: 'default',
      message: language === 'en' ? `Reducing spending by 10% lowers the target assets by about ${money(input.expenseReductionImpact)}.` : language === 'ja' ? `支出を10%下げると、目標資産は約${money(input.expenseReductionImpact)}減ります。` : `지출을 10% 낮추면 목표 자산이 약 ${money(input.expenseReductionImpact)} 줄어듭니다.`,
    })
  }

  return insights
}
