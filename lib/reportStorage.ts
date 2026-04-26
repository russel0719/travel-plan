import { supabase } from './supabase'

const BUCKET = 'report-photos'

/** Canvas API로 1200px·JPEG 80% 압축 후 Supabase Storage에 업로드 */
export async function compressAndUpload(file: File, storagePath: string): Promise<void> {
  const blob = await compressImage(file, 1200, 0.8)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
}

/** 여러 경로의 signed URL을 한 번에 발급 (1시간 유효) */
export async function getSignedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, 3600)
  if (error) throw error
  return Object.fromEntries((data ?? []).map((item) => [item.path, item.signedUrl]))
}

/** PDF 완료 후 Storage 사진 일괄 삭제 */
export async function deleteReportPhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) console.error('deleteReportPhotos error:', error.message)
}

function compressImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('이미지 압축 실패'))),
        'image/jpeg',
        quality
      )
    }
    img.onerror = reject
    img.src = url
  })
}
