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
}

export function generateMarkdownReport(input: MarkdownReportInput): string {
  const timing = input.summary.yearsToFi === null
    ? '조건 조정 필요'
    : input.summary.yearsToFi === 0
      ? '지금 가능'
      : `${input.summary.yearsToFi}년 뒤 · ${input.summary.retirementYear}`

  return [
    `# ${input.title}`,
    '',
    `생성일: ${input.generatedAt}`,
    '',
    '## 핵심 결과',
    '',
    '| 항목 | 값 |',
    '|---|---:|',
    `| 은퇴 가능 시점 | ${timing} |`,
    `| 필요 은퇴자산 | ${input.summary.fiNumber} |`,
    `| 현재 달성률 | ${input.summary.progress} |`,
    `| 은퇴 후 월 부족액 | ${input.summary.monthlyShortfall} |`,
    '',
    '## 주요 해석',
    '',
    ...input.insights.map((item) => `- ${item}`),
    '',
    '## 주요 가정',
    '',
    ...input.assumptions.map((item) => `- ${item}`),
    '',
    '## 시나리오 비교',
    '',
    '| 시나리오 | 은퇴 시점 | 리스크 |',
    '|---|---:|---|',
    ...input.scenarios.map((scenario) => `| ${scenario.label} | ${scenario.timing} | ${scenario.risk} |`),
    '',
    '## 유의사항',
    '',
    input.disclaimer,
    '',
  ].join('\n')
}
