import {
  calculateFiNumber,
  calculateRetirementReadiness,
  calculateYearsToRetirementReadiness,
  scaleLivingExpenseBands,
  type Asset,
  type ChildExpense,
  type Liability,
  type LivingExpenseBand,
  type PensionCashflow,
} from './finance'

export type DecisionScenarioInput = {
  currentAge: number
  monthlyContribution: number
  monthlyRetirementExpense: number
  livingExpenseBands?: LivingExpenseBand[]
  annualReturn: number
  safeWithdrawalRate: number
  startYear: number
  retirementYears: number
  assets: Asset[]
  pensions: PensionCashflow[]
  children?: ChildExpense[]
  liabilities?: Liability[]
}

export type DecisionScenario = {
  label: '기본' | '보수' | '낙관' | '조기퇴사'
  description: string
  monthlyContribution: number
  monthlyRetirementExpense: number
  livingExpenseBands?: LivingExpenseBand[]
  annualReturn: number
  fiNumber: number
  yearsToFi: number | null
  retirementYear: number | null
  depletedAge: number | null
  risk: 'low' | 'medium' | 'high'
}

const clonePensions = (pensions: PensionCashflow[], reliabilityFactor: number) => pensions.map((pension) => ({
  ...pension,
  reliability: Math.max(0, Math.min(1, pension.reliability * reliabilityFactor)),
}))

function riskFrom(yearsToFi: number | null, depletedAge: number | null): DecisionScenario['risk'] {
  if (yearsToFi === null || depletedAge !== null) return 'high'
  if (yearsToFi > 15) return 'medium'
  return 'low'
}

export function createDecisionScenarios(input: DecisionScenarioInput): DecisionScenario[] {
  const definitions = [
    { label: '기본' as const, description: '현재 입력값 유지', returnDelta: 0, expenseFactor: 1, savingFactor: 1, reliabilityFactor: 1 },
    { label: '보수' as const, description: '수익률 -1%p, 지출 +10%, 연금 반영률 -20%', returnDelta: -0.01, expenseFactor: 1.1, savingFactor: 1, reliabilityFactor: 0.8 },
    { label: '낙관' as const, description: '수익률 +1%p, 저축 +10%, 지출 -5%', returnDelta: 0.01, expenseFactor: 0.95, savingFactor: 1.1, reliabilityFactor: 1 },
    { label: '조기퇴사' as const, description: '1년 뒤 퇴사 가정, 추가 저축 없음', returnDelta: 0, expenseFactor: 1, savingFactor: 0, reliabilityFactor: 1 },
  ]

  return definitions.map((definition) => {
    const monthlyContribution = Math.round(input.monthlyContribution * definition.savingFactor)
    const monthlyRetirementExpense = Math.round(input.monthlyRetirementExpense * definition.expenseFactor)
    const livingExpenseBands = scaleLivingExpenseBands(input.livingExpenseBands, definition.expenseFactor)
    const annualReturn = input.annualReturn + definition.returnDelta
    const pensions = clonePensions(input.pensions, definition.reliabilityFactor)
    const fiNumber = calculateFiNumber(monthlyRetirementExpense, input.safeWithdrawalRate)
    const forcedQuitYears = definition.label === '조기퇴사' ? 1 : undefined
    const yearsToFi = forcedQuitYears ?? calculateYearsToRetirementReadiness({
      currentAge: input.currentAge,
      monthlyContribution,
      monthlyRetirementExpense,
      livingExpenseBands,
      annualReturn,
      retirementYears: input.retirementYears,
      assets: input.assets,
      pensions,
      children: input.children ?? [],
      liabilities: input.liabilities ?? [],
    })
    const retirementAge = input.currentAge + (yearsToFi ?? 0)
    const readiness = calculateRetirementReadiness({
      currentAge: input.currentAge,
      retirementAge,
      retirementYears: input.retirementYears,
      monthlyRetirementExpense,
      livingExpenseBands,
      annualReturn,
      assets: input.assets,
      pensions,
      children: input.children ?? [],
      liabilities: input.liabilities ?? [],
    })

    return {
      label: definition.label,
      description: definition.description,
      monthlyContribution,
      monthlyRetirementExpense,
      annualReturn,
      fiNumber,
      yearsToFi,
      retirementYear: yearsToFi === null ? null : input.startYear + yearsToFi,
      depletedAge: readiness.depletedAge,
      risk: riskFrom(yearsToFi, readiness.depletedAge),
    }
  })
}

