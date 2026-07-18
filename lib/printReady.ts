// 인쇄 준비 상태를 "타이머"가 아니라 "게이트"로 만든다.
//
// 예전에는 데이터가 들어온 뒤 600ms를 세고 window.print()를 불렀는데, 그건 하이드레이션 →
// 경로 조회 → 이미지 디코딩으로 이어지는 비동기 사슬 위에 얹은 추측값이라 지도가 들어가면
// 확실히 깨진다(인쇄 다이얼로그가 뜬 뒤에 지도가 도착한다).

const ASSET_TIMEOUT_MS = 8000

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

/** 폰트와 이미지가 모두 확정된 뒤에 resolve. 실패한 자원 때문에 영영 막히지 않는다. */
export async function waitForAssets(): Promise<void> {
  // 폰트가 늦게 바뀌면 인쇄 다이얼로그가 뜬 뒤 리플로우가 일어나 페이지 나눔이 틀어진다
  try {
    await document.fonts.ready
  } catch {
    // 지원하지 않는 브라우저 — 무시
  }

  await Promise.race([
    Promise.allSettled(
      Array.from(document.images).map((img) =>
        // decode()는 onload보다 강한 보장이다(디코딩까지 끝난다).
        // 실패는 삼킨다 — 깨진 이미지 하나가 인쇄를 영구히 막으면 안 된다.
        img.complete && img.naturalWidth > 0 ? Promise.resolve() : img.decode().catch(() => {})
      )
    ),
    // 지도가 매달려도 인쇄는 되어야 한다
    delay(ASSET_TIMEOUT_MS),
  ])

  await nextFrame()
}

/** Chrome은 PDF 기본 파일명으로 document.title을 쓴다. 파일명에 못 쓰는 문자를 걷어낸다. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim() || '여행일정'
}
