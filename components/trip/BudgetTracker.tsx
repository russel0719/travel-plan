'use client'

import { useState } from 'react'
import { Trip, Budget, BudgetItem, BudgetCategory, BUDGET_CATEGORY_LABELS, BUDGET_CATEGORY_COLORS, ITEM_TYPE_TO_BUDGET } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { generateId } from '@/lib/utils'
import { Plus, Trash2, TrendingUp } from 'lucide-react'

interface BudgetTrackerProps {
  trip: Trip
  onUpdateBudget: (b: Budget) => void
}

const DEFAULT_BUDGET: Budget = {
  localCurrency: 'JPY',
  exchangeRate: 9.5,
  items: [],
}

function toKRW(price: number, currency: string, localCurrency: string, exchangeRate: number) {
  if (currency === 'KRW' || currency === '₩') return price
  if (currency === localCurrency || currency === '¥') return Math.round(price * exchangeRate)
  return price
}

export default function BudgetTracker({ trip, onUpdateBudget }: BudgetTrackerProps) {
  const budget = trip.budget ?? DEFAULT_BUDGET
  const [newCategory, setNewCategory] = useState<BudgetCategory>('etc')
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('')

  const save = (b: Budget) => onUpdateBudget(b)

  const addItem = () => {
    if (!newAmount) return
    save({
      ...budget,
      items: [
        ...budget.items,
        {
          id: generateId(),
          category: newCategory,
          label: newLabel || undefined,
          plannedKRW: Number(newAmount),
        },
      ],
    })
    setNewLabel('')
    setNewAmount('')
  }

  const deleteItem = (id: string) =>
    save({ ...budget, items: budget.items.filter((i) => i.id !== id) })

  // 실제 지출 계산 (일정 아이템 + 항공 + 숙박)
  const actualByCategory: Partial<Record<BudgetCategory, number>> = {}

  for (const day of trip.days) {
    for (const item of day.items) {
      if (!item.price) continue
      const cat = ITEM_TYPE_TO_BUDGET[item.type]
      const krw = toKRW(item.price, item.currency ?? budget.localCurrency, budget.localCurrency, budget.exchangeRate)
      actualByCategory[cat] = (actualByCategory[cat] ?? 0) + krw
    }
  }
  const flightTotal = (trip.flights ?? []).reduce((s, f) => s + (f.priceKRW ?? 0), 0)
  const hotelTotal = (trip.accommodations ?? []).reduce((s, a) => s + (a.priceKRW ?? 0), 0)
  if (flightTotal) actualByCategory['flight'] = (actualByCategory['flight'] ?? 0) + flightTotal
  if (hotelTotal) actualByCategory['hotel'] = (actualByCategory['hotel'] ?? 0) + hotelTotal

  const totalPlanned = budget.items.reduce((s, i) => s + i.plannedKRW, 0)
  const totalActual = Object.values(actualByCategory).reduce((s, v) => s + (v ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* 환율 설정 */}
      <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg">
        <span className="text-xs text-muted-foreground whitespace-nowrap">현지통화</span>
        <Input
          className="h-7 w-16 text-xs"
          value={budget.localCurrency}
          onChange={(e) => save({ ...budget, localCurrency: e.target.value })}
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">1 {budget.localCurrency} =</span>
        <Input
          className="h-7 w-20 text-xs"
          type="number"
          step="0.1"
          value={budget.exchangeRate}
          onChange={(e) => save({ ...budget, exchangeRate: Number(e.target.value) })}
        />
        <span className="text-xs text-muted-foreground">₩</span>
      </div>

      {/* 총합 요약 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border p-3 bg-blue-50">
          <p className="text-xs text-muted-foreground">예산 합계</p>
          <p className="text-lg font-bold text-blue-700">₩{totalPlanned.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border p-3 bg-emerald-50">
          <p className="text-xs text-muted-foreground">실지출 합계</p>
          <p className="text-lg font-bold text-emerald-700">₩{totalActual.toLocaleString()}</p>
        </div>
      </div>

      {/* 카테고리별 */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" />카테고리별 예산
        </h4>

        {budget.items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
            예산 항목을 추가하세요
          </p>
        )}

        {budget.items.map((item) => {
          const actual = actualByCategory[item.category] ?? 0
          const ratio = item.plannedKRW > 0 ? Math.min(actual / item.plannedKRW, 1) : 0
          const over = actual > item.plannedKRW && item.plannedKRW > 0
          const color = BUDGET_CATEGORY_COLORS[item.category]
          return (
            <div key={item.id} className="rounded-lg border p-3 group">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm">{item.label || BUDGET_CATEGORY_LABELS[item.category]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${over ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                    ₩{actual.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">/ ₩{item.plannedKRW.toLocaleString()}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:text-destructive"
                    onClick={() => deleteItem(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${ratio * 100}%`, backgroundColor: over ? '#ef4444' : color }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* 항목 추가 */}
      <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
        <p className="text-xs font-semibold">예산 항목 추가</p>
        <div className="grid grid-cols-2 gap-2">
          <Select value={newCategory} onValueChange={(v) => setNewCategory(v as BudgetCategory)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BUDGET_CATEGORY_LABELS) as BudgetCategory[]).map((k) => (
                <SelectItem key={k} value={k} className="text-xs">{BUDGET_CATEGORY_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-8 text-xs"
            placeholder="항목 이름 (선택)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₩</span>
            <Input
              className="h-8 text-xs pl-6"
              type="number"
              placeholder="예산 금액"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
            />
          </div>
          <Button size="sm" className="h-8" onClick={addItem} disabled={!newAmount}>
            <Plus className="h-3.5 w-3.5 mr-1" />추가
          </Button>
        </div>
      </div>
    </div>
  )
}
