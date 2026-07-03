import { useMemo, useState } from 'react'
import './App.css'
import {
  calculateFiNumber,
  calculateNetWorth,
  calculateSavingsRate,
  calculateYearsToFi,
  createYearlyProjection,
  getSensitivityMatrix,
  simulateRetirementDrawdown,
  toRealReturn,
  type Asset,
  type Liability,
  type SensitivityCase,
} from './lib/finance'

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

const STORAGE_KEY = 'efs-scenarios'
const START_YEAR = 2026

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
    { id: 'home', name: '거주 부동산', type: 'real_estate', value: 700_000_000, liquidity: 'low', includeForFi: false },
  ],
  liabilities: [
    { id: 'mortgage', name: '주택담보대출', type: 'mortgage', balance: 250_000_000, interestRate: 0.04, monthlyPayment: 1_500_000 },
  ],
}

const moneyFormatter = new Intl.NumberFormat('ko-KR')
const percentFormatter = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 })

function formatWon(value: number): string {
  if (!Number.isFinite(value)) return '-'
  const abs = Math.abs(value)
  if (abs >= 100_000_000) return `${percentFormatter.format(value / 100_000_000)}억 원`
  if (abs >= 10_000) return `${percentFormatter.format(value / 10_000)}만 원`
  return `${moneyFormatter.format(Math.round(value))}원`
}

function formatPercent(value: number): string {
  return `${percentFormatter.format(value * 100)}%`
}

function readSavedScenarios(): SavedScenario[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as SavedScenario[]
  } catch {
    return []
  }
}

function numberValue(value: string): number {
  return Number(value.replace(/,/g, '')) || 0
}

function MiniLineChart({ data, target }: { data: { year: number; balance: number }[]; target: number }) {
  const width = 620
  const height = 210
  const pad = 28
  const max = Math.max(target, ...data.map((item) => item.balance), 1)
  const minYear = data[0]?.year ?? START_YEAR
  const maxYear = data.at(-1)?.year ?? minYear + 1
  const span = Math.max(1, maxYear - minYear)
  const points = data.map((item) => {
    const x = pad + ((item.year - minYear) / span) * (width - pad * 2)
    const y = height - pad - (item.balance / max) * (height - pad * 2)
    return `${x},${y}`
  }).join(' ')
  const targetY = height - pad - (target / max) * (height - pad * 2)

  return (
    <svg className="mini-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="연도별 자산 성장 그래프">
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} className="chart-axis" />
      <line x1={pad} x2={width - pad} y1={targetY} y2={targetY} className="chart-target" />
      <polyline points={points} className="chart-line" />
      {data.map((item) => {
        const x = pad + ((item.year - minYear) / span) * (width - pad * 2)
        const y = height - pad - (item.balance / max) * (height - pad * 2)
        return <circle key={item.year} cx={x} cy={y} r="3.4" className="chart-dot" />
      })}
      <text x={pad} y={height - 6} className="chart-label">{minYear}</text>
      <text x={width - pad - 36} y={height - 6} className="chart-label">{maxYear}</text>
      <text x={width - pad - 98} y={Math.max(14, targetY - 8)} className="chart-label target-label">목표 {formatWon(target)}</text>
    </svg>
  )
}

function MetricCard({ label, value, note, tone = 'default' }: { label: string; value: string; note: string; tone?: 'default' | 'good' | 'warn' }) {
  return (
    <section className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </section>
  )
}

function SensitivityTable({ cases }: { cases: SensitivityCase[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>시나리오</th>
            <th>설명</th>
            <th>필요 자산</th>
            <th>은퇴 시점</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{item.description}</td>
              <td>{formatWon(item.fiNumber)}</td>
              <td>{item.yearsToFi === null ? '도달 어려움' : `${item.yearsToFi}년 뒤 · ${item.retirementYear}년`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function App() {
  const [state, setState] = useState<PlannerState>(defaultState)
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(readSavedScenarios)

  const realReturn = useMemo(() => toRealReturn(state.nominalReturn, state.inflationRate), [state.nominalReturn, state.inflationRate])
  const netWorth = useMemo(() => calculateNetWorth({ assets: state.assets, liabilities: state.liabilities }), [state.assets, state.liabilities])
  const fiNumber = useMemo(() => calculateFiNumber(state.monthlyRetirementExpense, state.safeWithdrawalRate), [state.monthlyRetirementExpense, state.safeWithdrawalRate])
  const yearsToFi = useMemo(() => calculateYearsToFi({ currentFiAssets: netWorth.fiAssets, annualContribution: state.monthlyContribution * 12, annualReturn: realReturn, fiNumber }), [fiNumber, netWorth.fiAssets, realReturn, state.monthlyContribution])
  const retirementYear = yearsToFi === null ? null : START_YEAR + yearsToFi
  const progress = fiNumber > 0 ? netWorth.fiAssets / fiNumber : 1
  const projection = useMemo(() => createYearlyProjection({ currentFiAssets: netWorth.fiAssets, annualContribution: state.monthlyContribution * 12, annualReturn: realReturn, fiNumber, startYear: START_YEAR }), [fiNumber, netWorth.fiAssets, realReturn, state.monthlyContribution])
  const drawdown = useMemo(() => simulateRetirementDrawdown({ startingBalance: Math.max(netWorth.fiAssets, fiNumber), annualExpense: state.monthlyRetirementExpense * 12, annualReturn: realReturn, years: state.retirementYears }), [fiNumber, netWorth.fiAssets, realReturn, state.monthlyRetirementExpense, state.retirementYears])
  const sensitivity = useMemo(() => getSensitivityMatrix({ currentFiAssets: netWorth.fiAssets, monthlyContribution: state.monthlyContribution, monthlyRetirementExpense: state.monthlyRetirementExpense, annualReturn: realReturn, safeWithdrawalRate: state.safeWithdrawalRate, startYear: START_YEAR, retirementYears: state.retirementYears }), [fiNumber, netWorth.fiAssets, realReturn, state.monthlyContribution, state.monthlyRetirementExpense, state.retirementYears, state.safeWithdrawalRate])
  const savingsRate = calculateSavingsRate(state.monthlyIncome, state.monthlyContribution)
  const statusTone = progress >= 1 ? 'good' : yearsToFi !== null && yearsToFi <= 10 ? 'warn' : 'default'

  const updateNumber = (field: keyof PlannerState, value: string, divisor = 1) => {
    setState((current) => ({ ...current, [field]: numberValue(value) / divisor }))
  }

  const updateAsset = (id: string, patch: Partial<Asset>) => {
    setState((current) => ({ ...current, assets: current.assets.map((asset) => asset.id === id ? { ...asset, ...patch } : asset) }))
  }

  const addAsset = () => {
    setState((current) => ({
      ...current,
      assets: [...current.assets, { id: `asset-${Date.now()}`, name: '새 자산', type: 'fund', value: 0, liquidity: 'high', includeForFi: true }],
    }))
  }

  const saveScenario = () => {
    const next: SavedScenario = {
      id: `scenario-${Date.now()}`,
      savedAt: new Date().toLocaleString('ko-KR'),
      yearsToFi,
      retirementYear,
      fiNumber,
      progress,
      state,
    }
    const scenarios = [next, ...savedScenarios].slice(0, 6)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios))
    setSavedScenarios(scenarios)
  }

  return (
    <main className="app-shell">
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Korean FIRE Planner</p>
          <h1>경제적자유시뮬레이터</h1>
          <p className="hero-copy">현재 자산, 월 저축, 은퇴 후 생활비와 기대수익률을 넣으면 은퇴 가능 시점과 목표 자산, 민감도까지 한 화면에서 계산합니다.</p>
        </div>
        <div className="hero-result" aria-label="핵심 결과">
          <span>은퇴 가능 시점</span>
          <strong>{yearsToFi === null ? '도달 어려움' : yearsToFi === 0 ? '지금 가능' : `${yearsToFi}년 뒤`}</strong>
          <em>{retirementYear === null ? '조건 조정 필요' : `${retirementYear}년`}</em>
        </div>
      </header>

      <section className="metrics-grid" aria-label="계산 결과 요약">
        <MetricCard label="필요 은퇴자산" value={formatWon(fiNumber)} note={`월 ${formatWon(state.monthlyRetirementExpense)} · SWR ${formatPercent(state.safeWithdrawalRate)}`} tone={statusTone} />
        <MetricCard label="현재 달성률" value={formatPercent(progress)} note={`FI 계산용 자산 ${formatWon(netWorth.fiAssets)}`} />
        <MetricCard label="월 저축률" value={formatPercent(savingsRate)} note={`월 저축 ${formatWon(state.monthlyContribution)}`} />
        <MetricCard label="은퇴 후 안정성" value={drawdown.success ? '통과' : '주의'} note={drawdown.success ? `${state.retirementYears}년 인출 시뮬레이션 통과` : `${drawdown.depletedYear}년차 고갈 가능`} tone={drawdown.success ? 'good' : 'warn'} />
      </section>

      <div className="workspace">
        <section className="panel input-panel">
          <div className="section-title">
            <p className="eyebrow">Inputs</p>
            <h2>빠른 계산 입력</h2>
          </div>

          <div className="form-grid">
            <label>월 소득
              <input aria-label="월 소득" type="number" value={state.monthlyIncome} onChange={(event) => updateNumber('monthlyIncome', event.target.value)} />
            </label>
            <label>월 저축 가능액
              <input aria-label="월 저축 가능액" type="number" value={state.monthlyContribution} onChange={(event) => updateNumber('monthlyContribution', event.target.value)} />
            </label>
            <label>은퇴 후 월 생활비
              <input aria-label="은퇴 후 월 생활비" type="number" value={state.monthlyRetirementExpense} onChange={(event) => updateNumber('monthlyRetirementExpense', event.target.value)} />
            </label>
            <label>명목 기대수익률 (%)
              <input aria-label="명목 기대수익률" type="number" step="0.1" value={(state.nominalReturn * 100).toFixed(1)} onChange={(event) => updateNumber('nominalReturn', event.target.value, 100)} />
            </label>
            <label>인플레이션 (%)
              <input aria-label="인플레이션" type="number" step="0.1" value={(state.inflationRate * 100).toFixed(1)} onChange={(event) => updateNumber('inflationRate', event.target.value, 100)} />
            </label>
            <label>안전인출률 (%)
              <input aria-label="안전인출률" type="number" step="0.1" value={(state.safeWithdrawalRate * 100).toFixed(1)} onChange={(event) => updateNumber('safeWithdrawalRate', event.target.value, 100)} />
            </label>
          </div>

          <div className="assumption-strip">
            <span>실질수익률 <strong>{formatPercent(realReturn)}</strong></span>
            <span>순자산 <strong>{formatWon(netWorth.netWorth)}</strong></span>
            <span>총부채 <strong>{formatWon(netWorth.totalLiabilities)}</strong></span>
          </div>
        </section>

        <section className="panel chart-panel">
          <div className="section-title row-title">
            <div>
              <p className="eyebrow">Projection</p>
              <h2>자산 성장 경로</h2>
            </div>
            <button type="button" onClick={saveScenario}>현재 시나리오 저장</button>
          </div>
          <MiniLineChart data={projection} target={fiNumber} />
          <p className="chart-note">목표선은 은퇴 후 월 생활비를 안전인출률로 나눈 FI Number입니다. 거주용 부동산처럼 현금흐름화하기 어려운 자산은 기본적으로 제외합니다.</p>
        </section>
      </div>

      <section className="panel assets-panel">
        <div className="section-title row-title">
          <div>
            <p className="eyebrow">Assets</p>
            <h2>자산 입력</h2>
          </div>
          <button type="button" onClick={addAsset}>자산 추가</button>
        </div>
        <div className="asset-list" data-testid="asset-list">
          {state.assets.map((asset) => (
            <article className="asset-row" key={asset.id}>
              <label>자산명
                <input aria-label="자산명" value={asset.name} onChange={(event) => updateAsset(asset.id, { name: event.target.value })} />
              </label>
              <label>평가액
                <input aria-label="평가액" type="number" value={asset.value} onChange={(event) => updateAsset(asset.id, { value: numberValue(event.target.value) })} />
              </label>
              <label className="check-label">
                <input type="checkbox" checked={asset.includeForFi} onChange={(event) => updateAsset(asset.id, { includeForFi: event.target.checked })} />
                은퇴 계산에 포함
              </label>
              <span className={`liquidity ${asset.liquidity}`}>{asset.liquidity === 'high' ? '유동' : asset.liquidity === 'medium' ? '중간' : '비유동'}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">Sensitivity</p>
          <h2>민감도 분석</h2>
        </div>
        <SensitivityTable cases={sensitivity} />
      </section>

      <section className="bottom-grid">
        <div className="panel advice-panel">
          <div className="section-title">
            <p className="eyebrow">Action</p>
            <h2>개선 제안</h2>
          </div>
          <ul>
            <li>지출을 10% 줄이면 은퇴 목표 자산이 {formatWon(fiNumber - calculateFiNumber(state.monthlyRetirementExpense * 0.9, state.safeWithdrawalRate))} 낮아집니다.</li>
            <li>월 저축을 20% 늘린 시나리오는 {sensitivity.find((item) => item.label === '저축 +20%')?.yearsToFi ?? '-'}년 뒤 은퇴 가능으로 계산됩니다.</li>
            <li>명목수익률보다 중요한 값은 물가를 뺀 실질수익률입니다. 현재 실질수익률 가정은 {formatPercent(realReturn)}입니다.</li>
          </ul>
        </div>

        <div className="panel saved-panel">
          <div className="section-title">
            <p className="eyebrow">Saved</p>
            <h2>저장된 시나리오</h2>
          </div>
          {savedScenarios.length === 0 ? (
            <p className="empty-state">아직 저장된 시나리오가 없습니다. 현재 시나리오 저장 버튼으로 최대 6개까지 비교할 수 있습니다.</p>
          ) : (
            <div className="saved-list">
              {savedScenarios.map((scenario) => (
                <button type="button" key={scenario.id} onClick={() => setState(scenario.state)}>
                  <strong>{scenario.yearsToFi === null ? '도달 어려움' : `${scenario.yearsToFi}년 뒤`}</strong>
                  <span>{formatWon(scenario.fiNumber)} · {formatPercent(scenario.progress)}</span>
                  <small>{scenario.savedAt}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="disclaimer">
        이 결과는 입력 가정에 따른 시뮬레이션이며 투자, 세금, 건강보험료, 시장 급락, 개인 상황 변화에 따라 실제 결과는 달라질 수 있습니다. 투자 또는 은퇴 결정을 보장하지 않습니다.
      </footer>
    </main>
  )
}

export default App
