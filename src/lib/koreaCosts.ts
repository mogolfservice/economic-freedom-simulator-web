export type KoreaCostAssumptions = {
  includeHealthInsurance: boolean
  healthInsuranceMonthlyEstimate: number
  includeInvestmentTax: boolean
  taxableInvestmentMonthlyIncome?: number
  investmentTaxRate: number
  includeRentalTax: boolean
  rentalMonthlyIncome?: number
  rentalTaxRate: number
}

export type KoreaCostResult = {
  monthlyExtraCost: number
  annualExtraCost: number
  notes: string[]
}

const clampMoney = (value: number | undefined) => (Number.isFinite(value) ? Math.max(0, value ?? 0) : 0)
const clampRate = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0)
const formatWon = (value: number) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(Math.round(value))
const formatPercent = (value: number) => `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value * 100)}%`

export function calculateKoreaCostAdjustment(assumptions: KoreaCostAssumptions): KoreaCostResult {
  const notes: string[] = []
  let monthlyExtraCost = 0

  if (assumptions.includeHealthInsurance) {
    const healthInsurance = clampMoney(assumptions.healthInsuranceMonthlyEstimate)
    monthlyExtraCost += healthInsurance
    if (healthInsurance > 0) notes.push(`건강보험료 월 추정치 ${formatWon(healthInsurance)} 반영`)
  }

  if (assumptions.includeInvestmentTax) {
    const rate = clampRate(assumptions.investmentTaxRate)
    const monthlyTax = clampMoney(assumptions.taxableInvestmentMonthlyIncome) * rate
    monthlyExtraCost += monthlyTax
    notes.push(`투자소득 세금 보정 ${formatPercent(rate)} 반영`)
  }

  if (assumptions.includeRentalTax) {
    const rate = clampRate(assumptions.rentalTaxRate)
    const monthlyTax = clampMoney(assumptions.rentalMonthlyIncome) * rate
    monthlyExtraCost += monthlyTax
    notes.push(`임대소득 세금 보정 ${formatPercent(rate)} 반영`)
  }

  const roundedMonthlyCost = Math.round(monthlyExtraCost)
  return {
    monthlyExtraCost: roundedMonthlyCost,
    annualExtraCost: roundedMonthlyCost * 12,
    notes: notes.length > 0 ? notes : ['세금/건강보험료 보정이 꺼져 있습니다.'],
  }
}
