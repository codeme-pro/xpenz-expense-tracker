import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Upload, Loader2, CheckCircle, AlertCircle,
  X, Zap, ZapOff, RotateCcw, MonitorX,
} from 'lucide-react'
import { TopBar } from '#/components/TopBar'
import { supabaseAuth } from '#/lib/supabase'

export const Route = createFileRoute('/_app/scan')({
  component: ScanScreen,
})

type ScanStatus = 'idle' | 'previewing' | 'uploading' | 'success' | 'error'

interface Preview { url: string; blob: Blob; source: 'camera' | 'file' }

function getFrameDimensions() {
  const w = window.innerWidth * 0.8
  return { w, h: w * (4 / 3) }
}

function captureAndCrop(video: HTMLVideoElement): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return Promise.resolve(null)
  const dw = window.innerWidth
  const dh = window.innerHeight
  const scale = Math.max(dw / vw, dh / vh)
  const offX = (dw - vw * scale) / 2
  const offY = (dh - vh * scale) / 2
  const { w: fw, h: fh } = getFrameDimensions()
  const fx = (dw - fw) / 2
  const fy = (dh - fh) / 2
  const srcX = (fx - offX) / scale
  const srcY = (fy - offY) / scale
  const srcW = fw / scale
  const srcH = fh / scale
  canvas.width = Math.round(srcW)
  canvas.height = Math.round(srcH)
  ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height)
  return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92))
}

function ScanScreen() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024)
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [exiting, setExiting] = useState(false)
  const [previewExiting, setPreviewExiting] = useState(false)
  const [hasCamera, setHasCamera] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Camera init
  useEffect(() => {
    const md = navigator.mediaDevices as MediaDevices | undefined
    if (isDesktop || !md?.getUserMedia) return
    let active = true
    md.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
    }).then(stream => {
      if (!active) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setHasCamera(true)
    }).catch(() => {
      if (active) setHasCamera(prev => prev)
    })
    return () => {
      active = false
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [isDesktop])

  useEffect(() => {
    if (hasCamera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [hasCamera])

  useEffect(() => {
    streamRef.current?.getTracks().forEach(t => { t.enabled = status === 'idle' || status === 'previewing' })
  }, [status])

  const prevPreviewUrl = useRef<string | null>(null)
  useEffect(() => {
    const old = prevPreviewUrl.current
    prevPreviewUrl.current = preview?.url ?? null
    return () => { if (old) URL.revokeObjectURL(old) }
  }, [preview?.url])

  const closeAndNavigate = useCallback(async (to = '/home') => {
    setExiting(true)
    await new Promise(r => setTimeout(r, 175))
    navigate({ to: to as '/home' })
  }, [navigate])

  const handleCapture = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    const blob = await captureAndCrop(video)
    if (!blob) return
    setPreview({ url: URL.createObjectURL(blob), blob, source: 'camera' })
    setStatus('previewing')
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview({ url: URL.createObjectURL(file), blob: file, source: 'file' })
    setStatus('previewing')
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
      // Upload done — AI processing runs in background, home screen shows progress
      setStatus('success')
      setTimeout(() => closeAndNavigate('/home'), 1200)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
      setStatus('error')
    }
  }, [preview, closeAndNavigate])

  const toggleFlash = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !flashOn }] })
      setFlashOn(f => !f)
    } catch { /* torch unsupported */ }
  }

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

  // ── Mobile: full-screen camera UI ─────────────────────────────────────────
  const { w: fw, h: fh } = getFrameDimensions()

  return (
    <div className={`fixed inset-0 z-50 bg-black overflow-hidden ${exiting ? 'animate-scan-exit' : 'animate-scan-enter'}`}>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Video always mounted — prevents camera re-init/blank on retake */}
      {hasCamera && (
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
      )}

      {/* ── IDLE viewfinder ── */}
      {status === 'idle' && (
        <>
          {/* Crop frame + dark surround */}
          <div
            className="absolute rounded-xl pointer-events-none"
            style={{
              width: fw, height: fh,
              left: '50%', top: '50%',
              transform: 'translate(-50%, -52%)',
              boxShadow: '0 0 0 100vmax rgba(0,0,0,0.65)',
              clipPath: 'inset(-100vmax)',
              border: '1.5px solid rgba(255,255,255,0.6)',
            }}
          >
            {(['tl', 'tr', 'bl', 'br'] as const).map(c => (
              <span key={c} className="absolute w-7 h-7" style={{
                top: c[0] === 't' ? -2 : 'auto', bottom: c[0] === 'b' ? -2 : 'auto',
                left: c[1] === 'l' ? -2 : 'auto', right: c[1] === 'r' ? -2 : 'auto',
                borderTop: c[0] === 't' ? '3px solid #fff' : 'none',
                borderBottom: c[0] === 'b' ? '3px solid #fff' : 'none',
                borderLeft: c[1] === 'l' ? '3px solid #fff' : 'none',
                borderRight: c[1] === 'r' ? '3px solid #fff' : 'none',
                borderRadius: c === 'tl' ? '8px 0 0 0' : c === 'tr' ? '0 8px 0 0' : c === 'bl' ? '0 0 0 8px' : '0 0 8px 0',
              }} />
            ))}
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
            <button
              onClick={toggleFlash}
              aria-label={flashOn ? 'Flash on' : 'Flash off'}
              disabled={!hasCamera}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white touch-manipulation active:scale-90 transition-transform duration-100 disabled:opacity-30"
            >
              {flashOn ? <Zap size={18} /> : <ZapOff size={18} />}
            </button>
          </div>

          {/* Bottom controls — hint text lives here so it never overlaps the frame */}
          <div
            className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/80 to-transparent pt-8"
            style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
          >
            <p className="text-white/55 text-xs font-medium text-center mb-4 px-4 pointer-events-none">
              {hasCamera ? 'Position receipt or map within frame' : 'Camera unavailable — tap below to upload'}
            </p>
            <div className="flex items-center justify-center">
              {hasCamera && (
                <div className="flex items-center justify-between w-full px-10">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Upload from gallery"
                    className="w-12 h-12 flex items-center justify-center rounded-xl bg-black/40 text-white touch-manipulation active:scale-90 active:bg-white/20 transition-all duration-100"
                  >
                    <Upload size={20} />
                  </button>

                  <button
                    onClick={handleCapture}
                    aria-label="Capture photo"
                    className="flex items-center justify-center rounded-full touch-manipulation shadow-xl active:scale-90 transition-transform duration-100 bg-white"
                    style={{ width: 72, height: 72 }}
                  >
                    <div className="w-14 h-14 rounded-full bg-white border-[2.5px] border-black/15 pointer-events-none" />
                  </button>

                  <div className="w-12 h-12" />
                </div>
              )}

              {!hasCamera && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Choose file"
                  className="flex items-center justify-center rounded-full touch-manipulation shadow-xl active:scale-90 transition-transform duration-100"
                  style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.18)' }}
                >
                  <Upload size={22} className="text-white pointer-events-none" />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── PREVIEW ── */}
      {status === 'previewing' && preview && (
        <div className={`absolute inset-0 flex flex-col bg-black ${previewExiting ? 'animate-status-exit' : 'animate-status-fade'}`}>
          {/* Top bar in flow — ensures flex-1 image doesn't push buttons off screen */}
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

          {/* min-h-0 prevents flex item from overflowing its computed height */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-5">
            <img key={preview.url} src={preview.url} alt="Scan preview" className="max-h-full max-w-full object-contain rounded-xl animate-fade-in-up" />
          </div>

          <div
            className="shrink-0 flex items-center gap-3 px-5 pt-4 pb-6 bg-black"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
          >
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
        </div>
      )}

      {/* ── STATUS overlays ── */}
      {(status === 'uploading' || status === 'success' || status === 'error') && (
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
