import { useEffect, useRef, useState } from 'react'
import { CheckCircle, AlertCircle, Loader2, X, ChevronRight, ScanLine } from 'lucide-react'
import { useScanProgress } from '#/context/ScanProgressContext'
import { formatRelative, formatCurrency } from '#/lib/format'
import type { ScanItem, ScanStatus } from '#/context/ScanProgressContext'

type PillState = 'hidden' | 'active' | 'done' | 'error'

function StatusIcon({ status, size = 18 }: { status: ScanStatus; size?: number }) {
  if (status === 'uploaded' || status === 'processing') {
    return <Loader2 size={size} className="animate-spin text-white" />
  }
  if (status === 'parsed') {
    return <CheckCircle size={size} className="text-green-400" />
  }
  if (status === 'failed' || status === 'unknown') {
    return <AlertCircle size={size} className="text-red-400" />
  }
  return null
}

function ScanRow({ scan }: { scan: ScanItem }) {
  const isActive = scan.status === 'uploaded' || scan.status === 'processing'
  const isFailed = scan.status === 'failed' || scan.status === 'unknown'

  const label = scan.merchant
    ? scan.merchant
    : isActive
      ? 'Scanning with AI…'
      : scan.status === 'parsed'
        ? 'Receipt scanned'
        : scan.status === 'unknown'
          ? 'Not a valid receipt'
          : 'Scan failed'

  const sub = isFailed && scan.error_reason
    ? scan.error_reason
    : scan.amount && scan.currency
      ? formatCurrency(scan.amount, scan.currency)
      : formatRelative(scan.created_at)

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={[
        'w-9 h-9 shrink-0 rounded-xl flex items-center justify-center',
        isActive ? 'bg-primary/10' : isFailed ? 'bg-danger/10' : 'bg-success/10',
      ].join(' ')}>
        <StatusIcon status={scan.status} size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={[
          'text-sm font-medium truncate',
          isFailed ? 'text-danger' : 'text-text-1',
        ].join(' ')}>
          {label}
        </p>
        <p className="text-xs text-text-2 truncate mt-0.5">{sub}</p>
      </div>
      <span className={[
        'shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full',
        isActive ? 'bg-primary/10 text-primary' :
        isFailed ? 'bg-danger/10 text-danger' :
        'bg-success/10 text-success',
      ].join(' ')}>
        {isActive ? 'Scanning' : scan.status === 'parsed' ? 'Done' : 'Failed'}
      </span>
    </div>
  )
}

export function ScanProgressIndicator() {
  const { scans, activeCount, failedCount, isSheetOpen, openSheet, closeSheet } = useScanProgress()

  const [pillState, setPillState] = useState<PillState>('hidden')
  const wasActiveRef = useRef(false)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (activeCount > 0) {
      wasActiveRef.current = true
      clearTimeout(dismissTimerRef.current!)
      setPillState('active')
    } else if (wasActiveRef.current) {
      if (failedCount > 0) {
        setPillState('error')
      } else {
        setPillState('done')
        dismissTimerRef.current = setTimeout(() => {
          setPillState('hidden')
          wasActiveRef.current = false
        }, 5000)
      }
    }
    return () => clearTimeout(dismissTimerRef.current!)
  }, [activeCount, failedCount])

  // Close sheet on outside tap
  useEffect(() => {
    if (!isSheetOpen) return
    const handle = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        closeSheet()
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [isSheetOpen, closeSheet])

  // Dismiss "done" pill manually
  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    clearTimeout(dismissTimerRef.current!)
    setPillState('hidden')
    wasActiveRef.current = false
  }

  if (pillState === 'hidden' && !isSheetOpen) return null

  const pillText =
    pillState === 'active'
      ? `${activeCount} scanning…`
      : pillState === 'error'
        ? `${failedCount} failed`
        : `${scans.filter(s => s.status === 'parsed').length} scanned`

  const pillIcon =
    pillState === 'active' ? (
      <Loader2 size={14} className="animate-spin" />
    ) : pillState === 'error' ? (
      <AlertCircle size={14} />
    ) : (
      <CheckCircle size={14} />
    )

  const pillColor =
    pillState === 'active'
      ? 'bg-neutral-900/95 text-white border-white/10'
      : pillState === 'error'
        ? 'bg-danger/90 text-white border-danger/20'
        : 'bg-neutral-900/95 text-white border-white/10'

  return (
    <>
      {/* Pill */}
      {pillState !== 'hidden' && (
        <div className={[
          'fixed z-[80] flex items-center gap-2 px-3.5 py-2 rounded-full border shadow-lg',
          'backdrop-blur-sm transition-all duration-300',
          // Mobile: centered above BottomNav
          'bottom-[84px] left-1/2 -translate-x-1/2',
          // Desktop: bottom-right, no translate
          'lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0',
          pillColor,
        ].join(' ')}>
          <button
            onClick={openSheet}
            className="flex items-center gap-2 touch-manipulation"
            aria-label="View scan progress"
          >
            {pillIcon}
            <span className="text-xs font-semibold whitespace-nowrap">{pillText}</span>
            <ChevronRight size={13} className="opacity-60" />
          </button>
          {pillState !== 'active' && (
            <button
              onClick={handleDismiss}
              className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity touch-manipulation"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Bottom sheet overlay */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-[90] flex items-end">
          {/* Scrim */}
          <div className="absolute inset-0 bg-black/50" onClick={closeSheet} />

          {/* Sheet */}
          <div
            ref={sheetRef}
            className="relative w-full bg-surface rounded-t-2xl shadow-2xl flex flex-col max-h-[65dvh] animate-fade-in-up"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <ScanLine size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-text-1">Recent Scans</h3>
                {activeCount > 0 && (
                  <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {activeCount} active
                  </span>
                )}
              </div>
              <button
                onClick={closeSheet}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-text-2 hover:bg-nav-hover-bg hover:text-text-1 transition-colors duration-150"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable scan list */}
            <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border">
              {scans.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center">
                    <ScanLine size={20} className="text-text-2" />
                  </div>
                  <p className="text-sm text-text-2">No scans in the last 30 minutes</p>
                </div>
              ) : (
                scans.map(scan => <ScanRow key={scan.id} scan={scan} />)
              )}
            </div>

            {/* Bottom safe area */}
            <div className="shrink-0 h-[max(1rem,env(safe-area-inset-bottom))]" />
          </div>
        </div>
      )}
    </>
  )
}
