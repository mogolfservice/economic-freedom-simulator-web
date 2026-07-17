import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  calculateFiNumber,
  calculateMonthlyDebtPaymentAtAge,
  calculateMonthlyLivingExpenseAtAge,
  calculateNetWorth,
  calculateRetirementReadiness,
  calculateSavingsRate,
  calculateUnlockedFiAssets,
  calculateYearsToRetirementReadiness,
  createYearlyProjection,
  getSensitivityMatrix,
  projectAssetsToRetirementAge,
  toRealReturn,
  type Asset,
  type ChildExpense,
  type Liability,
  type LivingExpenseBand,
  type PensionCashflow,
  type SensitivityCase,
} from './lib/finance'
import { buildCashflowSegmentInsights, buildPlannerInsights } from './lib/insights'
import { calculateKoreaCostAdjustment, type KoreaCostAssumptions } from './lib/koreaCosts'
import { generateMarkdownReport } from './lib/report'
import { createDecisionScenarios } from './lib/scenarios'

type Language = 'ko' | 'en' | 'ja'
type CurrencyCode = 'KRW' | 'USD' | 'JPY' | 'EUR'

type PlannerState = {
  currentAge: number
  monthlyIncome: number
  monthlyContribution: number
  monthlyRetirementExpense: number
  livingExpenseBands: LivingExpenseBand[]
  nominalReturn: number
  inflationRate: number
  safeWithdrawalRate: number
  retirementYears: number
  assets: Asset[]
  liabilities: Liability[]
  pensions: PensionCashflow[]
  children: ChildExpense[]
}

type SavedScenario = {
  id: string
  savedAt: string
  yearsToFi: number | null
  retirementYear: number | null
  fiNumber: number
  progress: number
  state: PlannerState
}

type Copy = {
  locale: string
  eyebrow: string
  title: string
  hero: string
  coreResult: string
  retireWhen: string
  unavailable: string
  nowPossible: string
  needsAdjustment: string
  yearsLater: (years: number) => string
  year: (year: number) => string
  yearsDrawdown: (years: number) => string
  depleted: (year: number | null) => string
  metricsLabel: string
  fiAssets: string
  progress: string
  savingsRate: string
  stability: string
  passed: string
  caution: string
  monthly: string
  fiAssetNote: string
  monthlySaving: string
  language: string
  currency: string
  inputs: string
  quickInputs: string
  monthlyIncome: string
  monthlyContribution: string
  monthlyExpense: string
  nominalReturn: string
  inflation: string
  safeWithdrawalRate: string
  realReturn: string
  netWorth: string
  liabilities: string
  projection: string
  growthPath: string
  saveScenario: string
  targetPrefix: string
  chartAria: string
  chartNote: string
  assets: string
  assetInput: string
  addAsset: string
  assetName: string
  assetValue: string
  includeForFi: string
  newAsset: string
  high: string
  medium: string
  low: string
  sensitivity: string
  scenario: string
  description: string
  neededAssets: string
  retirementTiming: string
  hardToReach: string
  action: string
  advice: string
  saved: string
  savedScenarios: string
  emptySaved: string
  noValue: string
  disclaimer: string
  sensitivityLabels: Record<string, string>
  sensitivityDescriptions: Record<string, string>
  adviceExpense: (amount: string) => string
  adviceSaving: (years: number | null) => string
  adviceReturn: (rate: string) => string
}

const STORAGE_KEY = 'efs-scenarios'
const PREFERENCES_STORAGE_KEY = 'efs-preferences'
const START_YEAR = 2026

const defaultKoreaCostAssumptions: KoreaCostAssumptions = {
  includeHealthInsurance: false,
  healthInsuranceMonthlyEstimate: 250_000,
  includeInvestmentTax: false,
  taxableInvestmentMonthlyIncome: 0,
  investmentTaxRate: 0.154,
  includeRentalTax: false,
  rentalMonthlyIncome: 0,
  rentalTaxRate: 0.1,
}

const defaultState: PlannerState = {
  currentAge: 40,
  monthlyIncome: 8_000_000,
  monthlyContribution: 3_000_000,
  monthlyRetirementExpense: 2_770_000,
  livingExpenseBands: [
    { id: 'early', name: '초기', startAge: 40, endAge: 64, monthlyExpense: 3_300_000 },
    { id: 'middle', name: '중기', startAge: 65, endAge: 74, monthlyExpense: 2_770_000 },
    { id: 'late', name: '후기', startAge: 75, endAge: 100, monthlyExpense: 2_200_000 },
  ],
  nominalReturn: 0.065,
  inflationRate: 0.0240384615,
  safeWithdrawalRate: 0.035,
  retirementYears: 50,
  assets: [
    { id: 'cash', name: '현금/예금', type: 'cash', value: 100_000_000, liquidity: 'high', includeForFi: true },
    { id: 'stock', name: 'ETF/주식', type: 'stock', value: 400_000_000, liquidity: 'high', includeForFi: true },
    { id: 'irp', name: 'IRP/퇴직연금', type: 'pension', value: 80_000_000, liquidity: 'medium', includeForFi: true, availableAge: 55 },
    { id: 'home', name: '거주 부동산', type: 'real_estate', value: 700_000_000, liquidity: 'low', includeForFi: false },
  ],
  liabilities: [
    { id: 'mortgage', name: '주택담보대출', type: 'mortgage', balance: 250_000_000, interestRate: 0.04, monthlyPayment: 1_500_000, payoffAge: 60, includePaymentInRetirement: false },
  ],
  pensions: [
    { id: 'national-pension', name: '국민연금', kind: 'pension', startAge: 65, monthlyAmount: 1_200_000, reliability: 1 },
  ],
  children: [],
}

const copy: Record<Language, Copy> = {
  ko: {
    locale: 'ko-KR',
    eyebrow: 'Korean FIRE Planner',
    title: '경제적자유시뮬레이터',
    hero: '현재 자산, 월 저축, 은퇴 후 생활비와 기대수익률을 넣으면 은퇴 가능 시점과 목표 자산, 민감도까지 한 화면에서 계산합니다.',
    coreResult: '핵심 결과', retireWhen: '은퇴 가능 시점', unavailable: '도달 어려움', nowPossible: '지금 가능', needsAdjustment: '조건 조정 필요',
    yearsLater: (years) => `${years}년 뒤`, year: (year) => `${year}년`, yearsDrawdown: (years) => `${years}년 인출 시뮬레이션 통과`, depleted: (year) => `${year}년차 고갈 가능`,
    metricsLabel: '계산 결과 요약', fiAssets: '필요 은퇴자산', progress: '현재 달성률', savingsRate: '월 저축률', stability: '은퇴 후 안정성', passed: '통과', caution: '주의', monthly: '월', fiAssetNote: 'FI 계산용 자산', monthlySaving: '월 저축',
    language: '언어', currency: '화폐', inputs: 'Inputs', quickInputs: '빠른 계산 입력', monthlyIncome: '월 소득', monthlyContribution: '월 저축 가능액', monthlyExpense: '은퇴 후 월 생활비', nominalReturn: '명목 기대수익률 (%)', inflation: '인플레이션 (%)', safeWithdrawalRate: '안전인출률 (%)', realReturn: '실질수익률', netWorth: '순자산', liabilities: '총부채',
    projection: 'Projection', growthPath: '자산 성장 경로', saveScenario: '현재 시나리오 저장', targetPrefix: '목표', chartAria: '연도별 자산 성장 그래프', chartNote: '목표선은 은퇴 후 월 생활비를 안전인출률로 나눈 FI Number입니다. 거주용 부동산처럼 현금흐름화하기 어려운 자산은 기본적으로 제외합니다.',
    assets: 'Assets', assetInput: '자산 입력', addAsset: '자산 추가', assetName: '자산명', assetValue: '평가액', includeForFi: '은퇴 계산에 포함', newAsset: '새 자산', high: '유동', medium: '중간', low: '비유동',
    sensitivity: '민감도 분석', scenario: '시나리오', description: '설명', neededAssets: '필요 자산', retirementTiming: '은퇴 시점', hardToReach: '도달 어려움', action: 'Action', advice: '개선 제안', saved: 'Saved', savedScenarios: '저장된 시나리오', emptySaved: '아직 저장된 시나리오가 없습니다. 현재 시나리오 저장 버튼으로 최대 6개까지 비교할 수 있습니다.', noValue: '-', disclaimer: '이 결과는 입력 가정에 따른 시뮬레이션이며 투자, 세금, 건강보험료, 시장 급락, 개인 상황 변화에 따라 실제 결과는 달라질 수 있습니다. 투자 또는 은퇴 결정을 보장하지 않습니다.',
    sensitivityLabels: { '기본': '기본', '수익률 +1%p': '수익률 +1%p', '수익률 -1%p': '수익률 -1%p', '지출 -10%': '지출 -10%', '지출 +10%': '지출 +10%', '저축 +20%': '저축 +20%', '저축 -20%': '저축 -20%' },
    sensitivityDescriptions: { '기본': '현재 입력값 유지', '수익률 +1%p': '연 수익률 1%p 상승', '수익률 -1%p': '연 수익률 1%p 하락', '지출 -10%': '은퇴 후 월 생활비 10% 절감', '지출 +10%': '은퇴 후 월 생활비 10% 증가', '저축 +20%': '월 저축 가능액 20% 증가', '저축 -20%': '월 저축 가능액 20% 감소' },
    adviceExpense: (amount) => `지출을 10% 줄이면 은퇴 목표 자산이 ${amount} 낮아집니다.`, adviceSaving: (years) => `월 저축을 20% 늘린 시나리오는 ${years ?? '-'}년 뒤 은퇴 가능으로 계산됩니다.`, adviceReturn: (rate) => `명목수익률보다 중요한 값은 물가를 뺀 실질수익률입니다. 현재 실질수익률 가정은 ${rate}입니다.`,
  },
  en: {
    locale: 'en-US', eyebrow: 'FIRE Planner', title: 'Financial Freedom Simulator', hero: 'Enter current assets, monthly savings, retirement spending, and expected returns to estimate when work becomes optional.', coreResult: 'Core result', retireWhen: 'Retirement timing', unavailable: 'Hard to reach', nowPossible: 'Possible now', needsAdjustment: 'Adjust assumptions', yearsLater: (years) => `${years} years`, year: (year) => `${year}`, yearsDrawdown: (years) => `${years}-year drawdown simulation passed`, depleted: (year) => `May deplete in year ${year}`, metricsLabel: 'Calculation summary', fiAssets: 'Target FI Assets', progress: 'Current progress', savingsRate: 'Savings rate', stability: 'Retirement stability', passed: 'Passed', caution: 'Caution', monthly: 'Monthly', fiAssetNote: 'FI-counted assets', monthlySaving: 'Monthly saving', language: 'Language', currency: 'Currency', inputs: 'Inputs', quickInputs: 'Quick inputs', monthlyIncome: 'Monthly income', monthlyContribution: 'Monthly saving amount', monthlyExpense: 'Monthly retirement spending', nominalReturn: 'Nominal expected return (%)', inflation: 'Inflation (%)', safeWithdrawalRate: 'Safe withdrawal rate (%)', realReturn: 'Real return', netWorth: 'Net worth', liabilities: 'Liabilities', projection: 'Projection', growthPath: 'Asset growth path', saveScenario: 'Save current scenario', targetPrefix: 'Target', chartAria: 'Yearly asset growth chart', chartNote: 'The target line is the FI number: monthly retirement spending annualized and divided by the safe withdrawal rate. Illiquid home equity is excluded by default.', assets: 'Assets', assetInput: 'Asset input', addAsset: 'Add asset', assetName: 'Asset name', assetValue: 'Value', includeForFi: 'Include in FI calculation', newAsset: 'New asset', high: 'Liquid', medium: 'Medium', low: 'Illiquid', sensitivity: 'Sensitivity Analysis', scenario: 'Scenario', description: 'Description', neededAssets: 'Needed assets', retirementTiming: 'Retirement timing', hardToReach: 'Hard to reach', action: 'Action', advice: 'Improvement ideas', saved: 'Saved', savedScenarios: 'Saved scenarios', emptySaved: 'No saved scenarios yet. Save the current scenario to compare up to six cases.', noValue: '-', disclaimer: 'This is a simulation based on your assumptions. Actual outcomes can vary due to investment returns, taxes, healthcare costs, inflation, market crashes, and personal circumstances. It is not financial advice.', sensitivityLabels: { '기본': 'Base', '수익률 +1%p': 'Return +1%p', '수익률 -1%p': 'Return -1%p', '지출 -10%': 'Spending -10%', '지출 +10%': 'Spending +10%', '저축 +20%': 'Saving +20%', '저축 -20%': 'Saving -20%' }, sensitivityDescriptions: { '기본': 'Current assumptions', '수익률 +1%p': 'Annual return up by 1 percentage point', '수익률 -1%p': 'Annual return down by 1 percentage point', '지출 -10%': 'Retirement spending reduced by 10%', '지출 +10%': 'Retirement spending increased by 10%', '저축 +20%': 'Monthly saving increased by 20%', '저축 -20%': 'Monthly saving reduced by 20%' }, adviceExpense: (amount) => `Cutting spending by 10% lowers the FI target by ${amount}.`, adviceSaving: (years) => `Increasing monthly saving by 20% reaches FI in ${years ?? '-'} years.`, adviceReturn: (rate) => `Real return after inflation matters more than nominal return. Current real-return assumption is ${rate}.` },
  ja: {
    locale: 'ja-JP', eyebrow: 'FIRE Planner', title: '経済的自由シミュレーター', hero: '現在資産、毎月の貯蓄、退職後の生活費、期待リターンから退職可能時期を試算します。', coreResult: '主要結果', retireWhen: '退職可能時期', unavailable: '到達困難', nowPossible: '今すぐ可能', needsAdjustment: '条件調整が必要', yearsLater: (years) => `${years}年後`, year: (year) => `${year}年`, yearsDrawdown: (years) => `${years}年の取り崩し試算を通過`, depleted: (year) => `${year}年目に枯渇の可能性`, metricsLabel: '計算サマリー', fiAssets: '必要FI資産', progress: '現在の達成率', savingsRate: '貯蓄率', stability: '退職後の安定性', passed: '通過', caution: '注意', monthly: '月', fiAssetNote: 'FI計算対象資産', monthlySaving: '月間貯蓄', language: '言語', currency: '通貨', inputs: 'Inputs', quickInputs: '簡易入力', monthlyIncome: '月収', monthlyContribution: '月間貯蓄額', monthlyExpense: '退職後の月間生活費', nominalReturn: '名目期待リターン (%)', inflation: 'インフレ率 (%)', safeWithdrawalRate: '安全引出率 (%)', realReturn: '実質リターン', netWorth: '純資産', liabilities: '負債合計', projection: 'Projection', growthPath: '資産成長パス', saveScenario: '現在のシナリオを保存', targetPrefix: '目標', chartAria: '年間資産成長グラフ', chartNote: '目標線は退職後生活費を年額化し、安全引出率で割ったFI Numberです。流動化しにくい居住用不動産は既定で除外します。', assets: 'Assets', assetInput: '資産入力', addAsset: '資産を追加', assetName: '資産名', assetValue: '評価額', includeForFi: 'FI計算に含める', newAsset: '新しい資産', high: '流動', medium: '中', low: '非流動', sensitivity: '感度分析', scenario: 'シナリオ', description: '説明', neededAssets: '必要資産', retirementTiming: '退職時期', hardToReach: '到達困難', action: 'Action', advice: '改善提案', saved: 'Saved', savedScenarios: '保存済みシナリオ', emptySaved: '保存済みシナリオはまだありません。現在のシナリオを保存して最大6件比較できます。', noValue: '-', disclaimer: 'この結果は入力仮定に基づくシミュレーションであり、投資収益、税金、医療費、物価、市場急落、個人事情により変わります。投資・退職判断を保証するものではありません。', sensitivityLabels: { '기본': '基本', '수익률 +1%p': 'リターン +1%p', '수익률 -1%p': 'リターン -1%p', '지출 -10%': '支出 -10%', '지출 +10%': '支出 +10%', '저축 +20%': '貯蓄 +20%', '저축 -20%': '貯蓄 -20%' }, sensitivityDescriptions: { '기본': '現在の入力値を維持', '수익률 +1%p': '年間リターンが1%p上昇', '수익률 -1%p': '年間リターンが1%p低下', '지출 -10%': '退職後生活費を10%削減', '지출 +10%': '退職後生活費が10%増加', '저축 +20%': '月間貯蓄額を20%増加', '저축 -20%': '月間貯蓄額を20%減少' }, adviceExpense: (amount) => `支出を10%減らすとFI目標額は${amount}下がります。`, adviceSaving: (years) => `月間貯蓄を20%増やすと${years ?? '-'}年後にFI到達と試算されます。`, adviceReturn: (rate) => `名目リターンよりインフレ後の実質リターンが重要です。現在の実質リターン仮定は${rate}です。` },
}

function parseNumber(value: string): number { return Number(value.replace(/[^0-9.-]/g, '')) || 0 }
function formatInputNumber(value: number): string { return Number.isFinite(value) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(value)) : '' }

function MoneyInput({ label, value, onValueChange }: { label: string; value: number; onValueChange: (value: number) => void }) {
  const [draft, setDraft] = useState(formatInputNumber(value))
  useEffect(() => { setDraft(formatInputNumber(value)) }, [value])
  return (
    <label>{label}
      <input aria-label={label} inputMode="numeric" value={draft} onChange={(event) => { const next = parseNumber(event.target.value); setDraft(event.target.value === '' ? '' : formatInputNumber(next)); onValueChange(next) }} onBlur={() => setDraft(formatInputNumber(value))} />
    </label>
  )
}

function readSavedScenarios(): SavedScenario[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as SavedScenario[] } catch { return [] } }
function readPreferences(): { language: Language; currency: CurrencyCode } {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}') as Partial<{ language: Language; currency: CurrencyCode }>
    const language: Language = parsed.language === 'en' || parsed.language === 'ja' || parsed.language === 'ko' ? parsed.language : 'ko'
    const currency: CurrencyCode = parsed.currency === 'USD' || parsed.currency === 'JPY' || parsed.currency === 'EUR' || parsed.currency === 'KRW' ? parsed.currency : 'KRW'
    return { language, currency }
  } catch {
    return { language: 'ko', currency: 'KRW' }
  }
}

const ui = {
  ko: {
    currentAge: '현재 나이', currentUsableFiAssets: '현재 사용가능 FI 자산', reflectedPensionLockedAssets: (years: number) => `연금·잠긴자산 반영 ${years}년 통과`, depletedAtAge: (age: number | null) => `${age}세 고갈 가능`,
    decision: 'Decision', resultInterpretation: '결과 해석', copyMarkdownReport: 'Markdown 리포트 복사', scenariosEyebrow: 'Scenarios', scenarioComparison: '시나리오 비교', scenarioColumn: '시나리오', retirementTimingColumn: '은퇴 시점', monthlySpendingColumn: '월 지출', riskColumn: '리스크',
    lowRisk: '낮음', mediumRisk: '보통', highRisk: '주의', koreaReality: 'Korea Reality', koreaCostAdjustment: '한국형 비용 보정', includeHealthInsurance: '건강보험료 반영', healthInsuranceMonthlyEstimate: '건강보험료 월 추정치', includeInvestmentTax: '투자소득 세금 반영', taxableInvestmentMonthlyIncome: '투자소득 월 과세대상', monthlyExtraCost: '월 추가 비용', annualExtraCost: '연 추가 비용',
    reportTitle: '한국형 경제적 자유 시뮬레이터 리포트', realReturnAssumption: (rate: string) => `실질수익률 ${rate}`, swrAssumption: (rate: string) => `안전인출률 ${rate}`, taxHealthMonthlyAdjustment: (amount: string) => `세금/건강보험료 월 보정 ${amount}`, reportCopied: '리포트를 클립보드에 복사했습니다.',
    assetUnlockSummary: '55세 이후 사용가능 자산', lockedFiAssets: (amount: string) => `잠긴 FI 자산 ${amount}`, noLockedAssets: '잠긴 자산 없음', unlockFromAge: (age: number) => `${age}세부터 순차적으로 은퇴 인출 재원에 합산됩니다.`, availableAge: '사용 가능 나이', currentPlaceholder: '현재',
    debtBridge: 'Debt Bridge', debtPayoff: '대출 상환 반영', liabilityName: '대출명', liabilityBalance: '대출 잔액', monthlyDebtPayment: '월 상환액', payoffAge: '상환 종료 나이', ongoingPlaceholder: '계속', includePaymentInRetirement: '은퇴 후 지출에 반영', remainingMonthlyPaymentAtRetirement: '은퇴 시점 남은 월상환', reflectedAge: '상환 반영 나이', ageSuffix: (age: number) => `${age}세`,
    cashflows: 'Cashflows', retirementIncomeCashflows: '은퇴 후 소득/현금흐름', addIncome: '소득 추가', incomeName: '소득명', incomeKind: '소득 종류', pension: '연금', rentalIncome: '월세/임대소득', passiveIncome: '패시브 인컴', temporaryIncome: '기간한정 소득', other: '기타', incomeStartAge: '수령 시작 나이', endAge: '종료 나이', lifetimePlaceholder: '종신/무기한', monthlyIncomeAmount: (name: string) => `${name} 월 수령액`, reliability: '보수적 반영률 (%)', reliabilityAria: '보수적 반영률', totalMonthlyIncome: '총 월 소득', monthlyShortfall: '월 부족액', lockedAssetUnlock: '잠긴자산 해제', cashflowNote: '국민연금, 개인연금, 월세, 배당 같은 은퇴 후 월수입을 여러 개 추가할 수 있습니다. 종료 나이를 비워두면 종신/무기한으로 보고, 종료 나이를 넣으면 그 나이 이후에는 소득에서 제외합니다.',
    dependents: 'Dependents', childrenExpenses: '자녀/부양가족 비용', addChild: '자녀 추가', child: '자녀', lumpSum: '일시금', childName: '자녀명', childCurrentAge: '현재 자녀 나이', monthlyCareCost: '월 양육비', monthlyEducationCost: '월 교육비', supportUntilAge: '지원 종료 나이', universityStartAge: '대학 시작 나이', universityEndAge: '대학 종료 나이', annualUniversityCost: '대학 연간비', lumpSumAge: '일시금 나이', lumpSumAmount: '일시금 금액', currentAnnualChildExpense: '현재 연간 자녀비', totalAnnualUniversityCost: '대학 연간비 합계', childCount: '자녀 수', peopleSuffix: (count: number) => `${count}명`, childrenNote: '자녀 비용은 영구 생활비가 아니라 지원 종료 나이 전 월비용, 대학 기간 연간비, 특정 자녀 나이의 일시금 이벤트로 은퇴 후 안정성에 반영합니다.', sensitivityEyebrow: 'Sensitivity', deleteSavedScenario: '삭제', deleteItem: '삭제', addDebt: '대출 추가', newDebt: '새 대출', livingExpenses: 'Living Expenses', livingExpenseBands: '나이별 필요생활비', addLivingExpenseBand: '생활비 구간 추가', livingExpenseName: '구분명', livingExpenseStartAge: '시작나이', livingExpenseEndAge: '종료나이', livingExpenseAmount: '필요생활비', livingExpenseSourceNote: '기본값은 국민연금연구원 노후보장패널의 부부 적정 노후생활비 월 277만원 수준을 기준으로 초기/중기/후기 소비 변화를 반영한 보수적 가정입니다. 필요에 맞게 수정하세요.', newLivingExpenseBand: '새 구간',
  },
  en: {
    currentAge: 'Current age', currentUsableFiAssets: 'Currently usable FI assets', reflectedPensionLockedAssets: (years: number) => `Pensions and locked assets reflected; ${years}-year simulation passed`, depletedAtAge: (age: number | null) => `May deplete at age ${age}`, decision: 'Decision', resultInterpretation: 'Result interpretation', copyMarkdownReport: 'Copy Markdown report', scenariosEyebrow: 'Scenarios', scenarioComparison: 'Scenario comparison', scenarioColumn: 'Scenario', retirementTimingColumn: 'Retirement timing', monthlySpendingColumn: 'Monthly spending', riskColumn: 'Risk', lowRisk: 'Low', mediumRisk: 'Medium', highRisk: 'Caution', koreaReality: 'Korea reality', koreaCostAdjustment: 'Korea cost adjustment', includeHealthInsurance: 'Include health insurance', healthInsuranceMonthlyEstimate: 'Monthly health insurance estimate', includeInvestmentTax: 'Include investment income tax', taxableInvestmentMonthlyIncome: 'Monthly taxable investment income', monthlyExtraCost: 'Monthly extra cost', annualExtraCost: 'Annual extra cost', reportTitle: 'Financial Freedom Simulator Report', realReturnAssumption: (rate: string) => `Real return ${rate}`, swrAssumption: (rate: string) => `Safe withdrawal rate ${rate}`, taxHealthMonthlyAdjustment: (amount: string) => `Tax/health insurance monthly adjustment ${amount}`, reportCopied: 'Report copied to the clipboard.', assetUnlockSummary: 'Assets usable after age 55', lockedFiAssets: (amount: string) => `Locked FI assets ${amount}`, noLockedAssets: 'No locked assets', unlockFromAge: (age: number) => `Added to retirement drawdown resources from age ${age}.`, availableAge: 'Available age', currentPlaceholder: 'Now', debtBridge: 'Debt bridge', debtPayoff: 'Debt payoff bridge', liabilityName: 'Debt name', liabilityBalance: 'Debt balance', monthlyDebtPayment: 'Monthly payment', payoffAge: 'Payoff age', ongoingPlaceholder: 'Ongoing', includePaymentInRetirement: 'Include in retirement spending', remainingMonthlyPaymentAtRetirement: 'Remaining monthly payment at retirement', reflectedAge: 'Reflected age', ageSuffix: (age: number) => `Age ${age}`, cashflows: 'Cashflows', retirementIncomeCashflows: 'Retirement income/cashflows', addIncome: 'Add income', incomeName: 'Income name', incomeKind: 'Income type', pension: 'Pension', rentalIncome: 'Rental income', passiveIncome: 'Passive income', temporaryIncome: 'Temporary income', other: 'Other', incomeStartAge: 'Start age', endAge: 'End age', lifetimePlaceholder: 'Lifetime/indefinite', monthlyIncomeAmount: (name: string) => `${name} monthly amount`, reliability: 'Conservative inclusion rate (%)', reliabilityAria: 'Conservative inclusion rate', totalMonthlyIncome: 'Total monthly income', monthlyShortfall: 'Monthly shortfall', lockedAssetUnlock: 'Locked asset unlock', cashflowNote: 'Add multiple retirement income streams such as public pension, private pension, rent, or dividends. Leave end age blank for lifetime/indefinite income; set an end age to exclude it afterward.', dependents: 'Dependents', childrenExpenses: 'Children/dependent expenses', addChild: 'Add child', child: 'Child', lumpSum: 'Lump sum', childName: 'Child name', childCurrentAge: 'Current child age', monthlyCareCost: 'Monthly care cost', monthlyEducationCost: 'Monthly education cost', supportUntilAge: 'Support until age', universityStartAge: 'University start age', universityEndAge: 'University end age', annualUniversityCost: 'Annual university cost', lumpSumAge: 'Lump-sum age', lumpSumAmount: 'Lump-sum amount', currentAnnualChildExpense: 'Current annual child expense', totalAnnualUniversityCost: 'Total annual university cost', childCount: 'Children', peopleSuffix: (count: number) => `${count}`, childrenNote: 'Dependent costs are modeled as time-bounded flows: monthly support before the support end age, annual university costs during university years, and one-time events at a specific child age.', sensitivityEyebrow: 'Sensitivity', deleteSavedScenario: 'Delete', deleteItem: 'Delete', addDebt: 'Add debt', newDebt: 'New debt', livingExpenses: 'Living expenses', livingExpenseBands: 'Age-based living expenses', addLivingExpenseBand: 'Add expense band', livingExpenseName: 'Band name', livingExpenseStartAge: 'Start age', livingExpenseEndAge: 'End age', livingExpenseAmount: 'Required living expense', livingExpenseSourceNote: 'Defaults are conservative assumptions anchored to Korea National Pension Research Institute retirement living-cost statistics for couples (about KRW 2.77M/month), adjusted by early/middle/late retirement phases.', newLivingExpenseBand: 'New band',
  },
  ja: {
    currentAge: '現在の年齢', currentUsableFiAssets: '現在利用可能なFI資産', reflectedPensionLockedAssets: (years: number) => `年金・ロック資産を反映し${years}年シミュレーション通過`, depletedAtAge: (age: number | null) => `${age}歳で枯渇の可能性`, decision: '判断', resultInterpretation: '結果の解釈', copyMarkdownReport: 'Markdownレポートをコピー', scenariosEyebrow: 'シナリオ', scenarioComparison: 'シナリオ比較', scenarioColumn: 'シナリオ', retirementTimingColumn: '退職時期', monthlySpendingColumn: '月間支出', riskColumn: 'リスク', lowRisk: '低い', mediumRisk: '普通', highRisk: '注意', koreaReality: '韓国向け現実補正', koreaCostAdjustment: '韓国型コスト補正', includeHealthInsurance: '健康保険料を反映', healthInsuranceMonthlyEstimate: '健康保険料の月額推定', includeInvestmentTax: '投資所得税を反映', taxableInvestmentMonthlyIncome: '月間課税対象投資所得', monthlyExtraCost: '月間追加費用', annualExtraCost: '年間追加費用', reportTitle: '経済的自由シミュレーター レポート', realReturnAssumption: (rate: string) => `実質リターン ${rate}`, swrAssumption: (rate: string) => `安全引出率 ${rate}`, taxHealthMonthlyAdjustment: (amount: string) => `税金/健康保険料の月額補正 ${amount}`, reportCopied: 'レポートをクリップボードにコピーしました。', assetUnlockSummary: '55歳以降に利用可能な資産', lockedFiAssets: (amount: string) => `ロックFI資産 ${amount}`, noLockedAssets: 'ロック資産なし', unlockFromAge: (age: number) => `${age}歳から順次退職時の取り崩し原資に反映されます。`, availableAge: '利用可能年齢', currentPlaceholder: '現在', debtBridge: '債務ブリッジ', debtPayoff: 'ローン返済の反映', liabilityName: 'ローン名', liabilityBalance: 'ローン残高', monthlyDebtPayment: '月間返済額', payoffAge: '返済終了年齢', ongoingPlaceholder: '継続', includePaymentInRetirement: '退職後支出に反映', remainingMonthlyPaymentAtRetirement: '退職時点の残月額返済', reflectedAge: '反映年齢', ageSuffix: (age: number) => `${age}歳`, cashflows: 'キャッシュフロー', retirementIncomeCashflows: '退職後収入/キャッシュフロー', addIncome: '収入を追加', incomeName: '収入名', incomeKind: '収入種類', pension: '年金', rentalIncome: '家賃/賃貸収入', passiveIncome: 'パッシブ収入', temporaryIncome: '期間限定収入', other: 'その他', incomeStartAge: '受給開始年齢', endAge: '終了年齢', lifetimePlaceholder: '終身/無期限', monthlyIncomeAmount: (name: string) => `${name} 月額受取`, reliability: '保守的反映率 (%)', reliabilityAria: '保守的反映率', totalMonthlyIncome: '総月間収入', monthlyShortfall: '月間不足額', lockedAssetUnlock: 'ロック資産解除', cashflowNote: '公的年金、私的年金、賃貸、配当など複数の退職後月収を追加できます。終了年齢を空欄にすると終身/無期限、入力するとその年齢以降は収入から除外します。', dependents: '扶養家族', childrenExpenses: '子ども/扶養家族費用', addChild: '子どもを追加', child: '子ども', lumpSum: '一時金', childName: '子どもの名前', childCurrentAge: '現在の子どもの年齢', monthlyCareCost: '月間養育費', monthlyEducationCost: '月間教育費', supportUntilAge: '支援終了年齢', universityStartAge: '大学開始年齢', universityEndAge: '大学終了年齢', annualUniversityCost: '大学年間費用', lumpSumAge: '一時金年齢', lumpSumAmount: '一時金額', currentAnnualChildExpense: '現在の年間子ども費用', totalAnnualUniversityCost: '大学年間費用合計', childCount: '子ども数', peopleSuffix: (count: number) => `${count}人`, childrenNote: '子ども費用は恒久的生活費ではなく、支援終了年齢までの月額費用、大学期間の年間費用、特定年齢の一時金イベントとして退職後安定性に反映します。', sensitivityEyebrow: '感度', deleteSavedScenario: '削除', deleteItem: '削除', addDebt: 'ローンを追加', newDebt: '新規ローン', livingExpenses: '生活費', livingExpenseBands: '年齢別必要生活費', addLivingExpenseBand: '生活費区間を追加', livingExpenseName: '区分名', livingExpenseStartAge: '開始年齢', livingExpenseEndAge: '終了年齢', livingExpenseAmount: '必要生活費', livingExpenseSourceNote: '既定値は国民年金研究院の夫婦向け適正老後生活費統計（月約277万ウォン）を基準に、初期/中期/後期の消費変化を反映した保守的仮定です。', newLivingExpenseBand: '新しい区間',
  },
}

function App() {
  const [state, setState] = useState<PlannerState>(defaultState)
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(readSavedScenarios)
  const [language, setLanguage] = useState<Language>(() => readPreferences().language)
  const [currency, setCurrency] = useState<CurrencyCode>(() => readPreferences().currency)
  const [koreaCosts, setKoreaCosts] = useState<KoreaCostAssumptions>(defaultKoreaCostAssumptions)
  const [reportStatus, setReportStatus] = useState('')
  const t = copy[language]
  const u = ui[language]

  useEffect(() => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ language, currency }))
  }, [language, currency])

  const percentFormatter = useMemo(() => new Intl.NumberFormat(t.locale, { maximumFractionDigits: 1 }), [t.locale])
  const moneyFormatter = useMemo(() => new Intl.NumberFormat(t.locale, { style: 'currency', currency, maximumFractionDigits: 0 }), [currency, t.locale])
  const formatMoney = (value: number) => Number.isFinite(value) ? moneyFormatter.format(Math.round(value)) : t.noValue
  const formatPercent = (value: number) => `${percentFormatter.format(value * 100)}%`

  const realReturn = useMemo(() => toRealReturn(state.nominalReturn, state.inflationRate), [state.nominalReturn, state.inflationRate])
  const netWorth = useMemo(() => calculateNetWorth({ assets: state.assets, liabilities: state.liabilities }), [state.assets, state.liabilities])
  const access = useMemo(() => calculateUnlockedFiAssets({ assets: state.assets, currentAge: state.currentAge }), [state.assets, state.currentAge])
  const koreaCostResult = useMemo(() => calculateKoreaCostAdjustment(koreaCosts, language, formatMoney), [formatMoney, koreaCosts, language])
  const adjustedLivingExpenseBands = useMemo(() => state.livingExpenseBands.map((band) => ({ ...band, monthlyExpense: band.monthlyExpense + koreaCostResult.monthlyExtraCost })), [koreaCostResult.monthlyExtraCost, state.livingExpenseBands])
  const baseMonthlyRetirementExpense = calculateMonthlyLivingExpenseAtAge({ age: state.currentAge, monthlyRetirementExpense: state.monthlyRetirementExpense, livingExpenseBands: state.livingExpenseBands })
  const adjustedMonthlyRetirementExpense = baseMonthlyRetirementExpense + koreaCostResult.monthlyExtraCost
  const fiNumber = useMemo(() => calculateFiNumber(adjustedMonthlyRetirementExpense, state.safeWithdrawalRate), [adjustedMonthlyRetirementExpense, state.safeWithdrawalRate])
  const yearsToFi = useMemo(() => calculateYearsToRetirementReadiness({ currentAge: state.currentAge, monthlyContribution: state.monthlyContribution, monthlyRetirementExpense: adjustedMonthlyRetirementExpense, livingExpenseBands: adjustedLivingExpenseBands, annualReturn: realReturn, retirementYears: state.retirementYears, assets: state.assets, pensions: state.pensions, children: state.children, liabilities: state.liabilities }), [adjustedLivingExpenseBands, adjustedMonthlyRetirementExpense, realReturn, state.assets, state.children, state.currentAge, state.liabilities, state.monthlyContribution, state.pensions, state.retirementYears])
  const retirementYear = yearsToFi === null ? null : START_YEAR + yearsToFi
  const retirementAge = state.currentAge + (yearsToFi ?? 0)
  const remainingDebtPaymentAtRetirement = calculateMonthlyDebtPaymentAtAge(state.liabilities, retirementAge)
  const progress = fiNumber > 0 ? access.unlockedFiAssets / fiNumber : 1

  const projection = useMemo(() => createYearlyProjection({ currentFiAssets: access.unlockedFiAssets, annualContribution: state.monthlyContribution * 12, annualReturn: realReturn, fiNumber, startYear: START_YEAR }), [fiNumber, access.unlockedFiAssets, realReturn, state.monthlyContribution])
  const projectedRetirementAssets = useMemo(() => projectAssetsToRetirementAge({ assets: state.assets, currentAge: state.currentAge, retirementAge, annualContribution: state.monthlyContribution * 12, annualReturn: realReturn }), [realReturn, retirementAge, state.assets, state.currentAge, state.monthlyContribution])
  const readiness = useMemo(() => calculateRetirementReadiness({ currentAge: state.currentAge, retirementAge, retirementYears: state.retirementYears, monthlyRetirementExpense: adjustedMonthlyRetirementExpense, livingExpenseBands: adjustedLivingExpenseBands, annualReturn: realReturn, assets: projectedRetirementAssets, pensions: state.pensions, children: state.children, liabilities: state.liabilities }), [adjustedMonthlyRetirementExpense, projectedRetirementAssets, realReturn, retirementAge, state.children, state.currentAge, state.liabilities, state.pensions, state.retirementYears])
  const sensitivity = useMemo(() => getSensitivityMatrix({ currentFiAssets: access.unlockedFiAssets, monthlyContribution: state.monthlyContribution, monthlyRetirementExpense: adjustedMonthlyRetirementExpense, livingExpenseBands: adjustedLivingExpenseBands, annualReturn: realReturn, safeWithdrawalRate: state.safeWithdrawalRate, startYear: START_YEAR, retirementYears: state.retirementYears, currentAge: state.currentAge, assets: state.assets, pensions: state.pensions, children: state.children, liabilities: state.liabilities }), [access.unlockedFiAssets, adjustedLivingExpenseBands, adjustedMonthlyRetirementExpense, realReturn, state.assets, state.children, state.currentAge, state.liabilities, state.monthlyContribution, state.pensions, state.retirementYears, state.safeWithdrawalRate])

  const totalMonthlyRetirementIncome = state.pensions.reduce((sum, income) => sum + Math.max(0, income.monthlyAmount) * Math.max(0, Math.min(1, income.reliability)), 0)
  const monthlyShortfallAfterIncome = Math.max(0, adjustedMonthlyRetirementExpense + remainingDebtPaymentAtRetirement - totalMonthlyRetirementIncome)
  const currentAnnualChildExpense = state.children.reduce((sum, child) => sum + (Math.max(0, child.monthlyCareCost) + Math.max(0, child.monthlyEducationCost)) * 12, 0)
  const annualUniversityCost = state.children.reduce((sum, child) => sum + Math.max(0, child.annualUniversityCost ?? 0), 0)
  const savingsRate = calculateSavingsRate(state.monthlyIncome, state.monthlyContribution)
  const statusTone = progress >= 1 ? 'good' : yearsToFi !== null && yearsToFi <= 10 ? 'warn' : 'default'
  const expenseReductionImpact = calculateFiNumber(adjustedMonthlyRetirementExpense, state.safeWithdrawalRate) - calculateFiNumber(adjustedMonthlyRetirementExpense * 0.9, state.safeWithdrawalRate)
  const insights = useMemo(() => [
    ...buildPlannerInsights({ progress, yearsToFi, unlockedFiAssets: access.unlockedFiAssets, fiNumber, lockedFiAssets: access.lockedFiAssets, nextUnlockAge: access.nextUnlockAge, monthlyRetirementExpense: adjustedMonthlyRetirementExpense, totalMonthlyRetirementIncome, expenseReductionImpact, language, formatMoney }),
    ...buildCashflowSegmentInsights({ monthlyRetirementExpense: adjustedMonthlyRetirementExpense, points: readiness.points, language, formatMoney, maxSegments: 8 }),
  ], [access.lockedFiAssets, access.nextUnlockAge, access.unlockedFiAssets, adjustedMonthlyRetirementExpense, expenseReductionImpact, fiNumber, formatMoney, language, progress, readiness.points, totalMonthlyRetirementIncome, yearsToFi])
  const decisionScenarios = useMemo(() => createDecisionScenarios({ currentAge: state.currentAge, monthlyContribution: state.monthlyContribution, monthlyRetirementExpense: adjustedMonthlyRetirementExpense, livingExpenseBands: adjustedLivingExpenseBands, annualReturn: realReturn, safeWithdrawalRate: state.safeWithdrawalRate, startYear: START_YEAR, retirementYears: state.retirementYears, assets: state.assets, pensions: state.pensions, children: state.children, liabilities: state.liabilities }), [adjustedLivingExpenseBands, adjustedMonthlyRetirementExpense, realReturn, state.assets, state.children, state.currentAge, state.liabilities, state.monthlyContribution, state.pensions, state.retirementYears, state.safeWithdrawalRate])

  const updateNumber = (field: keyof PlannerState, value: number) => setState((current) => ({ ...current, [field]: value }))
  const updatePercent = (field: keyof PlannerState, value: string) => setState((current) => ({ ...current, [field]: parseNumber(value) / 100 }))
  const updateAsset = (id: string, patch: Partial<Asset>) => setState((current) => ({ ...current, assets: current.assets.map((asset) => asset.id === id ? { ...asset, ...patch } : asset) }))
  const updateLiability = (id: string, patch: Partial<Liability>) => setState((current) => ({ ...current, liabilities: current.liabilities.map((liability) => liability.id === id ? { ...liability, ...patch } : liability) }))
  const updatePension = (id: string, patch: Partial<PensionCashflow>) => setState((current) => ({ ...current, pensions: current.pensions.map((pension) => pension.id === id ? { ...pension, ...patch } : pension) }))
  const updateChild = (id: string, patch: Partial<ChildExpense>) => setState((current) => ({ ...current, children: current.children.map((child) => child.id === id ? { ...child, ...patch } : child) }))
  const updateLivingExpenseBand = (id: string, patch: Partial<LivingExpenseBand>) => setState((current) => ({ ...current, livingExpenseBands: current.livingExpenseBands.map((band) => band.id === id ? { ...band, ...patch } : band) }))
  const updateKoreaCosts = (patch: Partial<KoreaCostAssumptions>) => setKoreaCosts((current) => ({ ...current, ...patch }))
  const deleteAsset = (id: string) => setState((current) => ({ ...current, assets: current.assets.filter((asset) => asset.id !== id) }))
  const deletePension = (id: string) => setState((current) => ({ ...current, pensions: current.pensions.filter((pension) => pension.id !== id) }))
  const deleteLivingExpenseBand = (id: string) => setState((current) => ({ ...current, livingExpenseBands: current.livingExpenseBands.filter((band) => band.id !== id) }))


  const addChild = () => setState((current) => ({
    ...current,
    children: [...current.children, { id: `child-${Date.now()}`, name: u.child, currentAge: 0, monthlyCareCost: 0, monthlyEducationCost: 0, supportUntilAge: 24, universityStartAge: 19, universityEndAge: 22, annualUniversityCost: 0, lumpSumEvents: [{ id: `event-${Date.now()}`, label: u.lumpSum, childAge: 30, amount: 0 }] }],
  }))
  const addIncome = () => setState((current) => ({
    ...current,
    pensions: [...current.pensions, { id: `income-${Date.now()}`, name: u.rentalIncome, kind: 'rental', startAge: current.currentAge, monthlyAmount: 0, reliability: 1 }],
  }))
  const addLivingExpenseBand = () => setState((current) => ({ ...current, livingExpenseBands: [...current.livingExpenseBands, { id: `expense-${Date.now()}`, name: u.newLivingExpenseBand, startAge: current.currentAge, endAge: current.currentAge + 9, monthlyExpense: current.monthlyRetirementExpense }] }))
  const addAsset = () => setState((current) => ({ ...current, assets: [...current.assets, { id: `asset-${Date.now()}`, name: t.newAsset, type: 'fund', value: 0, liquidity: 'high', includeForFi: true }] }))
  const addLiability = () => setState((current) => ({ ...current, liabilities: [...current.liabilities, { id: `liability-${Date.now()}`, name: u.newDebt, type: 'loan', balance: 0, interestRate: 0.04, monthlyPayment: 0, includePaymentInRetirement: true }] }))
  const saveScenario = () => { const next = { id: `scenario-${Date.now()}`, savedAt: new Date().toLocaleString(t.locale), yearsToFi, retirementYear, fiNumber, progress, state }; const scenarios = [next, ...savedScenarios].slice(0, 6); localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios)); setSavedScenarios(scenarios) }
  const deleteSavedScenario = (id: string) => { const scenarios = savedScenarios.filter((scenario) => scenario.id !== id); localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios)); setSavedScenarios(scenarios) }
  const scenarioTiming = (scenario: { yearsToFi: number | null; retirementYear: number | null }) => scenario.yearsToFi === null ? t.needsAdjustment : `${t.yearsLater(scenario.yearsToFi)} · ${scenario.retirementYear}`
  const scenarioRisk = (risk: 'low' | 'medium' | 'high') => risk === 'low' ? u.lowRisk : risk === 'medium' ? u.mediumRisk : u.highRisk
  const scenarioDisplayName = (label: string) => {
    const labels = {
      ko: { '기본': '기본', '보수': '보수', '낙관': '낙관', '조기퇴사': '조기퇴사' },
      en: { '기본': 'Base', '보수': 'Conservative', '낙관': 'Optimistic', '조기퇴사': 'Quit early' },
      ja: { '기본': '基本', '보수': '保守', '낙관': '楽観', '조기퇴사': '早期退職' },
    } as const
    return (labels[language] as Record<string, string>)[label] ?? label
  }
  const localizedName = (id: string, fallback: string) => {
    const names = {
      ko: { cash: '현금/예금', stock: 'ETF/주식', irp: 'IRP/퇴직연금', home: '거주 부동산', mortgage: '주택담보대출', 'national-pension': '국민연금', early: '초기', middle: '중기', late: '후기' },
      en: { cash: 'Cash/deposits', stock: 'ETFs/stocks', irp: 'IRP/retirement pension', home: 'Primary residence', mortgage: 'Mortgage', 'national-pension': 'National pension', early: 'Early', middle: 'Middle', late: 'Late' },
      ja: { cash: '現金/預金', stock: 'ETF/株式', irp: 'IRP/退職年金', home: '居住用不動産', mortgage: '住宅ローン', 'national-pension': '国民年金', early: '初期', middle: '中期', late: '後期' },
    } as const
    return (names[language] as Record<string, string>)[id] ?? fallback
  }
  const copyReport = async () => {
    const markdown = generateMarkdownReport({
      title: u.reportTitle,
      generatedAt: new Date().toLocaleString(t.locale),
      summary: { yearsToFi, retirementYear, fiNumber: formatMoney(fiNumber), progress: formatPercent(progress), monthlyShortfall: formatMoney(monthlyShortfallAfterIncome) },
      assumptions: [u.realReturnAssumption(formatPercent(realReturn)), u.swrAssumption(formatPercent(state.safeWithdrawalRate)), u.taxHealthMonthlyAdjustment(formatMoney(koreaCostResult.monthlyExtraCost))],
      insights: insights.map((insight) => insight.message),
      scenarios: decisionScenarios.map((scenario) => ({ label: scenarioDisplayName(scenario.label), timing: scenarioTiming(scenario), risk: scenarioRisk(scenario.risk) })),
      disclaimer: t.disclaimer,
      labels: {
        adjustAssumptions: t.needsAdjustment,
        possibleNow: t.nowPossible,
        yearsLater: (years, year) => `${t.yearsLater(years)} · ${year}`,
        generatedAt: language === 'en' ? 'Generated at' : language === 'ja' ? '作成日' : '생성일',
        coreResults: t.coreResult,
        item: language === 'en' ? 'Item' : language === 'ja' ? '項目' : '항목',
        value: language === 'en' ? 'Value' : language === 'ja' ? '値' : '값',
        retirementTiming: t.retireWhen,
        fiAssets: t.fiAssets,
        progress: t.progress,
        monthlyShortfall: u.monthlyShortfall,
        insights: u.resultInterpretation,
        assumptions: language === 'en' ? 'Key assumptions' : language === 'ja' ? '主な仮定' : '주요 가정',
        scenarioComparison: u.scenarioComparison,
        scenario: u.scenarioColumn,
        risk: u.riskColumn,
        disclaimer: language === 'en' ? 'Disclaimer' : language === 'ja' ? '注意事項' : '유의사항',
      },
    })
    await navigator.clipboard?.writeText(markdown)
    setReportStatus(u.reportCopied)
  }

  return (
    <main className="app-shell">
      <header className="hero-panel">
        <div>
          <div className="toolbar">
            <label>{t.language}<select aria-label={t.language} value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option></select></label>
            <label>{t.currency}<select aria-label={t.currency} value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)}><option value="KRW">KRW ₩</option><option value="USD">USD $</option><option value="JPY">JPY ¥</option><option value="EUR">EUR €</option></select></label>
          </div>
          <p className="eyebrow">{t.eyebrow}</p><h1>{t.title}</h1><p className="hero-copy">{t.hero}</p>
        </div>
        <div className="hero-result" aria-label={t.coreResult}><span>{t.retireWhen}</span><strong>{yearsToFi === null ? t.unavailable : yearsToFi === 0 ? t.nowPossible : t.yearsLater(yearsToFi)}</strong><em>{retirementYear === null ? t.needsAdjustment : t.year(retirementYear)}</em></div>
      </header>

      <section className="metrics-grid" aria-label={t.metricsLabel}>
        <MetricCard label={t.fiAssets} value={formatMoney(fiNumber)} note={`${t.monthly} ${formatMoney(adjustedMonthlyRetirementExpense)} · SWR ${formatPercent(state.safeWithdrawalRate)}`} tone={statusTone} />
        <MetricCard label={t.progress} value={formatPercent(progress)} note={`${u.currentUsableFiAssets} ${formatMoney(access.unlockedFiAssets)}`} />
        <MetricCard label={t.savingsRate} value={formatPercent(savingsRate)} note={`${t.monthlySaving} ${formatMoney(state.monthlyContribution)}`} />
        <MetricCard label={t.stability} value={readiness.success ? t.passed : t.caution} note={readiness.success ? u.reflectedPensionLockedAssets(state.retirementYears) : u.depletedAtAge(readiness.depletedAge)} tone={readiness.success ? 'good' : 'warn'} />
      </section>

      <section className="decision-grid">
        <div className="panel insight-panel">
          <div className="section-title row-title"><div><p className="eyebrow">{u.decision}</p><h2>{u.resultInterpretation}</h2></div><button type="button" onClick={copyReport}>{u.copyMarkdownReport}</button></div>
          <ul className="insight-list">{insights.map((insight) => <li className={insight.tone} key={insight.message}>{insight.message}</li>)}</ul>
          {reportStatus && <p className="copy-status">{reportStatus}</p>}
        </div>
        <div className="panel scenario-panel">
          <div className="section-title"><p className="eyebrow">{u.scenariosEyebrow}</p><h2>{u.scenarioComparison}</h2></div>
          <div className="table-wrap"><table><thead><tr><th>{u.scenarioColumn}</th><th>{u.retirementTimingColumn}</th><th>{u.monthlySpendingColumn}</th><th>{u.riskColumn}</th></tr></thead><tbody>{decisionScenarios.map((scenario) => <tr key={scenario.label}><td>{scenarioDisplayName(scenario.label)}</td><td>{scenarioTiming(scenario)}</td><td>{formatMoney(scenario.monthlyRetirementExpense)}</td><td><span className={`risk ${scenario.risk}`}>{scenarioRisk(scenario.risk)}</span></td></tr>)}</tbody></table></div>
        </div>
        <div className="panel korea-cost-panel">
          <div className="section-title"><p className="eyebrow">{u.koreaReality}</p><h2>{u.koreaCostAdjustment}</h2></div>
          <div className="form-grid compact"><label className="check-label"><input aria-label={u.includeHealthInsurance} type="checkbox" checked={koreaCosts.includeHealthInsurance} onChange={(event) => updateKoreaCosts({ includeHealthInsurance: event.target.checked })} />{u.includeHealthInsurance}</label><MoneyInput label={u.healthInsuranceMonthlyEstimate} value={koreaCosts.healthInsuranceMonthlyEstimate} onValueChange={(value) => updateKoreaCosts({ healthInsuranceMonthlyEstimate: value })} /><label className="check-label"><input aria-label={u.includeInvestmentTax} type="checkbox" checked={koreaCosts.includeInvestmentTax} onChange={(event) => updateKoreaCosts({ includeInvestmentTax: event.target.checked })} />{u.includeInvestmentTax}</label><MoneyInput label={u.taxableInvestmentMonthlyIncome} value={koreaCosts.taxableInvestmentMonthlyIncome ?? 0} onValueChange={(value) => updateKoreaCosts({ taxableInvestmentMonthlyIncome: value })} /></div>
          <div className="assumption-strip"><span>{u.monthlyExtraCost}<strong>{formatMoney(koreaCostResult.monthlyExtraCost)}</strong></span><span>{u.annualExtraCost}<strong>{formatMoney(koreaCostResult.annualExtraCost)}</strong></span></div>
          <ul className="mini-notes">{koreaCostResult.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </div>
      </section>

      <div className="workspace"><section className="panel input-panel"><div className="section-title"><p className="eyebrow">{t.inputs}</p><h2>{t.quickInputs}</h2></div><div className="form-grid"><label>{u.currentAge}<input aria-label={u.currentAge} type="number" value={state.currentAge} onChange={(event) => updateNumber('currentAge', parseNumber(event.target.value))} /></label><MoneyInput label={t.monthlyIncome} value={state.monthlyIncome} onValueChange={(value) => updateNumber('monthlyIncome', value)} /><MoneyInput label={t.monthlyContribution} value={state.monthlyContribution} onValueChange={(value) => updateNumber('monthlyContribution', value)} /><MoneyInput label={t.monthlyExpense} value={state.monthlyRetirementExpense} onValueChange={(value) => updateNumber('monthlyRetirementExpense', value)} /><label>{t.nominalReturn}<input aria-label={t.nominalReturn.replace(' (%)', '')} type="number" step="0.1" value={(state.nominalReturn * 100).toFixed(1)} onChange={(event) => updatePercent('nominalReturn', event.target.value)} /></label><label>{t.inflation}<input aria-label={t.inflation.replace(' (%)', '')} type="number" step="0.1" value={(state.inflationRate * 100).toFixed(1)} onChange={(event) => updatePercent('inflationRate', event.target.value)} /></label><label>{t.safeWithdrawalRate}<input aria-label={t.safeWithdrawalRate.replace(' (%)', '')} type="number" step="0.1" value={(state.safeWithdrawalRate * 100).toFixed(1)} onChange={(event) => updatePercent('safeWithdrawalRate', event.target.value)} /></label></div><div className="assumption-strip"><span>{t.realReturn}<strong>{formatPercent(realReturn)}</strong></span><span>{t.netWorth}<strong>{formatMoney(netWorth.netWorth)}</strong></span><span>{t.liabilities}<strong>{formatMoney(netWorth.totalLiabilities)}</strong></span></div></section>
        <section className="panel chart-panel"><div className="section-title row-title"><div><p className="eyebrow">{t.projection}</p><h2>{t.growthPath}</h2></div><button type="button" onClick={saveScenario}>{t.saveScenario}</button></div><MiniLineChart data={projection} target={fiNumber} targetLabel={`${t.targetPrefix} ${formatMoney(fiNumber)}`} ariaLabel={t.chartAria} /><p className="chart-note">{t.chartNote}</p></section></div>

      <section className="panel living-expense-panel"><div className="section-title row-title"><div><p className="eyebrow">{u.livingExpenses}</p><h2>{u.livingExpenseBands}</h2></div><button type="button" onClick={addLivingExpenseBand}>{u.addLivingExpenseBand}</button></div><div className="asset-list" data-testid="living-expense-list">{state.livingExpenseBands.map((band) => <article className="asset-row expense-row" key={band.id}><strong>{localizedName(band.id, band.name)}</strong><label>{u.livingExpenseName}<input aria-label={u.livingExpenseName} value={localizedName(band.id, band.name)} onChange={(event) => updateLivingExpenseBand(band.id, { name: event.target.value })} /></label><label>{u.livingExpenseStartAge}<input aria-label={u.livingExpenseStartAge} type="number" value={band.startAge} onChange={(event) => updateLivingExpenseBand(band.id, { startAge: parseNumber(event.target.value) })} /></label><label>{u.livingExpenseEndAge}<input aria-label={u.livingExpenseEndAge} type="number" value={band.endAge} onChange={(event) => updateLivingExpenseBand(band.id, { endAge: parseNumber(event.target.value) })} /></label><MoneyInput label={u.livingExpenseAmount} value={band.monthlyExpense} onValueChange={(value) => updateLivingExpenseBand(band.id, { monthlyExpense: value })} /><button className="row-delete icon-button" type="button" aria-label={u.deleteItem} title={u.deleteItem} onClick={() => deleteLivingExpenseBand(band.id)}><span aria-hidden="true">×</span></button></article>)}</div><p className="chart-note">{u.livingExpenseSourceNote}</p></section>

      <section className="panel assets-panel"><div className="section-title row-title"><div><p className="eyebrow">{t.assets}</p><h2>{t.assetInput}</h2></div><button type="button" onClick={addAsset}>{t.addAsset}</button></div><div className="asset-summary"><strong>{u.assetUnlockSummary}</strong><span>{u.lockedFiAssets(formatMoney(access.lockedFiAssets))}</span><small>{access.nextUnlockAge === null ? u.noLockedAssets : u.unlockFromAge(access.nextUnlockAge)}</small></div><div className="asset-list" data-testid="asset-list">{state.assets.map((asset) => <article className="asset-row" key={asset.id}><label>{t.assetName}<input aria-label={t.assetName} value={localizedName(asset.id, asset.name)} onChange={(event) => updateAsset(asset.id, { name: event.target.value })} /></label><MoneyInput label={t.assetValue} value={asset.value} onValueChange={(value) => updateAsset(asset.id, { value })} /><label>{u.availableAge}<input aria-label={u.availableAge} type="number" value={asset.availableAge ?? ''} placeholder={u.currentPlaceholder} onChange={(event) => updateAsset(asset.id, { availableAge: event.target.value === '' ? undefined : parseNumber(event.target.value) })} /></label><label className="check-label"><input type="checkbox" checked={asset.includeForFi} onChange={(event) => updateAsset(asset.id, { includeForFi: event.target.checked })} />{t.includeForFi}</label><span className={`liquidity ${asset.liquidity}`}>{asset.liquidity === 'high' ? t.high : asset.liquidity === 'medium' ? t.medium : t.low}</span><button className="row-delete icon-button" type="button" aria-label={u.deleteItem} title={u.deleteItem} onClick={() => deleteAsset(asset.id)}><span aria-hidden="true">×</span></button></article>)}</div></section>

      <section className="panel liabilities-panel"><div className="section-title row-title"><div><p className="eyebrow">{u.debtBridge}</p><h2>{u.debtPayoff}</h2></div><button type="button" onClick={addLiability}>{u.addDebt}</button></div><div className="asset-list" data-testid="liability-list">{state.liabilities.map((liability) => <article className="asset-row" key={liability.id}><strong>{localizedName(liability.id, liability.name)}</strong><label>{u.liabilityName}<input aria-label={u.liabilityName} value={localizedName(liability.id, liability.name)} onChange={(event) => updateLiability(liability.id, { name: event.target.value })} /></label><MoneyInput label={u.liabilityBalance} value={liability.balance} onValueChange={(value) => updateLiability(liability.id, { balance: value })} /><MoneyInput label={u.monthlyDebtPayment} value={liability.monthlyPayment ?? 0} onValueChange={(value) => updateLiability(liability.id, { monthlyPayment: value })} /><label>{u.payoffAge}<input aria-label={u.payoffAge} type="number" value={liability.payoffAge ?? ''} placeholder={u.ongoingPlaceholder} onChange={(event) => updateLiability(liability.id, { payoffAge: event.target.value === '' ? undefined : parseNumber(event.target.value) })} /></label><label className="check-label"><input type="checkbox" checked={Boolean(liability.includePaymentInRetirement)} onChange={(event) => updateLiability(liability.id, { includePaymentInRetirement: event.target.checked })} />{u.includePaymentInRetirement}</label></article>)}</div><div className="assumption-strip"><span>{u.remainingMonthlyPaymentAtRetirement}<strong>{formatMoney(remainingDebtPaymentAtRetirement)}</strong></span><span>{u.reflectedAge}<strong>{u.ageSuffix(retirementAge)}</strong></span></div></section>

      <section className="panel pension-panel"><div className="section-title row-title"><div><p className="eyebrow">{u.cashflows}</p><h2>{u.retirementIncomeCashflows}</h2></div><button type="button" onClick={addIncome}>{u.addIncome}</button></div><div className="asset-list" data-testid="cashflow-list">{state.pensions.map((income) => <article className="asset-row pension-row" key={income.id}><strong>{localizedName(income.id, income.name)}</strong><label>{u.incomeName}<input aria-label={u.incomeName} value={localizedName(income.id, income.name)} onChange={(event) => updatePension(income.id, { name: event.target.value })} /></label><label>{u.incomeKind}<select aria-label={u.incomeKind} value={income.kind ?? 'other'} onChange={(event) => updatePension(income.id, { kind: event.target.value as PensionCashflow['kind'] })}><option value="pension">{u.pension}</option><option value="rental">{u.rentalIncome}</option><option value="passive_income">{u.passiveIncome}</option><option value="temporary_income">{u.temporaryIncome}</option><option value="other">{u.other}</option></select></label><label>{u.incomeStartAge}<input aria-label={u.incomeStartAge} type="number" value={income.startAge} onChange={(event) => updatePension(income.id, { startAge: parseNumber(event.target.value) })} /></label><label>{u.endAge}<input aria-label={u.endAge} type="number" value={income.endAge ?? ''} placeholder={u.lifetimePlaceholder} onChange={(event) => updatePension(income.id, { endAge: event.target.value === '' ? undefined : parseNumber(event.target.value) })} /></label><MoneyInput label={u.monthlyIncomeAmount(localizedName(income.id, income.name))} value={income.monthlyAmount} onValueChange={(value) => updatePension(income.id, { monthlyAmount: value })} /><label>{u.reliability}<input aria-label={u.reliabilityAria} type="number" value={Math.round(income.reliability * 100)} onChange={(event) => updatePension(income.id, { reliability: parseNumber(event.target.value) / 100 })} /></label><button className="row-delete icon-button" type="button" aria-label={u.deleteItem} title={u.deleteItem} onClick={() => deletePension(income.id)}><span aria-hidden="true">×</span></button></article>)}</div><div className="assumption-strip"><span>{u.totalMonthlyIncome}<strong>{formatMoney(totalMonthlyRetirementIncome)}</strong></span><span>{u.monthlyShortfall}<strong>{formatMoney(monthlyShortfallAfterIncome)}</strong></span><span>{u.lockedAssetUnlock}<strong>{access.nextUnlockAge === null ? '-' : u.ageSuffix(access.nextUnlockAge)}</strong></span></div><p className="chart-note">{u.cashflowNote}</p></section>

      <section className="panel children-panel"><div className="section-title row-title"><div><p className="eyebrow">{u.dependents}</p><h2>{u.childrenExpenses}</h2></div><button type="button" onClick={addChild}>{u.addChild}</button></div><div className="asset-list" data-testid="children-list">{state.children.map((child) => { const event = child.lumpSumEvents?.[0] ?? { id: `event-${child.id}`, label: u.lumpSum, childAge: 30, amount: 0 }; return <article className="asset-row child-row" key={child.id}><strong>{child.name}</strong><label>{u.childName}<input aria-label={u.childName} value={child.name} onChange={(event) => updateChild(child.id, { name: event.target.value })} /></label><label>{u.childCurrentAge}<input aria-label={u.childCurrentAge} type="number" value={child.currentAge} onChange={(event) => updateChild(child.id, { currentAge: parseNumber(event.target.value) })} /></label><MoneyInput label={u.monthlyCareCost} value={child.monthlyCareCost} onValueChange={(value) => updateChild(child.id, { monthlyCareCost: value })} /><MoneyInput label={u.monthlyEducationCost} value={child.monthlyEducationCost} onValueChange={(value) => updateChild(child.id, { monthlyEducationCost: value })} /><label>{u.supportUntilAge}<input aria-label={u.supportUntilAge} type="number" value={child.supportUntilAge} onChange={(event) => updateChild(child.id, { supportUntilAge: parseNumber(event.target.value) })} /></label><label>{u.universityStartAge}<input aria-label={u.universityStartAge} type="number" value={child.universityStartAge ?? ''} onChange={(event) => updateChild(child.id, { universityStartAge: event.target.value === '' ? undefined : parseNumber(event.target.value) })} /></label><label>{u.universityEndAge}<input aria-label={u.universityEndAge} type="number" value={child.universityEndAge ?? ''} onChange={(event) => updateChild(child.id, { universityEndAge: event.target.value === '' ? undefined : parseNumber(event.target.value) })} /></label><MoneyInput label={u.annualUniversityCost} value={child.annualUniversityCost ?? 0} onValueChange={(value) => updateChild(child.id, { annualUniversityCost: value })} /><label>{u.lumpSumAge}<input aria-label={u.lumpSumAge} type="number" value={event.childAge} onChange={(evt) => updateChild(child.id, { lumpSumEvents: [{ ...event, childAge: parseNumber(evt.target.value) }] })} /></label><MoneyInput label={u.lumpSumAmount} value={event.amount} onValueChange={(value) => updateChild(child.id, { lumpSumEvents: [{ ...event, amount: value }] })} /></article> })}</div><div className="assumption-strip"><span>{u.currentAnnualChildExpense}<strong>{formatMoney(currentAnnualChildExpense)}</strong></span><span>{u.totalAnnualUniversityCost}<strong>{formatMoney(annualUniversityCost)}</strong></span><span>{u.childCount}<strong>{u.peopleSuffix(state.children.length)}</strong></span></div><p className="chart-note">{u.childrenNote}</p></section>

      <section className="panel"><div className="section-title"><p className="eyebrow">{u.sensitivityEyebrow}</p><h2>{t.sensitivity}</h2></div><SensitivityTable cases={sensitivity} t={t} formatMoney={formatMoney} /></section>
      <section className="bottom-grid"><div className="panel advice-panel"><div className="section-title"><p className="eyebrow">{t.action}</p><h2>{t.advice}</h2></div><ul><li>{t.adviceExpense(formatMoney(fiNumber - calculateFiNumber(adjustedMonthlyRetirementExpense * 0.9, state.safeWithdrawalRate)))}</li><li>{t.adviceSaving(sensitivity.find((item) => item.label === '저축 +20%')?.yearsToFi ?? null)}</li><li>{t.adviceReturn(formatPercent(realReturn))}</li></ul></div><div className="panel saved-panel"><div className="section-title"><p className="eyebrow">{t.saved}</p><h2>{t.savedScenarios}</h2></div>{savedScenarios.length === 0 ? <p className="empty-state">{t.emptySaved}</p> : <div className="saved-list">{savedScenarios.map((scenario) => <article className="saved-scenario" key={scenario.id}><button className="saved-load" type="button" onClick={() => setState(scenario.state)}><strong>{scenario.yearsToFi === null ? t.unavailable : t.yearsLater(scenario.yearsToFi)}</strong><span>{formatMoney(scenario.fiNumber)} · {formatPercent(scenario.progress)}</span><small>{scenario.savedAt}</small></button><button className="saved-delete" type="button" onClick={() => deleteSavedScenario(scenario.id)}>{u.deleteSavedScenario}</button></article>)}</div>}</div></section>
      <footer className="disclaimer">{t.disclaimer}</footer>
    </main>
  )
}

function MetricCard({ label, value, note, tone = 'default' }: { label: string; value: string; note: string; tone?: 'default' | 'good' | 'warn' }) { return <section className={`metric-card ${tone}`}><span>{label}</span><strong>{value}</strong><p>{note}</p></section> }
function SensitivityTable({ cases, t, formatMoney }: { cases: SensitivityCase[]; t: Copy; formatMoney: (value: number) => string }) { return <div className="table-wrap"><table><thead><tr><th>{t.scenario}</th><th>{t.description}</th><th>{t.neededAssets}</th><th>{t.retirementTiming}</th></tr></thead><tbody>{cases.map((item) => <tr key={item.label}><td>{t.sensitivityLabels[item.label] ?? item.label}</td><td>{t.sensitivityDescriptions[item.label] ?? item.description}</td><td>{formatMoney(item.fiNumber)}</td><td>{item.yearsToFi === null ? t.hardToReach : `${t.yearsLater(item.yearsToFi)} · ${item.retirementYear}`}</td></tr>)}</tbody></table></div> }
function MiniLineChart({ data, target, targetLabel, ariaLabel }: { data: { year: number; balance: number }[]; target: number; targetLabel: string; ariaLabel: string }) { const width = 620, height = 210, pad = 28; const max = Math.max(target, ...data.map((item) => item.balance), 1); const minYear = data[0]?.year ?? START_YEAR; const maxYear = data.at(-1)?.year ?? minYear + 1; const span = Math.max(1, maxYear - minYear); const points = data.map((item) => `${pad + ((item.year - minYear) / span) * (width - pad * 2)},${height - pad - (item.balance / max) * (height - pad * 2)}`).join(' '); const targetY = height - pad - (target / max) * (height - pad * 2); return <svg className="mini-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}><line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} className="chart-axis" /><line x1={pad} x2={width - pad} y1={targetY} y2={targetY} className="chart-target" /><polyline points={points} className="chart-line" />{data.map((item) => { const x = pad + ((item.year - minYear) / span) * (width - pad * 2); const y = height - pad - (item.balance / max) * (height - pad * 2); return <circle key={item.year} cx={x} cy={y} r="3.4" className="chart-dot" /> })}<text x={pad} y={height - 6} className="chart-label">{minYear}</text><text x={width - pad - 36} y={height - 6} className="chart-label">{maxYear}</text><text x={width - pad - 130} y={Math.max(14, targetY - 8)} className="chart-label target-label">{targetLabel}</text></svg> }
export default App
