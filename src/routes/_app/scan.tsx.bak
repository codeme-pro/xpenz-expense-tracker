import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Upload, Loader2, CheckCircle, AlertCircle,
  X, Camera, RotateCcw, MonitorX, Plus,
} from 'lucide-react'
import { TopBar } from '#/components/TopBar'
import { supabaseAuth } from '#/lib/supabase'

export const Route = createFileRoute('/_app/scan')({
  component: ScanScreen,
})

type ScanStatus = 'idle' | 'previewing' | 'uploading' | 'success' | 'error'

type QueueItem = {
  id: string
  file: File
  previewUrl: string
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
}

interface Preview { url: string; blob: Blob; source: 'camera' | 'file' }

function getFrameDimensions() {
  const w = window.innerWidth * 0.8
  return { w, h: w * (4 / 3) }
}

async function runBatchUpload(
  items: QueueItem[],
  token: string,
  setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>,
) {
  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/upload-receipt`
  let nextIdx = 0

  async function processNext(): Promise<void> {
    const idx = nextIdx++
    if (idx >= items.length) return
    const item = items[idx]
    setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i))
    try {
      const fd = new FormData()
      fd.append('receipt', item.file, item.file.name)
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Upload failed')
      setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'done' } : i))
    } catch (err) {
      setQueue(prev => prev.map(i =>
        i.id === item.id
          ? { ...i, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
          : i,
      ))
    }
    return processNext()
  }

  await Promise.all(Array.from({ length: Math.min(3, items.length) }, () => processNext()))
}

function ScanScreen() {
  const navigate = useNavigate()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024)
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [exiting, setExiting] = useState(false)
  const [previewExiting, setPreviewExiting] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [batchDone, setBatchDone] = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const prevPreviewUrl = useRef<string | null>(null)
  useEffect(() => {
    const old = prevPreviewUrl.current
    prevPreviewUrl.current = preview?.url ?? null
    return () => { if (old) URL.revokeObjectURL(old) }
  }, [preview?.url])

  // Revoke queue preview URLs on unmount
  const queueRef = useRef(queueItems)
  queueRef.current = queueItems
  useEffect(() => {
    return () => { queueRef.current.forEach(item => URL.revokeObjectURL(item.previewUrl)) }
  }, [])

  const isInQueue = queueItems.length > 0
  const doneCount = queueItems.filter(i => i.status === 'done').length
  const errorCount = queueItems.filter(i => i.status === 'error').length
  const isBatchUploading = queueItems.some(i => i.status === 'uploading')
  const allProcessed = isInQueue && queueItems.every(i => i.status === 'done' || i.status === 'error')

  const closeAndNavigate = useCallback(async (to = '/home') => {
    setExiting(true)
    await new Promise(r => setTimeout(r, 175))
    navigate({ to: to as '/home' })
  }, [navigate])

  // Auto-navigate when all succeed
  useEffect(() => {
    if (!batchDone || !allProcessed || errorCount > 0) return
    const timer = setTimeout(() => closeAndNavigate('/home'), 1400)
    return () => clearTimeout(timer)
  }, [batchDone, allProcessed, errorCount, closeAndNavigate])

  const clearQueue = useCallback(() => {
    queueItems.forEach(item => URL.revokeObjectURL(item.previewUrl))
    setQueueItems([])
    setBatchDone(false)
  }, [queueItems])

  // Camera: single shot → preview, but if already in queue mode → add to queue directly
  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (queueItems.length > 0) {
      setQueueItems(prev => [...prev, {
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'queued' as const,
      }])
    } else {
      setPreview({ url: URL.createObjectURL(file), blob: file, source: 'camera' })
      setStatus('previewing')
    }
    e.target.value = ''
  }

  // Gallery: single → preview flow, multiple → queue flow
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    if (files.length === 1) {
      setPreview({ url: URL.createObjectURL(files[0]), blob: files[0], source: 'file' })
      setStatus('previewing')
    } else {
      setQueueItems(files.map(f => ({
        id: crypto.randomUUID(),
        file: f,
        previewUrl: URL.createObjectURL(f),
        status: 'queued' as const,
      })))
    }
    e.target.value = ''
  }

  const handleRetake = () => {
    setPreviewExiting(true)
    setTimeout(() => {
      setPreview(null)
      setStatus('idle')
      setPreviewExiting(false)
    }, 155)
  }

  const handleUsePhoto = useCallback(async () => {
    if (!preview) return
    setStatus('uploading')
    setErrorMsg('')
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const formData = new FormData()
      formData.append('receipt', preview.blob, 'scan.jpg')
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/upload-receipt`,
        { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: formData },
      )
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Upload failed')
      setStatus('success')
      setTimeout(() => closeAndNavigate('/home'), 1200)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
      setStatus('error')
    }
  }, [preview, closeAndNavigate])

  const handleBatchUpload = useCallback(async () => {
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession()
      if (!session) return
      await runBatchUpload(queueItems, session.access_token, setQueueItems)
    } finally {
      setBatchDone(true)
    }
  }, [queueItems])

  const handleRetryFailed = useCallback(async () => {
    const failedItems = queueItems
      .filter(i => i.status === 'error')
      .map(i => ({ ...i, status: 'queued' as const, error: undefined }))
    setQueueItems(prev => prev.map(i =>
      i.status === 'error' ? { ...i, status: 'queued', error: undefined } : i,
    ))
    setBatchDone(false)
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession()
      if (!session) return
      await runBatchUpload(failedItems, session.access_token, setQueueItems)
    } finally {
      setBatchDone(true)
    }
  }, [queueItems])

  // ── Desktop: not available ────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div>
        <TopBar title="Scan" />
        <div className="flex flex-col items-center justify-center gap-5 py-28 px-8 text-center animate-fade-in-up">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center">
            <MonitorX size={28} className="text-text-2" />
          </div>
          <div className="space-y-2">
            <p className="text-base font-semibold text-text-1">Not available on desktop</p>
            <p className="text-sm text-text-2 max-w-xs">Open Xpenz on a mobile device to scan receipts and mileage logs.</p>
          </div>
          <button
            onClick={() => navigate({ to: '/home' })}
            className="px-5 h-9 text-sm font-semibold text-primary hover:underline cursor-pointer"
          >
            ← Back to home
          </button>
        </div>
      </div>
    )
  }

  // ── Mobile ─────────────────────────────────────────────────────────────────
  const { w: fw, h: fh } = getFrameDimensions()

  return (
    <div className={`fixed inset-0 z-50 bg-black overflow-hidden ${exiting ? 'animate-scan-exit' : 'animate-scan-enter'}`}>
      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleGalleryChange}
      />

      {/* ── QUEUE MODE ── */}
      {isInQueue && (
        <div className="absolute inset-0 flex flex-col bg-black">
          {/* Top bar */}
          <div
            className="shrink-0 flex items-center justify-between px-4 pb-4"
            style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}
          >
            <button
              onClick={clearQueue}
              aria-label="Cancel"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white touch-manipulation active:scale-90 transition-transform duration-100"
            >
              <X size={20} />
            </button>
            <span className="text-white text-sm font-medium">
              {queueItems.length} receipt{queueItems.length !== 1 ? 's' : ''}
            </span>
            {!isBatchUploading && !batchDone ? (
              <button
                onClick={() => galleryInputRef.current?.click()}
                aria-label="Add more"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white touch-manipulation active:scale-90 transition-transform duration-100"
              >
                <Upload size={18} />
              </button>
            ) : (
              <div className="w-10 h-10" />
            )}
          </div>

          {/* Thumbnail grid */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
            {batchDone && errorCount === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center">
                  <CheckCircle size={28} className="text-green-400" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-white">All uploaded!</p>
                  <p className="text-xs text-white/50">AI scanning in the background…</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {queueItems.map(item => (
                  <div key={item.id} className="relative aspect-square rounded-2xl overflow-hidden">
                    <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
                    {item.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 size={28} className="text-white animate-spin" />
                      </div>
                    )}
                    {item.status === 'done' && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <CheckCircle size={28} className="text-green-400" />
                      </div>
                    )}
                    {item.status === 'error' && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 px-3">
                        <AlertCircle size={24} className="text-red-400" />
                        <p className="text-[10px] text-red-300 text-center line-clamp-2">{item.error}</p>
                      </div>
                    )}
                    {item.status === 'queued' && !isBatchUploading && (
                      <button
                        onClick={() => setQueueItems(prev => prev.filter(i => i.id !== item.id))}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center touch-manipulation active:scale-90"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div
            className="shrink-0 px-5 pt-3 bg-black space-y-3"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            {isBatchUploading && (
              <p className="text-xs text-white/50 text-center">
                Uploading {doneCount + 1} of {queueItems.length}…
              </p>
            )}
            {batchDone && errorCount > 0 && (
              <p className="text-xs text-white/50 text-center">
                {doneCount} of {queueItems.length} uploaded · {errorCount} failed
              </p>
            )}
            {!batchDone && (
              allProcessed && errorCount > 0 ? (
                <div className="flex gap-3">
                  <button
                    onClick={clearQueue}
                    className="flex-1 h-12 flex items-center justify-center rounded-2xl border border-white/20 text-white text-sm font-semibold touch-manipulation active:bg-white/10 transition-colors duration-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRetryFailed}
                    className="flex-1 h-12 flex items-center justify-center rounded-2xl bg-primary text-white text-sm font-semibold touch-manipulation active:opacity-80 transition-opacity duration-100"
                  >
                    Retry ({errorCount})
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isBatchUploading}
                    aria-label="Add via camera"
                    className="w-12 h-12 shrink-0 flex items-center justify-center rounded-2xl border border-white/20 text-white touch-manipulation active:bg-white/10 disabled:opacity-40 transition-colors duration-100"
                  >
                    <Camera size={20} />
                  </button>
                  <button
                    onClick={isBatchUploading ? undefined : handleBatchUpload}
                    disabled={isBatchUploading || queueItems.length === 0}
                    className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl bg-primary text-white text-sm font-semibold touch-manipulation active:opacity-80 disabled:opacity-50 transition-opacity duration-100"
                  >
                    {isBatchUploading
                      ? <><Loader2 size={18} className="animate-spin" /> Uploading…</>
                      : `Upload all (${queueItems.length})`
                    }
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ── IDLE ── */}
      {!isInQueue && status === 'idle' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-900 to-black" />

          {/* Crop frame decoration */}
          <div
            className="absolute rounded-xl pointer-events-none"
            style={{
              width: fw, height: fh,
              left: '50%', top: '50%',
              transform: 'translate(-50%, -52%)',
              border: '1.5px solid rgba(255,255,255,0.25)',
            }}
          >
            {(['tl', 'tr', 'bl', 'br'] as const).map(c => (
              <span key={c} className="absolute w-7 h-7" style={{
                top: c[0] === 't' ? -2 : 'auto', bottom: c[0] === 'b' ? -2 : 'auto',
                left: c[1] === 'l' ? -2 : 'auto', right: c[1] === 'r' ? -2 : 'auto',
                borderTop: c[0] === 't' ? '3px solid rgba(255,255,255,0.8)' : 'none',
                borderBottom: c[0] === 'b' ? '3px solid rgba(255,255,255,0.8)' : 'none',
                borderLeft: c[1] === 'l' ? '3px solid rgba(255,255,255,0.8)' : 'none',
                borderRight: c[1] === 'r' ? '3px solid rgba(255,255,255,0.8)' : 'none',
                borderRadius: c === 'tl' ? '8px 0 0 0' : c === 'tr' ? '0 8px 0 0' : c === 'bl' ? '0 0 0 8px' : '0 0 8px 0',
              }} />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-white/30 text-xs font-medium text-center px-8">
                Tap the button below to open camera
              </p>
            </div>
          </div>

          {/* Top bar */}
          <div
            className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 pb-4"
            style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}
          >
            <button
              onClick={() => closeAndNavigate('/home')}
              aria-label="Close"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white touch-manipulation active:scale-90 transition-transform duration-100"
            >
              <X size={20} />
            </button>
            <span className="text-white text-sm font-medium drop-shadow-md">Scan</span>
            <div className="w-10 h-10" />
          </div>

          {/* Bottom controls */}
          <div
            className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/80 to-transparent pt-8"
            style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
          >
            <p className="text-white/55 text-xs font-medium text-center mb-4 px-4 pointer-events-none">
              Position receipt within frame
            </p>
            <div className="flex items-center justify-between w-full px-10">
              {/* Gallery — supports multiple selection */}
              <button
                onClick={() => galleryInputRef.current?.click()}
                aria-label="Upload from gallery"
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-black/40 text-white touch-manipulation active:scale-90 active:bg-white/20 transition-all duration-100"
              >
                <Upload size={20} />
              </button>

              {/* Camera shutter — single shot */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                aria-label="Open camera"
                className="flex items-center justify-center rounded-full touch-manipulation shadow-xl active:scale-90 transition-transform duration-100 bg-white"
                style={{ width: 72, height: 72 }}
              >
                <div className="w-14 h-14 rounded-full bg-white border-[2.5px] border-black/15 flex items-center justify-center pointer-events-none">
                  <Camera size={24} className="text-black/50" />
                </div>
              </button>

              <div className="w-12 h-12" />
            </div>
          </div>
        </>
      )}

      {/* ── PREVIEW ── */}
      {!isInQueue && status === 'previewing' && preview && (
        <div className={`absolute inset-0 flex flex-col bg-black ${previewExiting ? 'animate-status-exit' : 'animate-status-fade'}`}>
          <div
            className="shrink-0 flex items-center justify-between px-4 pb-4"
            style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}
          >
            <button
              onClick={handleRetake}
              aria-label="Back"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white touch-manipulation active:scale-90 transition-transform duration-100"
            >
              <X size={20} />
            </button>
            <span className="text-white text-sm font-medium">Preview</span>
            <div className="w-10 h-10" />
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center p-5">
            <img key={preview.url} src={preview.url} alt="Scan preview" className="max-h-full max-w-full object-contain rounded-xl animate-fade-in-up" />
          </div>

          <div
            className="shrink-0 px-5 pt-4 bg-black space-y-2"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={handleRetake}
                className="flex-1 h-12 flex items-center justify-center gap-2 rounded-2xl border border-white/20 text-white text-sm font-semibold touch-manipulation active:bg-white/10 transition-colors duration-100"
              >
                <RotateCcw size={16} />
                {preview.source === 'camera' ? 'Retake' : 'Change'}
              </button>
              <button
                onClick={handleUsePhoto}
                className="flex-1 h-12 flex items-center justify-center rounded-2xl bg-primary text-white text-sm font-semibold touch-manipulation active:opacity-80 transition-opacity duration-100"
              >
                Use Photo
              </button>
            </div>
            <button
              onClick={() => {
                const file = preview.blob instanceof File ? preview.blob : new File([preview.blob], 'scan.jpg', { type: 'image/jpeg' })
                setQueueItems(prev => [...prev, {
                  id: crypto.randomUUID(),
                  file,
                  previewUrl: preview.url,
                  status: 'queued' as const,
                }])
                setPreview(null)
                setStatus('idle')
                setPreviewExiting(false)
              }}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-2xl border border-white/15 text-white/70 text-sm font-medium touch-manipulation active:bg-white/10 transition-colors duration-100"
            >
              <Plus size={15} />
              Add to batch
            </button>
          </div>
        </div>
      )}

      {/* ── STATUS overlays ── */}
      {!isInQueue && (status === 'uploading' || status === 'success' || status === 'error') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 animate-status-fade">
          {status === 'uploading' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                <Loader2 size={28} className="text-white animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-white">Uploading…</p>
                <p className="text-xs text-white/50">Sending image to server</p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center">
                <CheckCircle size={28} className="text-green-400" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-white">Uploaded!</p>
                <p className="text-xs text-white/50">AI scanning in the background…</p>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
                <AlertCircle size={28} className="text-red-400" />
              </div>
              <div className="text-center space-y-1 px-2">
                <p className="text-sm font-semibold text-white">Scan failed</p>
                <p className="text-xs text-white/50 break-words">{errorMsg}</p>
              </div>
              <button
                onClick={() => { setPreview(null); setErrorMsg(''); setStatus('idle') }}
                className="mt-1 px-6 h-10 bg-white/10 text-white text-sm font-semibold rounded-2xl touch-manipulation active:bg-white/20 transition-colors duration-100"
              >
                Try again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
