'use client'

import { Trip } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Calendar, Trash2, BookOpen } from 'lucide-react'

interface TripCardProps {
  trip: Trip
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}

export default function TripCard({ trip, onClick, onDelete }: TripCardProps) {
  const totalItems = trip.days.reduce((sum, d) => sum + d.items.length, 0)
  const reportCount = trip.reports?.length ?? 0

  const totalPlanned = trip.budget?.items.reduce((s, i) => s + i.plannedKRW, 0) ?? 0
  const totalActual = (() => {
    if (!trip.budget) return 0
    const { localCurrency, exchangeRate } = trip.budget
    let sum = 0
    for (const day of trip.days) {
      for (const item of day.items) {
        if (!item.price) continue
        const cur = item.currency ?? localCurrency
        sum += cur === 'KRW' || cur === '₩' ? item.price : Math.round(item.price * exchangeRate)
      }
    }
    sum += (trip.flights ?? []).reduce((s, f) => s + (f.priceKRW ?? 0), 0)
    sum += (trip.accommodations ?? []).reduce((s, a) => s + (a.priceKRW ?? 0), 0)
    return sum
  })()

  const budgetRatio = totalPlanned > 0 ? Math.min(totalActual / totalPlanned, 1) : 0
  const budgetOver = totalPlanned > 0 && totalActual > totalPlanned

  return (
    <Card
      className="cursor-pointer hover:border-primary transition-colors group"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight">{trip.title}</CardTitle>
          {/* 모바일: 항상 표시 / 데스크톱: hover 시 표시 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 md:opacity-0 md:group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {trip.isInternational && (
            <Badge variant="secondary" className="w-fit text-xs">해외여행</Badge>
          )}
          {reportCount > 0 && (
            <Badge variant="outline" className="w-fit text-xs text-indigo-600 border-indigo-200">
              <BookOpen className="h-3 w-3 mr-1" />후기 {reportCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span>{trip.destination}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>{formatDate(trip.startDate)} ~ {formatDate(trip.endDate)}</span>
        </div>
        <p className="text-xs pt-0.5">
          {trip.days.length}일 · 일정 {totalItems}개
        </p>
        {totalPlanned > 0 && (
          <div className="pt-1 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className={budgetOver ? 'text-red-500 font-medium' : ''}>
                ₩{totalActual.toLocaleString()}
              </span>
              <span>/ ₩{totalPlanned.toLocaleString()}</span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${budgetRatio * 100}%`,
                  backgroundColor: budgetOver ? '#ef4444' : '#3b82f6',
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
