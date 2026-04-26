import { NextRequest, NextResponse } from 'next/server'

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const MODEL = 'meta/llama-3.3-70b-instruct'

interface DayContext {
  dayIndex: number
  dateLabel: string
  scheduleItems: string[]
  photoComments: string[]
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'NVIDIA_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const { tripTitle, destination, startDate, endDate, dayContexts } =
    await req.json() as {
      tripTitle: string
      destination: string
      startDate: string
      endDate: string
      dayContexts: DayContext[]
    }

  const daySection = dayContexts
    .map((d) => {
      const comments = d.photoComments.length
        ? d.photoComments.map((c) => `- "${c}"`).join('\n')
        : '- (코멘트 없음)'
      const schedule = d.scheduleItems.length ? d.scheduleItems.join(', ') : '일정 없음'
      return `### ${d.dayIndex + 1}일차 (${d.dateLabel})\n방문 일정: ${schedule}\n사진 코멘트:\n${comments}`
    })
    .join('\n\n')

  const prompt = `당신은 따뜻하고 감성적인 여행 작가입니다. 아래 여행 정보를 바탕으로 후기를 작성하세요.

## 여행 정보
제목: ${tripTitle}
목적지: ${destination}
기간: ${startDate} ~ ${endDate}

## 날짜별 일정 & 사진 코멘트
${daySection}

## 작성 규칙
1. dayTexts: 각 날짜 사진 코멘트를 바탕으로 생생하고 감성적인 보충 설명을 2-3문장씩 작성하세요
2. overallReview: 여행 전체에 대한 따뜻한 총평을 3-4문단으로 작성하세요
3. 반드시 한국어로 작성하세요
4. 다른 텍스트 없이 반드시 아래 JSON 형식으로만 응답하세요

{
  "dayTexts": {
    "0": "1일차 보충 텍스트",
    "1": "2일차 보충 텍스트"
  },
  "overallReview": "전체 여행 총평"
}`

  try {
    const res = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `NVIDIA API 오류: ${errText}` }, { status: res.status })
    }

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content ?? '{}'

    // JSON 파싱 — 모델이 코드블록으로 감쌀 수 있으므로 추출
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    return NextResponse.json({
      dayTexts: parsed.dayTexts ?? {},
      overallReview: parsed.overallReview ?? raw,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
