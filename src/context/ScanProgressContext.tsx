import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabaseAuth } from '#/lib/supabase'
import { queryKeys } from '#/lib/queryKeys'
import { useAuth } from '#/context/AuthContext'

export type ScanStatus = 'uploaded' | 'processing' | 'parsed' | 'failed' | 'unknown'
export type ScanType = 'expense' | 'mileage' | 'unknown' | null

export interface ScanItem {
  id: string
  status: ScanStatus
  type: ScanType
  created_at: string
  file_path: string | null
  error_reason: string | null
  merchant: string | null
  amount: number | null
  currency: string | null
  fromLocation: string | null
  toLocation: string | null
  distance: number | null
  distanceUnit: string | null
}

interface ScanProgressContextValue {
  scans: ScanItem[]
  activeCount: number
  failedCount: number
  isSheetOpen: boolean
  openSheet: () => void
  closeSheet: () => void
}

const ScanProgressContext = createContext<ScanProgressContextValue>({
  scans: [],
  activeCount: 0,
  failedCount: 0,
  isSheetOpen: false,
  openSheet: () => {},
  closeSheet: () => {},
})

export function ScanProgressProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [scans, setScans] = useState<ScanItem[]>([])
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const fetchScans = useCallback(async (userId: string) => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data } = await supabaseAuth
      .from('scans')
      .select('id, status, type, created_at, file_path, error_reason, expenses(merchant, amount, currency), mileage(from_location, to_location, distance, unit)')
      .eq('user_id', userId)
      .gte('created_at', thirtyMinAgo)
      .order('created_at', { ascending: false })

    if (!data) return
    setScans(data.map(row => {
      const exp = Array.isArray(row.expenses) ? row.expenses[0] : null
      const mil = Array.isArray(row.mileage) ? row.mileage[0] : null
      return {
        id: row.id,
        status: row.status as ScanStatus,
        type: (row.type as ScanType) ?? null,
        created_at: row.created_at,
        file_path: row.file_path ?? null,
        error_reason: row.error_reason ?? null,
        merchant: exp?.merchant ?? null,
        amount: exp?.amount ?? null,
        currency: exp?.currency ?? null,
        fromLocation: mil?.from_location ?? null,
        toLocation: mil?.to_location ?? null,
        distance: mil?.distance ?? null,
        distanceUnit: mil?.unit ?? null,
      }
    }))
  }, [])

  useEffect(() => {
    if (!user) return
    const userId = user.id

    fetchScans(userId)

    channelRef.current = supabaseAuth
      .channel(`scan-progress-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scans', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          setScans(prev => [{
            id: row.id as string,
            status: row.status as ScanStatus,
            type: null,
            created_at: row.created_at as string,
            file_path: (row.file_path as string) ?? null,
            error_reason: null,
            merchant: null,
            amount: null,
            currency: null,
            fromLocation: null,
            toLocation: null,
            distance: null,
            distanceUnit: null,
          }, ...prev])
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'scans', filter: `user_id=eq.${userId}` },
        async (payload) => {
          const row = payload.new as Record<string, unknown>
          const status = row.status as ScanStatus
          const type = (row.type as ScanType) ?? null
          let merchant: string | null = null
          let amount: number | null = null
          let currency: string | null = null
          let fromLocation: string | null = null
          let toLocation: string | null = null
          let distance: number | null = null
          let distanceUnit: string | null = null

          if (status === 'parsed') {
            if (type === 'expense') {
              const { data: expData } = await supabaseAuth
                .from('expenses')
                .select('merchant, amount, currency')
                .eq('scan_id', row.id as string)
                .single()
              if (expData) {
                merchant = expData.merchant
                amount = expData.amount
                currency = expData.currency
              }
              queryClient.invalidateQueries({ queryKey: queryKeys.expenses() })
            } else if (type === 'mileage') {
              const { data: milData } = await supabaseAuth
                .from('mileage')
                .select('from_location, to_location, distance, unit')
                .eq('scan_id', row.id as string)
                .single()
              if (milData) {
                fromLocation = milData.from_location
                toLocation = milData.to_location
                distance = milData.distance
                distanceUnit = milData.unit
              }
              queryClient.invalidateQueries({ queryKey: queryKeys.mileage() })
            }
          }

          setScans(prev => prev.map(s => s.id === (row.id as string) ? {
            ...s,
            status,
            type,
            error_reason: (row.error_reason as string) ?? null,
            ...(merchant !== null ? { merchant, amount, currency } : {}),
            ...(distance !== null ? { fromLocation, toLocation, distance, distanceUnit } : {}),
          } : s))
        },
      )
      .subscribe()

    return () => {
      channelRef.current?.unsubscribe()
    }
  }, [user?.id, fetchScans, queryClient])

  const activeCount = scans.filter(s => s.status === 'uploaded' || s.status === 'processing').length
  const failedCount = scans.filter(s => s.status === 'failed' || s.status === 'unknown').length

  return (
    <ScanProgressContext.Provider value={{
      scans,
      activeCount,
      failedCount,
      isSheetOpen,
      openSheet: () => setIsSheetOpen(true),
      closeSheet: () => setIsSheetOpen(false),
    }}>
      {children}
    </ScanProgressContext.Provider>
  )
}

export function useScanProgress() {
  return useContext(ScanProgressContext)
}
