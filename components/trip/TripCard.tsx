'use client'

import { Trip } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Calendar, Trash2 } from 'lucide-react'

interface TripCardProps {
  trip: Trip
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}

export default function TripCard({ trip, onClick, onDelete }: TripCardProps) {
  const totalItems = trip.days.reduce((sum, d) => sum + d.items.length, 0)

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow group"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight">{trip.title}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {trip.isInternational && (
          <Badge variant="secondary" className="w-fit text-xs">해외여행</Badge>
        )}
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
        <p className="text-xs pt-1">
          {trip.days.length}일 · 일정 {totalItems}개
        </p>
      </CardContent>
    </Card>
  )
}
