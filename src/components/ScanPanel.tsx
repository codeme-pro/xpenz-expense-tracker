import { useRef, useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Upload, ScanLine, X, Loader2, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react'
import { usePanel } from '#/context/PanelContext'
import { supabaseAuth } from '#/lib/supabase'

type ScanStatus = 'idle' | 'previewing' | 'uploading' | 'success' | 'error'

interface Preview {
  url: string
  blob: Blob
}

export function ScanPanel() {
  const { closePanel } = usePanel()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [closing, setClosing] = useState(false)
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Revoke preview URL on change
  const prevUrl = useRef<string | null>(null)
  useEffect(() => {
    const old = prevUrl.current
    prevUrl.current = preview?.url ?? null
    return () => { if (old) URL.revokeObjectURL(old) }
  }, [preview?.url])

  const handleClose = () => {
    setClosing(true)
    setTimeout(closePanel, 150)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview({ url: URL.createObjectURL(file), blob: file })
    setStatus('previewing')
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0] as File | undefined
    if (!file) return
    setPreview({ url: URL.createObjectURL(file), blob: file })
    setStatus('previewing')
  }

  const handleChangeFile = () => {
    setPreview(null)
    setStatus('idle')
  }

  const handleUpload = async () => {
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

      // Upload done — AI processes in background, home screen shows progress banner
      setStatus('success')
      setTimeout(() => {
        setClosing(true)
        setTimeout(() => { closePanel(); navigate({ to: '/home' }) }, 150)
      }, 1200)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
      setStatus('error')
    }
  }

  return (
    <>
      {/* Backdrop — only dismisses when idle */}
      <div
        className="fixed inset-0 z-[60] bg-black/40"
        onClick={status === 'idle' ? handleClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        aria-label="Scan panel"
        className={`fixed right-0 top-0 h-full w-[380px] z-[70] bg-surface border-l border-border flex flex-col shadow-2xl ${closing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Header */}
        <div className="h-14 px-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-text-1">Scan</h2>
          <button
            onClick={handleClose}
            aria-label="Close scan panel"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-2 hover:bg-nav-hover-bg hover:text-text-1 transition-colors duration-150 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col p-6 gap-4 min-h-0">

          {/* Preview */}
          {status === 'previewing' && preview && (
            <>
              <div className="flex-1 rounded-xl overflow-hidden bg-black/5 border border-border flex items-center justify-center min-h-0">
                <img
                  src={preview.url}
                  alt="Upload preview"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleChangeFile}
                  className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl border border-border text-text-1 text-sm font-semibold hover:bg-surface cursor-pointer transition-colors duration-150"
                >
                  <RotateCcw size={15} />
                  Change
                </button>
                <button
                  onClick={handleUpload}
                  className="flex-1 h-11 flex items-center justify-center rounded-xl bg-primary text-white text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity duration-150"
                >
                  Use this
                </button>
              </div>
            </>
          )}

          {/* Uploading */}
          {status === 'uploading' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 size={26} className="text-primary animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-text-1">Uploading…</p>
                <p className="text-xs text-text-2">Sending image to server</p>
              </div>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center">
                <CheckCircle size={26} className="text-success" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-text-1">Uploaded!</p>
                <p className="text-xs text-text-2">AI scanning in background…</p>
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-danger/10 flex items-center justify-center">
                <AlertCircle size={26} className="text-danger" />
              </div>
              <div className="text-center space-y-1 px-2">
                <p className="text-sm font-semibold text-text-1">Scan failed</p>
                <p className="text-xs text-text-2 break-words">{errorMsg}</p>
              </div>
              <button
                onClick={() => { setPreview(null); setStatus('idle'); setErrorMsg('') }}
                className="px-5 h-9 bg-primary text-white text-sm font-semibold rounded-xl cursor-pointer hover:opacity-90 transition-opacity duration-150"
              >
                Try again
              </button>
            </div>
          )}

          {/* Idle */}
          {status === 'idle' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 w-full rounded-2xl border-2 border-dashed cursor-pointer transition-colors duration-150 flex flex-col items-center justify-center gap-4 px-6 ${
                dragging
                  ? 'border-primary bg-primary/5'
                  : 'border-primary/30 hover:border-primary/50 hover:bg-primary/[0.02]'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-150 ${
                  dragging ? 'bg-primary/15 text-primary' : 'bg-background text-text-2'
                }`}
              >
                <Upload size={26} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-text-1">Upload receipt or screenshot</p>
                <p className="text-xs text-text-2">or drag and drop here</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                className="px-5 h-9 bg-primary text-white text-sm font-semibold rounded-xl touch-manipulation cursor-pointer hover:opacity-90 transition-opacity duration-150"
              >
                Choose file
              </button>
            </div>
          )}

          {/* AI note */}
          {(status === 'idle' || status === 'previewing') && (
            <div className="flex items-start gap-2.5">
              <ScanLine size={16} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-text-2 leading-relaxed">
                AI automatically detects receipt or mileage and extracts merchant, amount, date, and category.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
