export type AssetType = 'cash' | 'deposit' | 'stock' | 'fund' | 'pension' | 'real_estate' | 'crypto' | 'other'
export type LiabilityType = 'mortgage' | 'credit' | 'loan' | 'other'
export type Liquidity = 'high' | 'medium' | 'low'

export type Asset = {
  id: string
  name: string
  type: AssetType
  value: number
  expectedAnnualReturn?: number
  /** Age when this asset can be used for retirement spending. Empty/undefined means available now. */
  availableAge?: number
  liquidity: Liquidity
  includeForFi: boolean
}

export type PensionCashflow = {
  id: string
  name: string
  kind?: 'pension' | 'rental' | 'passive_income' | 'temporary_income' | 'other'
  /** Age when monthly pension/income starts. */
  startAge: number
  /** Optional final age. Undefined means lifetime/indefinite. */
  endAge?: number
  monthlyAmount: number
  /** Conservative haircut: 1 = 100%, 0.7 = count 70% of expected benefit. */
  reliability: number
  inflationLinked?: boolean
}

export type Liability = {
  id: string
  name: string
  type: LiabilityType
  balance: number
  interestRate: number
  monthlyPayment?: number
}

export type NetWorthInput = {
  assets: Asset[]
  liabilities: Liability[]
}

export type NetWorthResult = {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  fiAssets: number
}

export type YearsToFiInput = {
  currentFiAssets: number
  annualContribution: number
  annualReturn: number
  fiNumber: number
  maxYears?: number
}

export type ProjectionPoint = {
  year: number
  balance: number
  contribution: number
  growth: number
  progress: number
}

export type DrawdownPoint = {
  year: number
  startBalance: number
  withdrawal: number
  growth: number
  endBalance: number
}

export type DrawdownResult = {
  success: boolean
  depletedYear: number | null
  points: DrawdownPoint[]
}

export type UnlockedFiAssetsResult = {
  unlockedFiAssets: number
  lockedFiAssets: number
  nextUnlockAge: number | null
}

export type RetirementReadinessPoint = {
  age: number
  startBalance: number
  pensionIncome: number
  withdrawal: number
  unlockedFromAssets: number
  growth: number
  endBalance: number
}

export type RetirementReadinessResult = {
  success: boolean
  depletedAge: number | null
  unlockedAtRetirement: number
  lockedAtRetirement: number
  points: RetirementReadinessPoint[]
}

export type SimulationInput = {
  currentFiAssets: number
  monthlyContribution: number
  monthlyRetirementExpense: number
  annualReturn: number
  safeWithdrawalRate: number
  startYear: number
  retirementYears: number
}

export type SensitivityCase = {
  label: string
  description: string
  fiNumber: number
  yearsToFi: number | null
  retirementYear: number | null
}

const clampMoney = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0)

export function calculateNetWorth({ assets, liabilities }: NetWorthInput): NetWorthResult {
  const totalAssets = assets.reduce((sum, asset) => sum + clampMoney(asset.value), 0)
  const totalLiabilities = liabilities.reduce((sum, liability) => sum + clampMoney(liability.balance), 0)
  const fiAssets = assets.filter((asset) => asset.includeForFi).reduce((sum, asset) => sum + clampMoney(asset.value), 0)

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    fiAssets,
  }
}

export function calculateUnlockedFiAssets({ assets, currentAge }: { assets: Asset[]; currentAge: number }): UnlockedFiAssetsResult {
  const fiAssets = assets.filter((asset) => asset.includeForFi)
  const unlockedFiAssets = fiAssets
    .filter((asset) => asset.availableAge === undefined || asset.availableAge <= currentAge)
    .reduce((sum, asset) => sum + clampMoney(asset.value), 0)
  const lockedAssets = fiAssets.filter((asset) => asset.availableAge !== undefined && asset.availableAge > currentAge)
  const lockedFiAssets = lockedAssets.reduce((sum, asset) => sum + clampMoney(asset.value), 0)
  const nextUnlockAge = lockedAssets.reduce<number | null>((next, asset) => next === null ? asset.availableAge ?? null : Math.min(next, asset.availableAge ?? next), null)

  return { unlockedFiAssets, lockedFiAssets, nextUnlockAge }
}

export function calculateFiNumber(monthlyRetirementExpense: number, safeWithdrawalRate: number): number {
  if (!Number.isFinite(safeWithdrawalRate) || safeWithdrawalRate <= 0) return Number.POSITIVE_INFINITY
  return clampMoney(monthlyRetirementExpense) * 12 / safeWithdrawalRate
}

export function toRealReturn(nominalAnnualReturn: number, inflationRate: number): number {
  return (1 + nominalAnnualReturn) / (1 + inflationRate) - 1
}

export function toMonthlyRate(annualReturn: number): number {
  return Math.pow(1 + annualReturn, 1 / 12) - 1
}

export function calculateSavingsRate(monthlyIncome: number, monthlySaving: number): number {
  if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) return 0
  return Math.max(0, monthlySaving) / monthlyIncome
}

export function calculateYearsToFi({ currentFiAssets, annualContribution, annualReturn, fiNumber, maxYears = 100 }: YearsToFiInput): number | null {
  let balance = clampMoney(currentFiAssets)
  const target = clampMoney(fiNumber)
  const contribution = clampMoney(annualContribution)

  if (balance >= target) return 0
  if (target === 0) return 0
  if (annualReturn <= 0 && contribution <= 0) return null

  for (let year = 1; year <= maxYears; year += 1) {
    balance = balance * (1 + annualReturn) + contribution
    if (balance >= target) return year
  }

  return null
}

export function createYearlyProjection({ currentFiAssets, annualContribution, annualReturn, fiNumber, startYear, maxYears = 100 }: YearsToFiInput & { startYear: number }): ProjectionPoint[] {
  const points: ProjectionPoint[] = []
  let balance = clampMoney(currentFiAssets)
  const target = clampMoney(fiNumber)
  const contribution = clampMoney(annualContribution)

  points.push({ year: startYear, balance, contribution: 0, growth: 0, progress: target > 0 ? balance / target : 1 })

  for (let index = 1; index <= maxYears; index += 1) {
    const growth = balance * annualReturn
    balance = balance + growth + contribution
    points.push({ year: startYear + index, balance, contribution, growth, progress: target > 0 ? balance / target : 1 })
    if (balance >= target) break
  }

  return points
}

export function simulateRetirementDrawdown({ startingBalance, annualExpense, annualReturn, years }: { startingBalance: number; annualExpense: number; annualReturn: number; years: number }): DrawdownResult {
  let balance = clampMoney(startingBalance)
  const withdrawal = clampMoney(annualExpense)
  const points: DrawdownPoint[] = []
  let depletedYear: number | null = null

  for (let year = 1; year <= years; year += 1) {
    const startBalance = balance
    balance -= withdrawal
    const growth = Math.max(0, balance) * annualReturn
    balance += growth
    const endBalance = Math.max(0, balance)
    points.push({ year, startBalance, withdrawal, growth, endBalance })

    if (balance <= 0 && depletedYear === null) {
      depletedYear = year
      balance = 0
      break
    }
  }

  return { success: depletedYear === null, depletedYear, points }
}

function calculateAnnualPensionIncome(pensions: PensionCashflow[], age: number): number {
  return pensions
    .filter((pension) => pension.startAge <= age && (pension.endAge === undefined || pension.endAge >= age))
    .reduce((sum, pension) => sum + clampMoney(pension.monthlyAmount) * 12 * Math.max(0, Math.min(1, pension.reliability)), 0)
}

export function calculateRetirementReadiness({
  currentAge,
  retirementAge,
  retirementYears,
  monthlyRetirementExpense,
  annualReturn,
  assets,
  pensions,
}: {
  currentAge: number
  retirementAge: number
  retirementYears: number
  monthlyRetirementExpense: number
  annualReturn: number
  assets: Asset[]
  pensions: PensionCashflow[]
}): RetirementReadinessResult {
  const startAge = Math.max(currentAge, retirementAge)
  const unlocked = calculateUnlockedFiAssets({ assets, currentAge: startAge })
  let balance = unlocked.unlockedFiAssets
  const lockedByAge = new Map<number, number>()
  assets
    .filter((asset) => asset.includeForFi && asset.availableAge !== undefined && asset.availableAge > startAge)
    .forEach((asset) => lockedByAge.set(asset.availableAge!, (lockedByAge.get(asset.availableAge!) ?? 0) + clampMoney(asset.value)))

  const points: RetirementReadinessPoint[] = []
  let depletedAge: number | null = null

  for (let offset = 0; offset < retirementYears; offset += 1) {
    const age = startAge + offset
    const startBalance = balance
    const unlockedFromAssets = lockedByAge.get(age) ?? 0
    balance += unlockedFromAssets
    const annualExpense = clampMoney(monthlyRetirementExpense) * 12
    const pensionIncome = calculateAnnualPensionIncome(pensions, age)
    const withdrawal = Math.max(0, annualExpense - pensionIncome)
    balance -= withdrawal
    const growth = Math.max(0, balance) * annualReturn
    balance += growth
    const endBalance = Math.max(0, balance)
    points.push({ age, startBalance, pensionIncome, withdrawal, unlockedFromAssets, growth, endBalance })

    if (balance <= 0) {
      depletedAge = age
      balance = 0
      break
    }
  }

  return {
    success: depletedAge === null,
    depletedAge,
    unlockedAtRetirement: unlocked.unlockedFiAssets,
    lockedAtRetirement: unlocked.lockedFiAssets,
    points,
  }
}

export function getSensitivityMatrix(input: SimulationInput): SensitivityCase[] {
  const scenarios = [
    { label: '기본', description: '현재 입력값 유지', returnDelta: 0, expenseFactor: 1, savingFactor: 1 },
    { label: '수익률 +1%p', description: '연 수익률 1%p 상승', returnDelta: 0.01, expenseFactor: 1, savingFactor: 1 },
    { label: '수익률 -1%p', description: '연 수익률 1%p 하락', returnDelta: -0.01, expenseFactor: 1, savingFactor: 1 },
    { label: '지출 -10%', description: '은퇴 후 월 생활비 10% 절감', returnDelta: 0, expenseFactor: 0.9, savingFactor: 1 },
    { label: '지출 +10%', description: '은퇴 후 월 생활비 10% 증가', returnDelta: 0, expenseFactor: 1.1, savingFactor: 1 },
    { label: '저축 +20%', description: '월 저축 가능액 20% 증가', returnDelta: 0, expenseFactor: 1, savingFactor: 1.2 },
    { label: '저축 -20%', description: '월 저축 가능액 20% 감소', returnDelta: 0, expenseFactor: 1, savingFactor: 0.8 },
  ]

  return scenarios.map((scenario) => {
    const fiNumber = calculateFiNumber(input.monthlyRetirementExpense * scenario.expenseFactor, input.safeWithdrawalRate)
    const yearsToFi = calculateYearsToFi({
      currentFiAssets: input.currentFiAssets,
      annualContribution: input.monthlyContribution * 12 * scenario.savingFactor,
      annualReturn: input.annualReturn + scenario.returnDelta,
      fiNumber,
    })

    return {
      label: scenario.label,
      description: scenario.description,
      fiNumber,
      yearsToFi,
      retirementYear: yearsToFi === null ? null : input.startYear + yearsToFi,
    }
  })
}
