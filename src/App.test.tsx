// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  localStorage.clear()

})

afterEach(() => {
  cleanup()

})

describe('EconomicFreedomSimulator app', () => {
  it('renders Korean FIRE dashboard with comma-formatted KRW defaults', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '경제적자유시뮬레이터' })).toBeInTheDocument()
    expect(screen.getByText('3년 뒤')).toBeInTheDocument()
    expect(screen.getByText('2029년')).toBeInTheDocument()
    expect(screen.getAllByText('₩1,131,428,571').length).toBeGreaterThan(0)
    expect(screen.getByText('44.2%')).toBeInTheDocument()
    expect(screen.getByText('민감도 분석')).toBeInTheDocument()
    expect(screen.getByText('연금·잠긴자산 반영 58년 통과')).toBeInTheDocument()
    expect(screen.getByText(/75~100세: 월 현금흐름/)).toBeInTheDocument()
    expect(screen.getByLabelText('월 소득')).toHaveValue('8,000,000')
    expect(screen.getByLabelText('은퇴 후 월 생활비')).toHaveValue('2,770,000')
    expect(within(screen.getByTestId('living-expense-list')).getAllByLabelText('필요생활비')[0]).toHaveValue('3,300,000')
  })

  it('updates the FI result when comma-formatted monthly retirement expense is reduced', async () => {
    const user = userEvent.setup()
    render(<App />)

    const expenseInput = within(screen.getByTestId('living-expense-list')).getAllByLabelText('필요생활비')[0]
    await user.clear(expenseInput)
    await user.type(expenseInput, '3,000,000')

    expect(expenseInput).toHaveValue('3,000,000')
    expect(screen.getByText('3년 뒤')).toBeInTheDocument()
    expect(screen.getByText('2029년')).toBeInTheDocument()
    expect(screen.getAllByText('₩1,028,571,429').length).toBeGreaterThan(0)
  })

  it('shows retirement is possible now when cashflows cover expenses even without savings or assets', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.clear(screen.getByLabelText('월 저축 가능액'))
    await user.type(screen.getByLabelText('월 저축 가능액'), '0')

    const assetsPanel = screen.getByTestId('asset-list')
    const assetValueInputs = within(assetsPanel).getAllByLabelText('평가액')
    for (const assetInput of assetValueInputs.slice(0, 3)) {
      await user.clear(assetInput)
      await user.type(assetInput, '0')
    }

    await user.clear(screen.getByLabelText('수령 시작 나이'))
    await user.type(screen.getByLabelText('수령 시작 나이'), '40')
    await user.clear(screen.getByLabelText('국민연금 월 수령액'))
    await user.type(screen.getByLabelText('국민연금 월 수령액'), '4,000,000')

    expect(screen.getByText('지금 가능')).toBeInTheDocument()
    expect(screen.getByText('2026년')).toBeInTheDocument()
    expect(screen.getAllByText('₩4,000,000').length).toBeGreaterThan(0)
  })



  it('can edit, add, and delete age-based living expense bands', async () => {
    const user = userEvent.setup()
    render(<App />)

    const expensePanel = screen.getByTestId('living-expense-list')
    expect(within(expensePanel).getAllByLabelText('구분명')).toHaveLength(3)
    expect(within(expensePanel).getByDisplayValue('초기')).toBeInTheDocument()
    expect(within(expensePanel).getAllByLabelText('필요생활비')[0]).toHaveValue('3,300,000')

    await user.click(screen.getByRole('button', { name: '생활비 구간 추가' }))
    expect(within(screen.getByTestId('living-expense-list')).getAllByLabelText('구분명')).toHaveLength(4)

    await user.click(within(screen.getByTestId('living-expense-list')).getAllByRole('button', { name: '삭제' }).at(-1)!)
    expect(within(screen.getByTestId('living-expense-list')).getAllByLabelText('구분명')).toHaveLength(3)
  })

  it('switches language and currency for labels and money formatting', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(screen.getByLabelText('언어'), 'en')
    expect(screen.getByRole('heading', { name: 'Financial Freedom Simulator' })).toBeInTheDocument()
    expect(screen.getByText('Sensitivity Analysis')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Currency'), 'USD')
    expect(screen.getAllByText('$1,131,428,571').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Monthly income')).toHaveValue('8,000,000')
  })

  it('can add an asset, include it in FI assets, and persist scenario locally', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '자산 추가' }))
    const assetsPanel = screen.getByTestId('asset-list')
    const assetNameInputs = within(assetsPanel).getAllByLabelText('자산명')
    await user.clear(assetNameInputs.at(-1)!)
    await user.type(assetNameInputs.at(-1)!, '추가 ETF')
    const assetValueInputs = within(assetsPanel).getAllByLabelText('평가액')
    await user.clear(assetValueInputs.at(-1)!)
    await user.type(assetValueInputs.at(-1)!, '100,000,000')

    expect(screen.getByText('53%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '현재 시나리오 저장' }))
    expect(JSON.parse(localStorage.getItem('efs-scenarios') ?? '[]')).toHaveLength(1)
    expect(screen.getByText('저장된 시나리오')).toBeInTheDocument()
  })

  it('loads legacy saved scenarios that do not have age-based living expense bands', async () => {
    const user = userEvent.setup()
    localStorage.setItem('efs-scenarios', JSON.stringify([
      {
        id: 'legacy-scenario',
        savedAt: 'legacy',
        yearsToFi: 8,
        retirementYear: 2034,
        fiNumber: 900_000_000,
        progress: 0.5,
        state: {
          currentAge: 45,
          monthlyIncome: 1_234_567,
          monthlyContribution: 1_000_000,
          monthlyRetirementExpense: 2_000_000,
          nominalReturn: 0.05,
          inflationRate: 0.02,
          safeWithdrawalRate: 0.035,
          retirementYears: 50,
          assets: [{ id: 'legacy-cash', name: '기존 현금', type: 'cash', value: 300_000_000, liquidity: 'high', includeForFi: true }],
        },
      },
    ]))

    render(<App />)

    const savedPanel = screen.getByText('저장된 시나리오').closest('.saved-panel') as HTMLElement
    await user.click(within(savedPanel).getByRole('button', { name: /8년 뒤/ }))

    expect(screen.getByLabelText('월 소득')).toHaveValue('1,234,567')
    expect(within(screen.getByTestId('living-expense-list')).getAllByLabelText('구분명')).toHaveLength(3)
    expect(within(screen.getByTestId('asset-list')).getByDisplayValue('기존 현금')).toBeInTheDocument()
  })

  it('can delete assets and cashflows, and add a new debt row', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(within(screen.getByTestId('asset-list')).getAllByLabelText('자산명')).toHaveLength(4)
    await user.click(within(screen.getByTestId('asset-list')).getAllByRole('button', { name: '삭제' })[0])
    expect(within(screen.getByTestId('asset-list')).getAllByLabelText('자산명')).toHaveLength(3)
    expect(screen.queryByDisplayValue('현금/예금')).not.toBeInTheDocument()

    expect(within(screen.getByTestId('cashflow-list')).getAllByLabelText('소득명')).toHaveLength(1)
    await user.click(within(screen.getByTestId('cashflow-list')).getAllByRole('button', { name: '삭제' })[0])
    expect(within(screen.getByTestId('cashflow-list')).queryAllByLabelText('소득명')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: '대출 추가' }))
    const liabilitiesPanel = screen.getByTestId('liability-list')
    expect(within(liabilitiesPanel).getAllByLabelText('대출명')).toHaveLength(2)
    expect(within(liabilitiesPanel).getByDisplayValue('새 대출')).toBeInTheDocument()
  })

  it('can delete a saved scenario from the saved list and localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '현재 시나리오 저장' }))
    expect(JSON.parse(localStorage.getItem('efs-scenarios') ?? '[]')).toHaveLength(1)

    await user.click(within(screen.getByText('저장된 시나리오').closest('.saved-panel') as HTMLElement).getByRole('button', { name: '삭제' }))

    expect(JSON.parse(localStorage.getItem('efs-scenarios') ?? '[]')).toHaveLength(0)
    expect(within(screen.getByText('저장된 시나리오').closest('.saved-panel') as HTMLElement).queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
    expect(screen.getByText('아직 저장된 시나리오가 없습니다. 현재 시나리오 저장 버튼으로 최대 6개까지 비교할 수 있습니다.')).toBeInTheDocument()
  })

  it('models pension cashflow and assets locked until age 55', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText('은퇴 후 소득/현금흐름')).toBeInTheDocument()
    expect(screen.getByText('55세 이후 사용가능 자산')).toBeInTheDocument()
    expect(screen.getByText('잠긴 FI 자산 ₩80,000,000')).toBeInTheDocument()
    expect(screen.getByText('국민연금')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('국민연금 월 수령액'))
    await user.type(screen.getByLabelText('국민연금 월 수령액'), '1,500,000')

    expect(screen.getByText('총 월 소득')).toBeInTheDocument()
    expect(screen.getByText('₩1,500,000')).toBeInTheDocument()
    expect(screen.getByText('월 부족액')).toBeInTheDocument()
    expect(screen.getByText('₩1,800,000')).toBeInTheDocument()
  })

  it('can add multiple retirement income cashflows including rental income with an end age', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '소득 추가' }))
    expect(screen.getAllByText('월세/임대소득').length).toBeGreaterThan(0)

    const cashflowPanel = screen.getByTestId('cashflow-list')
    const incomeNameInputs = within(cashflowPanel).getAllByLabelText('소득명')
    await user.clear(incomeNameInputs.at(-1)!)
    await user.type(incomeNameInputs.at(-1)!, '오피스텔 월세')

    const incomeAmountInputs = within(cashflowPanel).getAllByLabelText(/월 수령액/)
    await user.clear(incomeAmountInputs.at(-1)!)
    await user.type(incomeAmountInputs.at(-1)!, '800,000')

    const endAgeInputs = within(cashflowPanel).getAllByLabelText('종료 나이')
    await user.type(endAgeInputs.at(-1)!, '75')

    expect(screen.getByText('오피스텔 월세')).toBeInTheDocument()
    expect(within(cashflowPanel).getAllByDisplayValue('75').length).toBeGreaterThan(0)
    expect(screen.getAllByText('₩2,000,000').length).toBeGreaterThanOrEqual(1)
  })

  it('can add child expense with support age, university cost, and lump-sum event', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText('자녀/부양가족 비용')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '자녀 추가' }))

    const childrenPanel = screen.getByTestId('children-list')
    const childNameInputs = within(childrenPanel).getAllByLabelText('자녀명')
    await user.clear(childNameInputs.at(-1)!)
    await user.type(childNameInputs.at(-1)!, '첫째')

    await user.clear(within(childrenPanel).getAllByLabelText('현재 자녀 나이').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('현재 자녀 나이').at(-1)!, '8')
    await user.clear(within(childrenPanel).getAllByLabelText('월 양육비').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('월 양육비').at(-1)!, '700,000')
    await user.clear(within(childrenPanel).getAllByLabelText('월 교육비').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('월 교육비').at(-1)!, '500,000')
    await user.clear(within(childrenPanel).getAllByLabelText('지원 종료 나이').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('지원 종료 나이').at(-1)!, '24')
    await user.clear(within(childrenPanel).getAllByLabelText('대학 연간비').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('대학 연간비').at(-1)!, '15,000,000')
    await user.clear(within(childrenPanel).getAllByLabelText('일시금 나이').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('일시금 나이').at(-1)!, '30')
    await user.clear(within(childrenPanel).getAllByLabelText('일시금 금액').at(-1)!)
    await user.type(within(childrenPanel).getAllByLabelText('일시금 금액').at(-1)!, '50,000,000')

    expect(screen.getByText('첫째')).toBeInTheDocument()
    expect(screen.getByText('현재 연간 자녀비')).toBeInTheDocument()
    expect(screen.getByText('₩14,400,000')).toBeInTheDocument()
    expect(screen.getByText('대학 연간비 합계')).toBeInTheDocument()
    expect(screen.getByText('₩15,000,000')).toBeInTheDocument()
  })

  it('shows decision-grade insights, scenario comparison, Korea costs, and report copy', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
    render(<App />)

    expect(screen.getByText('결과 해석')).toBeInTheDocument()
    expect(screen.getByText('현재 사용가능 FI 자산은 목표의 44.2%입니다.')).toBeInTheDocument()
    expect(screen.getByText('43~64세: 월 현금흐름 ₩0, 월 필요지출 ₩3,300,000, 월 부족액 ₩3,300,000입니다. 부족분은 자산에서 인출합니다. 구간 자산 변화는 -₩367,614,492, 구간말 자산은 ₩307,195,108입니다.')).toBeInTheDocument()
    expect(screen.getByText('65~74세: 월 현금흐름 ₩1,200,000, 월 필요지출 ₩2,770,000, 월 부족액 ₩1,570,000입니다. 부족분은 자산에서 인출합니다. 구간 자산 변화는 -₩87,714,166, 구간말 자산은 ₩219,480,942입니다.')).toBeInTheDocument()
    expect(screen.getByText('시나리오 비교')).toBeInTheDocument()
    expect(screen.getByText('보수')).toBeInTheDocument()
    expect(screen.getByText('낙관')).toBeInTheDocument()
    expect(screen.getByText('한국형 비용 보정')).toBeInTheDocument()

    await user.click(screen.getByLabelText('건강보험료 반영'))
    await user.clear(screen.getByLabelText('건강보험료 월 추정치'))
    await user.type(screen.getByLabelText('건강보험료 월 추정치'), '350,000')

    expect(screen.getByText('월 추가 비용')).toBeInTheDocument()
    expect(screen.getAllByText('₩350,000').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Markdown 리포트 복사' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('# 한국형 경제적 자유 시뮬레이터 리포트'))
    expect(screen.getByText('리포트를 클립보드에 복사했습니다.')).toBeInTheDocument()
  })


  it('persists selected language and currency in localStorage and restores them on reload', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)

    await user.selectOptions(screen.getByLabelText('언어'), 'en')
    await user.selectOptions(screen.getByLabelText('Currency'), 'USD')

    expect(JSON.parse(localStorage.getItem('efs-preferences') ?? '{}')).toMatchObject({ language: 'en', currency: 'USD' })

    unmount()
    render(<App />)

    expect(screen.getByLabelText('Language')).toHaveValue('en')
    expect(screen.getByLabelText('Currency')).toHaveValue('USD')
    expect(screen.getByRole('heading', { name: 'Financial Freedom Simulator' })).toBeInTheDocument()
    expect(screen.getByText('Result interpretation')).toBeInTheDocument()
    expect(screen.getByText('Scenario comparison')).toBeInTheDocument()
    expect(screen.getByText('Korea cost adjustment')).toBeInTheDocument()
    expect(screen.getByText('Debt payoff bridge')).toBeInTheDocument()
    expect(screen.getByText('Retirement income/cashflows')).toBeInTheDocument()
    expect(screen.getByText('Children/dependent expenses')).toBeInTheDocument()
    expect(screen.getAllByText('$1,131,428,571').length).toBeGreaterThan(0)
  })

})

