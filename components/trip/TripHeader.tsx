'use client'

import { useState } from 'react'
import { Trip } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Pencil, Check, X, FileDown } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface TripHeaderProps {
  trip: Trip
  onUpdate: (data: Partial<Trip>) => void
}

export default function TripHeader({ trip, onUpdate }: TripHeaderProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(trip.title)

  const handleSave = () => {
    if (title.trim()) onUpdate({ title: title.trim() })
    setEditing(false)
  }

  const handleCancel = () => {
    setTitle(trip.title)
    setEditing(false)
  }

  return (
    <div className="border-b bg-white px-4 py-3 flex items-center gap-3">
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push('/')}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              className="h-8 text-base font-semibold"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
              autoFocus
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave}><Check className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel}><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <h1 className="font-semibold text-base truncate">{trip.title}</h1>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{trip.destination}</span>
          <span>·</span>
          <span>{formatDate(trip.startDate)} ~ {formatDate(trip.endDate)}</span>
          {trip.isInternational && <Badge variant="secondary" className="text-xs py-0">해외</Badge>}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => window.open(`/trip/${trip.id}/print`, '_blank')}
      >
        <FileDown className="h-4 w-4 md:mr-1.5" />
        <span className="hidden md:inline">PDF 저장</span>
      </Button>
    </div>
  )
}
