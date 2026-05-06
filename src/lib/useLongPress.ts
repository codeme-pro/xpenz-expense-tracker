import { useRef, useState } from 'react'

export function useLongPress(delay = 350) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const [pressingId, setPressingId] = useState<string | null>(null)

  const start = (id: string, callback: () => void, e: React.PointerEvent) => {
    firedRef.current = false
    startPosRef.current = { x: e.clientX, y: e.clientY }
    setPressingId(id)
    timerRef.current = setTimeout(() => {
      firedRef.current = true
      setPressingId(null)
      navigator.vibrate?.(30)
      callback()
    }, delay)
  }

  const cancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setPressingId(null)
  }

  const move = (e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - startPosRef.current.x)
    const dy = Math.abs(e.clientY - startPosRef.current.y)
    if (dx > 8 || dy > 8) cancel()
  }

  const checkFired = () => {
    if (firedRef.current) {
      firedRef.current = false
      return true
    }
    return false
  }

  return { start, cancel, move, pressingId, checkFired }
}
