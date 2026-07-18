'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PrintOptions, loadSavedOptions, saveOptions } from '@/lib/printOptions'

interface PrintOptionsDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (options: PrintOptions) => void
}

const MAPS_ENABLED = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

const ROWS: { key: keyof PrintOptions; label: string; hint?: string }[] = [
  { key: 'map', label: '동선 지도', hint: '날짜별 지도를 넣습니다' },
  { key: 'travel', label: '항공 · 숙박' },
  { key: 'budget', label: '예산 요약' },
  { key: 'notes', label: '메모' },
  { key: 'perDayPage', label: '하루를 한 페이지에', hint: '날짜마다 새 페이지에서 시작' },
]

export default function PrintOptionsDialog({ open, onClose, onConfirm }: PrintOptionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/* 폼을 열릴 때만 마운트한다 — 그래야 useState 초기화가 매번 다시 돌면서 마지막 선택을
          읽어온다. effect로 동기화하면 렌더가 연쇄된다. */}
      {open && <OptionsForm onClose={onClose} onConfirm={onConfirm} />}
    </Dialog>
  )
}

function OptionsForm({ onClose, onConfirm }: Omit<PrintOptionsDialogProps, 'open'>) {
  const [options, setOptions] = useState<PrintOptions>(loadSavedOptions)

  const toggle = (key: keyof PrintOptions) => setOptions((prev) => ({ ...prev, [key]: !prev[key] }))

  const confirm = () => {
    const next = { ...options, map: options.map && MAPS_ENABLED }
    saveOptions(next)
    onConfirm(next)
  }

  return (
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>PDF에 포함할 내용</DialogTitle>
        </DialogHeader>
        <div className="pt-1">
          {ROWS.map((row) => {
            const disabled = row.key === 'map' && !MAPS_ENABLED
            return (
              <label
                key={row.key}
                className="flex items-center gap-3 py-3 text-sm has-disabled:opacity-50"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-primary"
                  checked={!!options[row.key] && !disabled}
                  disabled={disabled}
                  onChange={() => toggle(row.key)}
                />
                <span className="min-w-0 flex-1">
                  {row.label}
                  {(row.hint || disabled) && (
                    <span className="block text-xs text-muted-foreground">
                      {disabled ? '지도 API 키가 없어 사용할 수 없습니다' : row.hint}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button size="sm" onClick={confirm}>
            PDF 만들기
          </Button>
        </div>
      </DialogContent>
  )
}
