'use client'

import { useState } from 'react'
import { DaySchedule as DayScheduleType, ScheduleItem } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import ScheduleItemCard from './ScheduleItem'
import ScheduleForm from './ScheduleForm'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'

interface DayScheduleProps {
  day: DayScheduleType
  onAddItem: (item: Omit<ScheduleItem, 'id'>) => void
  onUpdateItem: (itemId: string, data: Partial<ScheduleItem>) => void
  onDeleteItem: (itemId: string) => void
  onReorderItems: (items: ScheduleItem[]) => void
}

export default function DaySchedule({
  day,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onReorderItems,
}: DayScheduleProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<ScheduleItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = day.items.findIndex((i) => i.id === active.id)
    const newIndex = day.items.findIndex((i) => i.id === over.id)
    onReorderItems(arrayMove(day.items, oldIndex, newIndex))
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">{formatDate(day.date)}</p>

      {day.items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg">
          일정을 추가해보세요
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={day.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {day.items.map((item) => (
              <ScheduleItemCard
                key={item.id}
                item={item}
                onEdit={() => setEditItem(item)}
                onDelete={() => onDeleteItem(item.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={() => setAddOpen(true)}
      >
        <Plus className="h-4 w-4 mr-1" />
        일정 추가
      </Button>

      <ScheduleForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(data) => {
          onAddItem(data)
          setAddOpen(false)
        }}
      />

      {editItem && (
        <ScheduleForm
          open={!!editItem}
          initial={editItem}
          onClose={() => setEditItem(null)}
          onSave={(data) => {
            onUpdateItem(editItem.id, data)
            setEditItem(null)
          }}
        />
      )}
    </div>
  )
}
