'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTripStore } from '@/store/tripStore'
import TripHeader from '@/components/trip/TripHeader'
import DaySchedule from '@/components/trip/DaySchedule'
import FlightSection from '@/components/trip/FlightSection'
import AccommodationSection from '@/components/trip/AccommodationSection'
import BudgetTracker from '@/components/trip/BudgetTracker'
import TripMap from '@/components/map/TripMap'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getDayLabel, formatDate } from '@/lib/utils'
import { ScheduleItem, Trip, Budget, Flight, Accommodation, TravelReport } from '@/lib/types'
import { CalendarDays, Plane, Wallet, BookOpen, PlusCircle, FileText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ReportUploadPanel from '@/components/report/ReportUploadPanel'
import ReportCommentPanel from '@/components/report/ReportCommentPanel'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function TripPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const {
    hydrated, hydrate, getTrip,
    updateTrip, addScheduleItem, updateScheduleItem, deleteScheduleItem, reorderScheduleItems,
    addFlight, updateFlight, deleteFlight,
    addAccommodation, updateAccommodation, deleteAccommodation,
    updateBudget, deleteReport,
  } = useTripStore()
  const [activeDay, setActiveDay] = useState(0)
  const [panel, setPanel] = useState<'schedule' | 'info' | 'budget' | 'report'>('schedule')
  // null = 지도 표시, 'upload' = 새 후기 업로드, string = 특정 보고서 코멘트
  const [reportView, setReportView] = useState<null | 'upload' | string>(null)

  const openReportView = (view: 'upload' | string) => {
    setPanel('report')
    setReportView(view)
  }
  const closeReportView = () => setReportView(null)

  useEffect(() => {
    if (!hydrated) hydrate()
  }, [hydrated, hydrate])

  const trip = getTrip(id)

  useEffect(() => {
    if (hydrated && !trip) router.push('/')
  }, [hydrated, trip, router])

  if (!hydrated || !trip) return null

  const currentDay = trip.days[activeDay]

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <TripHeader trip={trip} onUpdate={(data) => updateTrip(id, data as Partial<Trip>)} />

      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 패널 - 모바일에서 reportView 활성 시 숨김 */}
        <div className={`${reportView !== null ? 'hidden md:flex' : 'flex w-full'} md:max-w-sm md:border-r bg-gray-50 flex-col overflow-hidden`}>

          {/* 패널 전환 탭 */}
          <div className="border-b bg-white px-3 pt-2 pb-1 flex gap-1">
            <button
              onClick={() => setPanel('schedule')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                panel === 'schedule' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />일정
            </button>
            {trip.isInternational && (
              <button
                onClick={() => setPanel('info')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  panel === 'info' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Plane className="h-3.5 w-3.5" />항공·숙박
              </button>
            )}
            <button
              onClick={() => setPanel('budget')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                panel === 'budget' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Wallet className="h-3.5 w-3.5" />예산
            </button>
            <button
              onClick={() => setPanel('report')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                panel === 'report' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />후기
              {(trip.reports ?? []).length > 0 && (
                <span className="ml-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[10px] px-1.5 py-px font-semibold">
                  {trip.reports!.length}
                </span>
              )}
            </button>
          </div>

          {/* 일정 패널 */}
          {panel === 'schedule' && (
            <Tabs
              value={String(activeDay)}
              onValueChange={(v) => setActiveDay(Number(v))}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="border-b bg-white px-3 pt-2">
                <TabsList className="flex gap-1 h-auto overflow-x-auto flex-nowrap bg-transparent p-0 pb-2">
                  {trip.days.map((_, idx) => (
                    <TabsTrigger
                      key={idx}
                      value={String(idx)}
                      className="text-xs px-2.5 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md"
                    >
                      {getDayLabel(idx)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="flex-1 overflow-y-auto">
                {trip.days.map((day, idx) => (
                  <TabsContent key={idx} value={String(idx)} className="p-3 mt-0">
                    <DaySchedule
                      day={day}
                      onAddItem={(item) => addScheduleItem(id, day.date, item)}
                      onUpdateItem={(itemId, data) => updateScheduleItem(id, day.date, itemId, data)}
                      onDeleteItem={(itemId) => deleteScheduleItem(id, day.date, itemId)}
                      onReorderItems={(items: ScheduleItem[]) => reorderScheduleItems(id, day.date, items)}
                    />
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          )}

          {/* 항공·숙박 패널 */}
          {panel === 'info' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-6">
              <FlightSection
                flights={trip.flights ?? []}
                onAdd={(f: Omit<Flight, 'id'>) => addFlight(id, f)}
                onUpdate={(fid: string, f: Partial<Flight>) => updateFlight(id, fid, f)}
                onDelete={(fid: string) => deleteFlight(id, fid)}
              />
              <AccommodationSection
                accommodations={trip.accommodations ?? []}
                onAdd={(a: Omit<Accommodation, 'id'>) => addAccommodation(id, a)}
                onUpdate={(aid: string, a: Partial<Accommodation>) => updateAccommodation(id, aid, a)}
                onDelete={(aid: string) => deleteAccommodation(id, aid)}
              />
            </div>
          )}

          {/* 예산 패널 */}
          {panel === 'budget' && (
            <div className="flex-1 overflow-y-auto p-3">
              <BudgetTracker
                trip={trip}
                onUpdateBudget={(b: Budget) => updateBudget(id, b)}
              />
            </div>
          )}

          {/* 후기 패널 */}
          {panel === 'report' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <Button
                size="sm"
                className="w-full"
                onClick={() => openReportView('upload')}
              >
                <PlusCircle className="h-4 w-4 mr-1.5" />새 후기 작성
              </Button>

              {(trip.reports ?? []).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">아직 작성된 후기가 없어요</p>
                  <p className="text-xs mt-0.5">여행 후기를 작성해보세요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...(trip.reports ?? [])].reverse().map((report: TravelReport) => (
                    <div
                      key={report.id}
                      className="bg-white border border-gray-100 rounded-lg p-3 hover:border-gray-300 transition-colors cursor-pointer group"
                      onClick={() => openReportView(report.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                            <p className="text-xs font-semibold text-gray-800 truncate">{report.title}</p>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5 ml-5">
                            {new Date(report.createdAt).toLocaleDateString('ko-KR')}
                            {report.photoMeta?.length > 0 && ` · 사진 ${report.photoMeta.length}장`}
                          </p>
                          {report.aiGeneratedText && (
                            <p className="text-[10px] text-gray-500 mt-1 ml-5 line-clamp-2 leading-relaxed">
                              {report.aiGeneratedText.replace(/##[^\n]*/g, '').replace(/\*\*/g, '').trim().slice(0, 80)}…
                            </p>
                          )}
                        </div>
                        <button
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('이 후기를 삭제할까요?')) {
                              sessionStorage.removeItem(`report-photos-${report.id}`)
                              deleteReport(id, report.id)
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 우측: 지도 또는 후기 패널 */}
        <div className={reportView !== null ? 'flex flex-1 overflow-hidden' : 'hidden md:flex flex-1 p-3'}>
          {reportView === null ? (
            currentDay && <TripMap day={currentDay} />
          ) : reportView === 'upload' ? (
            <ReportUploadPanel
              tripId={id}
              onCreated={(newReportId) => setReportView(newReportId)}
              onBack={closeReportView}
            />
          ) : (
            <ReportCommentPanel
              tripId={id}
              reportId={reportView}
              onPrint={() => router.push(`/trip/${id}/report/${reportView}/print`)}
              onBack={closeReportView}
            />
          )}
        </div>
      </div>
    </div>
  )
}
