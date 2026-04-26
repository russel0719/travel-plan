import { NextRequest, NextResponse } from 'next/server'

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const MODEL = 'meta/llama-3.3-70b-instruct'

export async function POST(req: NextRequest) {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'NVIDIA_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const { tripTitle, destination, startDate, endDate, scheduleSummary, userNotes } = await req.json()

  const prompt = `당신은 따뜻하고 감성적인 여행 작가입니다. 아래 여행 정보를 바탕으로 개인적이고 생생한 여행 후기를 작성해주세요.

## 여행 정보
- 제목: ${tripTitle}
- 목적지: ${destination}
- 기간: ${startDate} ~ ${endDate}

## 일정 요약
${scheduleSummary}

## 여행자의 메모
${userNotes || '(메모 없음)'}

## 작성 지침
- 1,000~1,500자 분량으로 작성하세요
- 마크다운 형식으로 작성하세요
- 다음 구조로 작성하세요:
  1. ## 여행 소감 (전반적인 감상 2-3문단)
  2. ## 날짜별 하이라이트 (각 날짜의 특별한 순간)
  3. ## 추천 & 팁 (다음 여행자를 위한 팁)
  4. ## 마무리 (여행을 마치며 한 문단)
- 개인적인 감정과 경험을 생생하게 표현하세요
- 반드시 한국어로 작성하세요`

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
    const aiText = data.choices?.[0]?.message?.content ?? ''
    return NextResponse.json({ aiText })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
