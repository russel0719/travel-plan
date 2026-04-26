'use client'

import { ScheduleItem as ScheduleItemType, ITEM_TYPE_LABELS, ITEM_TYPE_COLORS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, GripVertical, MapPin, Clock } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface ScheduleItemProps {
  item: ScheduleItemType
  onEdit: () => void
  onDelete: () => void
}

export default function ScheduleItemCard({ item, onEdit, onDelete }: ScheduleItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const color = ITEM_TYPE_COLORS[item.type]

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className="flex items-start gap-2 bg-white rounded-lg border p-3 hover:shadow-sm transition-shadow">
        <button
          className="mt-1 text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div
          className="w-1 self-stretch rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.time && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-3 w-3" />{item.time}
              </span>
            )}
            <Badge
              variant="outline"
              className="text-xs py-0 px-1.5"
              style={{ color, borderColor: color }}
            >
              {ITEM_TYPE_LABELS[item.type]}
            </Badge>
          </div>
          <p className="font-medium text-sm mt-0.5 truncate">{item.title}</p>
          {item.location?.name && (
            <p className="text-xs text-muted-foreground flex items-center gap-0.5 mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              {item.location.name}
            </p>
          )}
          {item.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.notes}</p>
          )}
          {item.duration && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.duration}분</p>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
