export type MarkdownReportInput = {
  title: string
  generatedAt: string
  summary: {
    yearsToFi: number | null
    retirementYear: number | null
    fiNumber: string
    progress: string
    monthlyShortfall: string
  }
  assumptions: string[]
  insights: string[]
  scenarios: { label: string; timing: string; risk: string }[]
  disclaimer: string
  labels?: Partial<{
    adjustAssumptions: string
    possibleNow: string
    yearsLater: (years: number, retirementYear: number | null) => string
    generatedAt: string
    coreResults: string
    item: string
    value: string
    retirementTiming: string
    fiAssets: string
    progress: string
    monthlyShortfall: string
    insights: string
    assumptions: string
    scenarioComparison: string
    scenario: string
    risk: string
    disclaimer: string
  }>
}

export function generateMarkdownReport(input: MarkdownReportInput): string {
  const labels = {
    adjustAssumptions: '조건 조정 필요', possibleNow: '지금 가능', yearsLater: (years: number, retirementYear: number | null) => `${years}년 뒤 · ${retirementYear}`, generatedAt: '생성일', coreResults: '핵심 결과', item: '항목', value: '값', retirementTiming: '은퇴 가능 시점', fiAssets: '필요 은퇴자산', progress: '현재 달성률', monthlyShortfall: '은퇴 후 월 부족액', insights: '주요 해석', assumptions: '주요 가정', scenarioComparison: '시나리오 비교', scenario: '시나리오', risk: '리스크', disclaimer: '유의사항',
    ...input.labels,
  }
  const timing = input.summary.yearsToFi === null
    ? labels.adjustAssumptions
    : input.summary.yearsToFi === 0
      ? labels.possibleNow
      : labels.yearsLater(input.summary.yearsToFi, input.summary.retirementYear)

  return [
    `# ${input.title}`,
    '',
    `${labels.generatedAt}: ${input.generatedAt}`,
    '',
    `## ${labels.coreResults}`,
    '',
    `| ${labels.item} | ${labels.value} |`,
    '|---|---:|',
    `| ${labels.retirementTiming} | ${timing} |`,
    `| ${labels.fiAssets} | ${input.summary.fiNumber} |`,
    `| ${labels.progress} | ${input.summary.progress} |`,
    `| ${labels.monthlyShortfall} | ${input.summary.monthlyShortfall} |`,
    '',
    `## ${labels.insights}`,
    '',
    ...input.insights.map((item) => `- ${item}`),
    '',
    `## ${labels.assumptions}`,
    '',
    ...input.assumptions.map((item) => `- ${item}`),
    '',
    `## ${labels.scenarioComparison}`,
    '',
    `| ${labels.scenario} | ${labels.retirementTiming} | ${labels.risk} |`,
    '|---|---:|---|',
    ...input.scenarios.map((scenario) => `| ${scenario.label} | ${scenario.timing} | ${scenario.risk} |`),
    '',
    `## ${labels.disclaimer}`,
    '',
    input.disclaimer,
    '',
  ].join('\n')
}
