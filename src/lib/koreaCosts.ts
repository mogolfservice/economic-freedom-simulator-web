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

export function calculateKoreaCostAdjustment(assumptions: KoreaCostAssumptions, language: 'ko' | 'en' | 'ja' = 'ko', formatMoney: (value: number) => string = formatWon): KoreaCostResult {
  const notes: string[] = []
  let monthlyExtraCost = 0

  if (assumptions.includeHealthInsurance) {
    const healthInsurance = clampMoney(assumptions.healthInsuranceMonthlyEstimate)
    monthlyExtraCost += healthInsurance
    if (healthInsurance > 0) notes.push(language === 'en' ? `Monthly health insurance estimate ${formatMoney(healthInsurance)} included` : language === 'ja' ? `健康保険料の月額推定 ${formatMoney(healthInsurance)} を反映` : `건강보험료 월 추정치 ${formatMoney(healthInsurance)} 반영`)
  }

  if (assumptions.includeInvestmentTax) {
    const rate = clampRate(assumptions.investmentTaxRate)
    const monthlyTax = clampMoney(assumptions.taxableInvestmentMonthlyIncome) * rate
    monthlyExtraCost += monthlyTax
    notes.push(language === 'en' ? `Investment income tax adjustment ${formatPercent(rate)} included` : language === 'ja' ? `投資所得税補正 ${formatPercent(rate)} を反映` : `투자소득 세금 보정 ${formatPercent(rate)} 반영`)
  }

  if (assumptions.includeRentalTax) {
    const rate = clampRate(assumptions.rentalTaxRate)
    const monthlyTax = clampMoney(assumptions.rentalMonthlyIncome) * rate
    monthlyExtraCost += monthlyTax
    notes.push(language === 'en' ? `Rental income tax adjustment ${formatPercent(rate)} included` : language === 'ja' ? `賃貸所得税補正 ${formatPercent(rate)} を反映` : `임대소득 세금 보정 ${formatPercent(rate)} 반영`)
  }

  const roundedMonthlyCost = Math.round(monthlyExtraCost)
  return {
    monthlyExtraCost: roundedMonthlyCost,
    annualExtraCost: roundedMonthlyCost * 12,
    notes: notes.length > 0 ? notes : [language === 'en' ? 'Tax/health insurance adjustment is off.' : language === 'ja' ? '税金/健康保険料の補正はオフです。' : '세금/건강보험료 보정이 꺼져 있습니다.'],
  }
}
