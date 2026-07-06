import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  calculateFiNumber,
  calculateMonthlyDebtPaymentAtAge,
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
  type PensionCashflow,
  type SensitivityCase,
} from './lib/finance'
import { buildPlannerInsights } from './lib/insights'
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
  monthlyRetirementExpense: 4_000_000,
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

function App() {
  const [state, setState] = useState<PlannerState>(defaultState)
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(readSavedScenarios)
  const [language, setLanguage] = useState<Language>('ko')
  const [currency, setCurrency] = useState<CurrencyCode>('KRW')
  const [koreaCosts, setKoreaCosts] = useState<KoreaCostAssumptions>(defaultKoreaCostAssumptions)
  const [reportStatus, setReportStatus] = useState('')
  const t = copy[language]

  const percentFormatter = useMemo(() => new Intl.NumberFormat(t.locale, { maximumFractionDigits: 1 }), [t.locale])
  const moneyFormatter = useMemo(() => new Intl.NumberFormat(t.locale, { style: 'currency', currency, maximumFractionDigits: 0 }), [currency, t.locale])
  const formatMoney = (value: number) => Number.isFinite(value) ? moneyFormatter.format(Math.round(value)) : t.noValue
  const formatPercent = (value: number) => `${percentFormatter.format(value * 100)}%`

  const realReturn = useMemo(() => toRealReturn(state.nominalReturn, state.inflationRate), [state.nominalReturn, state.inflationRate])
  const netWorth = useMemo(() => calculateNetWorth({ assets: state.assets, liabilities: state.liabilities }), [state.assets, state.liabilities])
  const access = useMemo(() => calculateUnlockedFiAssets({ assets: state.assets, currentAge: state.currentAge }), [state.assets, state.currentAge])
  const koreaCostResult = useMemo(() => calculateKoreaCostAdjustment(koreaCosts), [koreaCosts])
  const adjustedMonthlyRetirementExpense = state.monthlyRetirementExpense + koreaCostResult.monthlyExtraCost
  const fiNumber = useMemo(() => calculateFiNumber(adjustedMonthlyRetirementExpense, state.safeWithdrawalRate), [adjustedMonthlyRetirementExpense, state.safeWithdrawalRate])
  const yearsToFi = useMemo(() => calculateYearsToRetirementReadiness({ currentAge: state.currentAge, monthlyContribution: state.monthlyContribution, monthlyRetirementExpense: adjustedMonthlyRetirementExpense, annualReturn: realReturn, retirementYears: state.retirementYears, assets: state.assets, pensions: state.pensions, children: state.children, liabilities: state.liabilities }), [adjustedMonthlyRetirementExpense, realReturn, state.assets, state.children, state.currentAge, state.liabilities, state.monthlyContribution, state.pensions, state.retirementYears])
  const retirementYear = yearsToFi === null ? null : START_YEAR + yearsToFi
  const retirementAge = state.currentAge + (yearsToFi ?? 0)
  const remainingDebtPaymentAtRetirement = calculateMonthlyDebtPaymentAtAge(state.liabilities, retirementAge)
  const progress = fiNumber > 0 ? access.unlockedFiAssets / fiNumber : 1

  const projection = useMemo(() => createYearlyProjection({ currentFiAssets: access.unlockedFiAssets, annualContribution: state.monthlyContribution * 12, annualReturn: realReturn, fiNumber, startYear: START_YEAR }), [fiNumber, access.unlockedFiAssets, realReturn, state.monthlyContribution])
  const projectedRetirementAssets = useMemo(() => projectAssetsToRetirementAge({ assets: state.assets, currentAge: state.currentAge, retirementAge, annualContribution: state.monthlyContribution * 12, annualReturn: realReturn }), [realReturn, retirementAge, state.assets, state.currentAge, state.monthlyContribution])
  const readiness = useMemo(() => calculateRetirementReadiness({ currentAge: state.currentAge, retirementAge, retirementYears: state.retirementYears, monthlyRetirementExpense: adjustedMonthlyRetirementExpense, annualReturn: realReturn, assets: projectedRetirementAssets, pensions: state.pensions, children: state.children, liabilities: state.liabilities }), [adjustedMonthlyRetirementExpense, projectedRetirementAssets, realReturn, retirementAge, state.children, state.currentAge, state.liabilities, state.pensions, state.retirementYears])
  const sensitivity = useMemo(() => getSensitivityMatrix({ currentFiAssets: access.unlockedFiAssets, monthlyContribution: state.monthlyContribution, monthlyRetirementExpense: adjustedMonthlyRetirementExpense, annualReturn: realReturn, safeWithdrawalRate: state.safeWithdrawalRate, startYear: START_YEAR, retirementYears: state.retirementYears, currentAge: state.currentAge, assets: state.assets, pensions: state.pensions, children: state.children, liabilities: state.liabilities }), [access.unlockedFiAssets, adjustedMonthlyRetirementExpense, realReturn, state.assets, state.children, state.currentAge, state.liabilities, state.monthlyContribution, state.pensions, state.retirementYears, state.safeWithdrawalRate])

  const totalMonthlyRetirementIncome = state.pensions.reduce((sum, income) => sum + Math.max(0, income.monthlyAmount) * Math.max(0, Math.min(1, income.reliability)), 0)
  const monthlyShortfallAfterIncome = Math.max(0, adjustedMonthlyRetirementExpense + remainingDebtPaymentAtRetirement - totalMonthlyRetirementIncome)
  const currentAnnualChildExpense = state.children.reduce((sum, child) => sum + (Math.max(0, child.monthlyCareCost) + Math.max(0, child.monthlyEducationCost)) * 12, 0)
  const annualUniversityCost = state.children.reduce((sum, child) => sum + Math.max(0, child.annualUniversityCost ?? 0), 0)
  const savingsRate = calculateSavingsRate(state.monthlyIncome, state.monthlyContribution)
  const statusTone = progress >= 1 ? 'good' : yearsToFi !== null && yearsToFi <= 10 ? 'warn' : 'default'
  const expenseReductionImpact = calculateFiNumber(adjustedMonthlyRetirementExpense, state.safeWithdrawalRate) - calculateFiNumber(adjustedMonthlyRetirementExpense * 0.9, state.safeWithdrawalRate)
  const insights = useMemo(() => buildPlannerInsights({ progress, yearsToFi, unlockedFiAssets: access.unlockedFiAssets, fiNumber, lockedFiAssets: access.lockedFiAssets, nextUnlockAge: access.nextUnlockAge, monthlyRetirementExpense: adjustedMonthlyRetirementExpense, totalMonthlyRetirementIncome, expenseReductionImpact }), [access.lockedFiAssets, access.nextUnlockAge, access.unlockedFiAssets, adjustedMonthlyRetirementExpense, expenseReductionImpact, fiNumber, progress, totalMonthlyRetirementIncome, yearsToFi])
  const decisionScenarios = useMemo(() => createDecisionScenarios({ currentAge: state.currentAge, monthlyContribution: state.monthlyContribution, monthlyRetirementExpense: adjustedMonthlyRetirementExpense, annualReturn: realReturn, safeWithdrawalRate: state.safeWithdrawalRate, startYear: START_YEAR, retirementYears: state.retirementYears, assets: state.assets, pensions: state.pensions, children: state.children, liabilities: state.liabilities }), [adjustedMonthlyRetirementExpense, realReturn, state.assets, state.children, state.currentAge, state.liabilities, state.monthlyContribution, state.pensions, state.retirementYears, state.safeWithdrawalRate])

  const updateNumber = (field: keyof PlannerState, value: number) => setState((current) => ({ ...current, [field]: value }))
  const updatePercent = (field: keyof PlannerState, value: string) => setState((current) => ({ ...current, [field]: parseNumber(value) / 100 }))
  const updateAsset = (id: string, patch: Partial<Asset>) => setState((current) => ({ ...current, assets: current.assets.map((asset) => asset.id === id ? { ...asset, ...patch } : asset) }))
  const updateLiability = (id: string, patch: Partial<Liability>) => setState((current) => ({ ...current, liabilities: current.liabilities.map((liability) => liability.id === id ? { ...liability, ...patch } : liability) }))
  const updatePension = (id: string, patch: Partial<PensionCashflow>) => setState((current) => ({ ...current, pensions: current.pensions.map((pension) => pension.id === id ? { ...pension, ...patch } : pension) }))
  const updateChild = (id: string, patch: Partial<ChildExpense>) => setState((current) => ({ ...current, children: current.children.map((child) => child.id === id ? { ...child, ...patch } : child) }))
  const updateKoreaCosts = (patch: Partial<KoreaCostAssumptions>) => setKoreaCosts((current) => ({ ...current, ...patch }))

  const addChild = () => setState((current) => ({
    ...current,
    children: [...current.children, { id: `child-${Date.now()}`, name: '자녀', currentAge: 0, monthlyCareCost: 0, monthlyEducationCost: 0, supportUntilAge: 24, universityStartAge: 19, universityEndAge: 22, annualUniversityCost: 0, lumpSumEvents: [{ id: `event-${Date.now()}`, label: '일시금', childAge: 30, amount: 0 }] }],
  }))
  const addIncome = () => setState((current) => ({
    ...current,
    pensions: [...current.pensions, { id: `income-${Date.now()}`, name: '월세/임대소득', kind: 'rental', startAge: current.currentAge, monthlyAmount: 0, reliability: 1 }],
  }))
  const addAsset = () => setState((current) => ({ ...current, assets: [...current.assets, { id: `asset-${Date.now()}`, name: t.newAsset, type: 'fund', value: 0, liquidity: 'high', includeForFi: true }] }))
  const saveScenario = () => { const next = { id: `scenario-${Date.now()}`, savedAt: new Date().toLocaleString(t.locale), yearsToFi, retirementYear, fiNumber, progress, state }; const scenarios = [next, ...savedScenarios].slice(0, 6); localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios)); setSavedScenarios(scenarios) }
  const scenarioTiming = (scenario: { yearsToFi: number | null; retirementYear: number | null }) => scenario.yearsToFi === null ? t.needsAdjustment : `${t.yearsLater(scenario.yearsToFi)} · ${scenario.retirementYear}`
  const scenarioRisk = (risk: 'low' | 'medium' | 'high') => risk === 'low' ? '낮음' : risk === 'medium' ? '보통' : '주의'
  const copyReport = async () => {
    const markdown = generateMarkdownReport({
      title: '한국형 경제적 자유 시뮬레이터 리포트',
      generatedAt: new Date().toLocaleString(t.locale),
      summary: { yearsToFi, retirementYear, fiNumber: formatMoney(fiNumber), progress: formatPercent(progress), monthlyShortfall: formatMoney(monthlyShortfallAfterIncome) },
      assumptions: [`실질수익률 ${formatPercent(realReturn)}`, `안전인출률 ${formatPercent(state.safeWithdrawalRate)}`, `세금/건강보험료 월 보정 ${formatMoney(koreaCostResult.monthlyExtraCost)}`],
      insights: insights.map((insight) => insight.message),
      scenarios: decisionScenarios.map((scenario) => ({ label: scenario.label, timing: scenarioTiming(scenario), risk: scenarioRisk(scenario.risk) })),
      disclaimer: t.disclaimer,
    })
    await navigator.clipboard?.writeText(markdown)
    setReportStatus('리포트를 클립보드에 복사했습니다.')
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
        <MetricCard label={t.fiAssets} value={formatMoney(fiNumber)} note={`${t.monthly} ${formatMoney(state.monthlyRetirementExpense)} · SWR ${formatPercent(state.safeWithdrawalRate)}`} tone={statusTone} />
        <MetricCard label={t.progress} value={formatPercent(progress)} note={`현재 사용가능 FI 자산 ${formatMoney(access.unlockedFiAssets)}`} />
        <MetricCard label={t.savingsRate} value={formatPercent(savingsRate)} note={`${t.monthlySaving} ${formatMoney(state.monthlyContribution)}`} />
        <MetricCard label={t.stability} value={readiness.success ? t.passed : t.caution} note={readiness.success ? `연금·잠긴자산 반영 ${state.retirementYears}년 통과` : `${readiness.depletedAge}세 고갈 가능`} tone={readiness.success ? 'good' : 'warn'} />
      </section>

      <section className="decision-grid">
        <div className="panel insight-panel">
          <div className="section-title row-title"><div><p className="eyebrow">Decision</p><h2>결과 해석</h2></div><button type="button" onClick={copyReport}>Markdown 리포트 복사</button></div>
          <ul className="insight-list">{insights.map((insight) => <li className={insight.tone} key={insight.message}>{insight.message}</li>)}</ul>
          {reportStatus && <p className="copy-status">{reportStatus}</p>}
        </div>
        <div className="panel scenario-panel">
          <div className="section-title"><p className="eyebrow">Scenarios</p><h2>시나리오 비교</h2></div>
          <div className="table-wrap"><table><thead><tr><th>시나리오</th><th>은퇴 시점</th><th>월 지출</th><th>리스크</th></tr></thead><tbody>{decisionScenarios.map((scenario) => <tr key={scenario.label}><td>{scenario.label}</td><td>{scenarioTiming(scenario)}</td><td>{formatMoney(scenario.monthlyRetirementExpense)}</td><td><span className={`risk ${scenario.risk}`}>{scenarioRisk(scenario.risk)}</span></td></tr>)}</tbody></table></div>
        </div>
        <div className="panel korea-cost-panel">
          <div className="section-title"><p className="eyebrow">Korea Reality</p><h2>한국형 비용 보정</h2></div>
          <div className="form-grid compact"><label className="check-label"><input aria-label="건강보험료 반영" type="checkbox" checked={koreaCosts.includeHealthInsurance} onChange={(event) => updateKoreaCosts({ includeHealthInsurance: event.target.checked })} />건강보험료 반영</label><MoneyInput label="건강보험료 월 추정치" value={koreaCosts.healthInsuranceMonthlyEstimate} onValueChange={(value) => updateKoreaCosts({ healthInsuranceMonthlyEstimate: value })} /><label className="check-label"><input aria-label="투자소득 세금 반영" type="checkbox" checked={koreaCosts.includeInvestmentTax} onChange={(event) => updateKoreaCosts({ includeInvestmentTax: event.target.checked })} />투자소득 세금 반영</label><MoneyInput label="투자소득 월 과세대상" value={koreaCosts.taxableInvestmentMonthlyIncome ?? 0} onValueChange={(value) => updateKoreaCosts({ taxableInvestmentMonthlyIncome: value })} /></div>
          <div className="assumption-strip"><span>월 추가 비용<strong>{formatMoney(koreaCostResult.monthlyExtraCost)}</strong></span><span>연 추가 비용<strong>{formatMoney(koreaCostResult.annualExtraCost)}</strong></span></div>
          <ul className="mini-notes">{koreaCostResult.notes.map((note) => <li key={note}>{note}</li>)}</ul>
        </div>
      </section>

      <div className="workspace"><section className="panel input-panel"><div className="section-title"><p className="eyebrow">{t.inputs}</p><h2>{t.quickInputs}</h2></div><div className="form-grid"><label>현재 나이<input aria-label="현재 나이" type="number" value={state.currentAge} onChange={(event) => updateNumber('currentAge', parseNumber(event.target.value))} /></label><MoneyInput label={t.monthlyIncome} value={state.monthlyIncome} onValueChange={(value) => updateNumber('monthlyIncome', value)} /><MoneyInput label={t.monthlyContribution} value={state.monthlyContribution} onValueChange={(value) => updateNumber('monthlyContribution', value)} /><MoneyInput label={t.monthlyExpense} value={state.monthlyRetirementExpense} onValueChange={(value) => updateNumber('monthlyRetirementExpense', value)} /><label>{t.nominalReturn}<input aria-label={t.nominalReturn.replace(' (%)', '')} type="number" step="0.1" value={(state.nominalReturn * 100).toFixed(1)} onChange={(event) => updatePercent('nominalReturn', event.target.value)} /></label><label>{t.inflation}<input aria-label={t.inflation.replace(' (%)', '')} type="number" step="0.1" value={(state.inflationRate * 100).toFixed(1)} onChange={(event) => updatePercent('inflationRate', event.target.value)} /></label><label>{t.safeWithdrawalRate}<input aria-label={t.safeWithdrawalRate.replace(' (%)', '')} type="number" step="0.1" value={(state.safeWithdrawalRate * 100).toFixed(1)} onChange={(event) => updatePercent('safeWithdrawalRate', event.target.value)} /></label></div><div className="assumption-strip"><span>{t.realReturn}<strong>{formatPercent(realReturn)}</strong></span><span>{t.netWorth}<strong>{formatMoney(netWorth.netWorth)}</strong></span><span>{t.liabilities}<strong>{formatMoney(netWorth.totalLiabilities)}</strong></span></div></section>
        <section className="panel chart-panel"><div className="section-title row-title"><div><p className="eyebrow">{t.projection}</p><h2>{t.growthPath}</h2></div><button type="button" onClick={saveScenario}>{t.saveScenario}</button></div><MiniLineChart data={projection} target={fiNumber} targetLabel={`${t.targetPrefix} ${formatMoney(fiNumber)}`} ariaLabel={t.chartAria} /><p className="chart-note">{t.chartNote}</p></section></div>

      <section className="panel assets-panel"><div className="section-title row-title"><div><p className="eyebrow">{t.assets}</p><h2>{t.assetInput}</h2></div><button type="button" onClick={addAsset}>{t.addAsset}</button></div><div className="asset-summary"><strong>55세 이후 사용가능 자산</strong><span>잠긴 FI 자산 {formatMoney(access.lockedFiAssets)}</span><small>{access.nextUnlockAge === null ? '잠긴 자산 없음' : `${access.nextUnlockAge}세부터 순차적으로 은퇴 인출 재원에 합산됩니다.`}</small></div><div className="asset-list" data-testid="asset-list">{state.assets.map((asset) => <article className="asset-row" key={asset.id}><label>{t.assetName}<input aria-label={t.assetName} value={asset.name} onChange={(event) => updateAsset(asset.id, { name: event.target.value })} /></label><MoneyInput label={t.assetValue} value={asset.value} onValueChange={(value) => updateAsset(asset.id, { value })} /><label>사용 가능 나이<input aria-label="사용 가능 나이" type="number" value={asset.availableAge ?? ''} placeholder="현재" onChange={(event) => updateAsset(asset.id, { availableAge: event.target.value === '' ? undefined : parseNumber(event.target.value) })} /></label><label className="check-label"><input type="checkbox" checked={asset.includeForFi} onChange={(event) => updateAsset(asset.id, { includeForFi: event.target.checked })} />{t.includeForFi}</label><span className={`liquidity ${asset.liquidity}`}>{asset.liquidity === 'high' ? t.high : asset.liquidity === 'medium' ? t.medium : t.low}</span></article>)}</div></section>

      <section className="panel liabilities-panel"><div className="section-title"><p className="eyebrow">Debt Bridge</p><h2>대출 상환 반영</h2></div><div className="asset-list" data-testid="liability-list">{state.liabilities.map((liability) => <article className="asset-row" key={liability.id}><strong>{liability.name}</strong><label>대출명<input aria-label="대출명" value={liability.name} onChange={(event) => updateLiability(liability.id, { name: event.target.value })} /></label><MoneyInput label="대출 잔액" value={liability.balance} onValueChange={(value) => updateLiability(liability.id, { balance: value })} /><MoneyInput label="월 상환액" value={liability.monthlyPayment ?? 0} onValueChange={(value) => updateLiability(liability.id, { monthlyPayment: value })} /><label>상환 종료 나이<input aria-label="상환 종료 나이" type="number" value={liability.payoffAge ?? ''} placeholder="계속" onChange={(event) => updateLiability(liability.id, { payoffAge: event.target.value === '' ? undefined : parseNumber(event.target.value) })} /></label><label className="check-label"><input type="checkbox" checked={Boolean(liability.includePaymentInRetirement)} onChange={(event) => updateLiability(liability.id, { includePaymentInRetirement: event.target.checked })} />은퇴 후 지출에 반영</label></article>)}</div><div className="assumption-strip"><span>은퇴 시점 남은 월상환<strong>{formatMoney(remainingDebtPaymentAtRetirement)}</strong></span><span>상환 반영 나이<strong>{retirementAge}세</strong></span></div></section>

      <section className="panel pension-panel"><div className="section-title row-title"><div><p className="eyebrow">Cashflows</p><h2>은퇴 후 소득/현금흐름</h2></div><button type="button" onClick={addIncome}>소득 추가</button></div><div className="asset-list" data-testid="cashflow-list">{state.pensions.map((income) => <article className="asset-row pension-row" key={income.id}><strong>{income.name}</strong><label>소득명<input aria-label="소득명" value={income.name} onChange={(event) => updatePension(income.id, { name: event.target.value })} /></label><label>소득 종류<select aria-label="소득 종류" value={income.kind ?? 'other'} onChange={(event) => updatePension(income.id, { kind: event.target.value as PensionCashflow['kind'] })}><option value="pension">연금</option><option value="rental">월세/임대소득</option><option value="passive_income">패시브 인컴</option><option value="temporary_income">기간한정 소득</option><option value="other">기타</option></select></label><label>수령 시작 나이<input aria-label="수령 시작 나이" type="number" value={income.startAge} onChange={(event) => updatePension(income.id, { startAge: parseNumber(event.target.value) })} /></label><label>종료 나이<input aria-label="종료 나이" type="number" value={income.endAge ?? ''} placeholder="종신/무기한" onChange={(event) => updatePension(income.id, { endAge: event.target.value === '' ? undefined : parseNumber(event.target.value) })} /></label><MoneyInput label={`${income.name} 월 수령액`} value={income.monthlyAmount} onValueChange={(value) => updatePension(income.id, { monthlyAmount: value })} /><label>보수적 반영률 (%)<input aria-label="보수적 반영률" type="number" value={Math.round(income.reliability * 100)} onChange={(event) => updatePension(income.id, { reliability: parseNumber(event.target.value) / 100 })} /></label></article>)}</div><div className="assumption-strip"><span>총 월 소득<strong>{formatMoney(totalMonthlyRetirementIncome)}</strong></span><span>월 부족액<strong>{formatMoney(monthlyShortfallAfterIncome)}</strong></span><span>잠긴자산 해제<strong>{access.nextUnlockAge === null ? '-' : `${access.nextUnlockAge}세`}</strong></span></div><p className="chart-note">국민연금, 개인연금, 월세, 배당 같은 은퇴 후 월수입을 여러 개 추가할 수 있습니다. 종료 나이를 비워두면 종신/무기한으로 보고, 종료 나이를 넣으면 그 나이 이후에는 소득에서 제외합니다.</p></section>

      <section className="panel children-panel"><div className="section-title row-title"><div><p className="eyebrow">Dependents</p><h2>자녀/부양가족 비용</h2></div><button type="button" onClick={addChild}>자녀 추가</button></div><div className="asset-list" data-testid="children-list">{state.children.map((child) => { const event = child.lumpSumEvents?.[0] ?? { id: `event-${child.id}`, label: '일시금', childAge: 30, amount: 0 }; return <article className="asset-row child-row" key={child.id}><strong>{child.name}</strong><label>자녀명<input aria-label="자녀명" value={child.name} onChange={(event) => updateChild(child.id, { name: event.target.value })} /></label><label>현재 자녀 나이<input aria-label="현재 자녀 나이" type="number" value={child.currentAge} onChange={(event) => updateChild(child.id, { currentAge: parseNumber(event.target.value) })} /></label><MoneyInput label="월 양육비" value={child.monthlyCareCost} onValueChange={(value) => updateChild(child.id, { monthlyCareCost: value })} /><MoneyInput label="월 교육비" value={child.monthlyEducationCost} onValueChange={(value) => updateChild(child.id, { monthlyEducationCost: value })} /><label>지원 종료 나이<input aria-label="지원 종료 나이" type="number" value={child.supportUntilAge} onChange={(event) => updateChild(child.id, { supportUntilAge: parseNumber(event.target.value) })} /></label><label>대학 시작 나이<input aria-label="대학 시작 나이" type="number" value={child.universityStartAge ?? ''} onChange={(event) => updateChild(child.id, { universityStartAge: event.target.value === '' ? undefined : parseNumber(event.target.value) })} /></label><label>대학 종료 나이<input aria-label="대학 종료 나이" type="number" value={child.universityEndAge ?? ''} onChange={(event) => updateChild(child.id, { universityEndAge: event.target.value === '' ? undefined : parseNumber(event.target.value) })} /></label><MoneyInput label="대학 연간비" value={child.annualUniversityCost ?? 0} onValueChange={(value) => updateChild(child.id, { annualUniversityCost: value })} /><label>일시금 나이<input aria-label="일시금 나이" type="number" value={event.childAge} onChange={(evt) => updateChild(child.id, { lumpSumEvents: [{ ...event, childAge: parseNumber(evt.target.value) }] })} /></label><MoneyInput label="일시금 금액" value={event.amount} onValueChange={(value) => updateChild(child.id, { lumpSumEvents: [{ ...event, amount: value }] })} /></article> })}</div><div className="assumption-strip"><span>현재 연간 자녀비<strong>{formatMoney(currentAnnualChildExpense)}</strong></span><span>대학 연간비 합계<strong>{formatMoney(annualUniversityCost)}</strong></span><span>자녀 수<strong>{state.children.length}명</strong></span></div><p className="chart-note">자녀 비용은 영구 생활비가 아니라 지원 종료 나이 전 월비용, 대학 기간 연간비, 특정 자녀 나이의 일시금 이벤트로 은퇴 후 안정성에 반영합니다.</p></section>

      <section className="panel"><div className="section-title"><p className="eyebrow">Sensitivity</p><h2>{t.sensitivity}</h2></div><SensitivityTable cases={sensitivity} t={t} formatMoney={formatMoney} /></section>
      <section className="bottom-grid"><div className="panel advice-panel"><div className="section-title"><p className="eyebrow">{t.action}</p><h2>{t.advice}</h2></div><ul><li>{t.adviceExpense(formatMoney(fiNumber - calculateFiNumber(state.monthlyRetirementExpense * 0.9, state.safeWithdrawalRate)))}</li><li>{t.adviceSaving(sensitivity.find((item) => item.label === '저축 +20%')?.yearsToFi ?? null)}</li><li>{t.adviceReturn(formatPercent(realReturn))}</li></ul></div><div className="panel saved-panel"><div className="section-title"><p className="eyebrow">{t.saved}</p><h2>{t.savedScenarios}</h2></div>{savedScenarios.length === 0 ? <p className="empty-state">{t.emptySaved}</p> : <div className="saved-list">{savedScenarios.map((scenario) => <button type="button" key={scenario.id} onClick={() => setState(scenario.state)}><strong>{scenario.yearsToFi === null ? t.unavailable : t.yearsLater(scenario.yearsToFi)}</strong><span>{formatMoney(scenario.fiNumber)} · {formatPercent(scenario.progress)}</span><small>{scenario.savedAt}</small></button>)}</div>}</div></section>
      <footer className="disclaimer">{t.disclaimer}</footer>
    </main>
  )
}

function MetricCard({ label, value, note, tone = 'default' }: { label: string; value: string; note: string; tone?: 'default' | 'good' | 'warn' }) { return <section className={`metric-card ${tone}`}><span>{label}</span><strong>{value}</strong><p>{note}</p></section> }
function SensitivityTable({ cases, t, formatMoney }: { cases: SensitivityCase[]; t: Copy; formatMoney: (value: number) => string }) { return <div className="table-wrap"><table><thead><tr><th>{t.scenario}</th><th>{t.description}</th><th>{t.neededAssets}</th><th>{t.retirementTiming}</th></tr></thead><tbody>{cases.map((item) => <tr key={item.label}><td>{t.sensitivityLabels[item.label] ?? item.label}</td><td>{t.sensitivityDescriptions[item.label] ?? item.description}</td><td>{formatMoney(item.fiNumber)}</td><td>{item.yearsToFi === null ? t.hardToReach : `${t.yearsLater(item.yearsToFi)} · ${item.retirementYear}`}</td></tr>)}</tbody></table></div> }
function MiniLineChart({ data, target, targetLabel, ariaLabel }: { data: { year: number; balance: number }[]; target: number; targetLabel: string; ariaLabel: string }) { const width = 620, height = 210, pad = 28; const max = Math.max(target, ...data.map((item) => item.balance), 1); const minYear = data[0]?.year ?? START_YEAR; const maxYear = data.at(-1)?.year ?? minYear + 1; const span = Math.max(1, maxYear - minYear); const points = data.map((item) => `${pad + ((item.year - minYear) / span) * (width - pad * 2)},${height - pad - (item.balance / max) * (height - pad * 2)}`).join(' '); const targetY = height - pad - (target / max) * (height - pad * 2); return <svg className="mini-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}><line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} className="chart-axis" /><line x1={pad} x2={width - pad} y1={targetY} y2={targetY} className="chart-target" /><polyline points={points} className="chart-line" />{data.map((item) => { const x = pad + ((item.year - minYear) / span) * (width - pad * 2); const y = height - pad - (item.balance / max) * (height - pad * 2); return <circle key={item.year} cx={x} cy={y} r="3.4" className="chart-dot" /> })}<text x={pad} y={height - 6} className="chart-label">{minYear}</text><text x={width - pad - 36} y={height - 6} className="chart-label">{maxYear}</text><text x={width - pad - 130} y={Math.max(14, targetY - 8)} className="chart-label target-label">{targetLabel}</text></svg> }
export default App
