import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Upload, ScanLine, X, Loader2, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react'
import { usePanel } from '#/context/PanelContext'
import { supabaseAuth } from '#/lib/supabase'

type ScanStatus = 'idle' | 'previewing' | 'uploading' | 'success' | 'error'

type QueueItem = {
  id: string
  file: File
  previewUrl: string
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
}

interface Preview {
  url: string
  blob: Blob
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

export function ScanPanel() {
  const { closePanel } = usePanel()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [closing, setClosing] = useState(false)
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [batchDone, setBatchDone] = useState(false)

  // Revoke single preview URL on change
  const prevUrl = useRef<string | null>(null)
  useEffect(() => {
    const old = prevUrl.current
    prevUrl.current = preview?.url ?? null
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

  // Auto-close + navigate when all succeed
  useEffect(() => {
    if (!batchDone || !allProcessed || errorCount > 0) return
    const timer = setTimeout(() => {
      queueItems.forEach(item => URL.revokeObjectURL(item.previewUrl))
      setQueueItems([])
      setBatchDone(false)
      setClosing(true)
      setTimeout(() => { closePanel(); navigate({ to: '/home' }) }, 150)
    }, 1400)
    return () => clearTimeout(timer)
  }, [batchDone, allProcessed, errorCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    setClosing(true)
    setTimeout(closePanel, 150)
  }

  const clearQueue = useCallback(() => {
    queueItems.forEach(item => URL.revokeObjectURL(item.previewUrl))
    setQueueItems([])
    setBatchDone(false)
  }, [queueItems])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    if (files.length === 1) {
      setPreview({ url: URL.createObjectURL(files[0]), blob: files[0] })
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (!files.length) return
    if (files.length === 1) {
      setPreview({ url: URL.createObjectURL(files[0]), blob: files[0] })
      setStatus('previewing')
    } else {
      setQueueItems(files.map(f => ({
        id: crypto.randomUUID(),
        file: f,
        previewUrl: URL.createObjectURL(f),
        status: 'queued' as const,
      })))
    }
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

  const handleBatchUpload = async () => {
    try {
      const { data: { session } } = await supabaseAuth.auth.getSession()
      if (!session) return
      await runBatchUpload(queueItems, session.access_token, setQueueItems)
    } finally {
      setBatchDone(true)
    }
  }

  const handleRetryFailed = async () => {
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
  }

  return (
    <>
      {/* Backdrop — only dismisses when idle and no queue */}
      <div
        className="fixed inset-0 z-[60] bg-black/40"
        onClick={status === 'idle' && !isInQueue ? handleClose : undefined}
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
          multiple
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

          {/* ── Queue mode ── */}
          {isInQueue && (
            <>
              <div className="flex-1 overflow-y-auto min-h-0">
                {batchDone && errorCount === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center">
                      <CheckCircle size={26} className="text-success" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-text-1">All uploaded!</p>
                      <p className="text-xs text-text-2">AI scanning in background…</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {queueItems.map(item => (
                      <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden bg-background border border-border">
                        <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
                        {item.status === 'uploading' && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 size={18} className="text-white animate-spin" />
                          </div>
                        )}
                        {item.status === 'done' && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <CheckCircle size={18} className="text-green-400" />
                          </div>
                        )}
                        {item.status === 'error' && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <AlertCircle size={18} className="text-red-400" />
                          </div>
                        )}
                        {item.status === 'queued' && !isBatchUploading && (
                          <button
                            onClick={() => setQueueItems(prev => prev.filter(i => i.id !== item.id))}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                    {!isBatchUploading && !allProcessed && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-text-2 hover:border-primary/50 hover:text-primary transition-colors duration-150 cursor-pointer"
                      >
                        <Upload size={14} />
                        <span className="text-[10px] font-medium">Add more</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!batchDone && (
                <>
                  {isBatchUploading && (
                    <p className="text-xs text-text-2 text-center">
                      Uploading {doneCount + 1} of {queueItems.length}…
                    </p>
                  )}
                  {allProcessed && errorCount > 0 && (
                    <p className="text-xs text-text-2 text-center">
                      {doneCount} of {queueItems.length} uploaded · {errorCount} failed
                    </p>
                  )}
                  {allProcessed && errorCount > 0 ? (
                    <div className="flex gap-2">
                      <button
                        onClick={clearQueue}
                        className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl border border-border text-text-1 text-sm font-semibold hover:bg-surface cursor-pointer transition-colors duration-150"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRetryFailed}
                        className="flex-1 h-11 flex items-center justify-center rounded-xl bg-primary text-white text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity duration-150"
                      >
                        Retry ({errorCount})
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={isBatchUploading ? undefined : handleBatchUpload}
                      disabled={isBatchUploading || queueItems.length === 0}
                      className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-primary text-white text-sm font-semibold cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-150"
                    >
                      {isBatchUploading
                        ? <><Loader2 size={16} className="animate-spin" /> Uploading…</>
                        : `Upload ${queueItems.length} receipt${queueItems.length !== 1 ? 's' : ''}`
                      }
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Single-file flows ── */}
          {!isInQueue && (
            <>
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
                    <p className="text-xs text-text-2">drag and drop · supports multiple files</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                    className="px-5 h-9 bg-primary text-white text-sm font-semibold rounded-xl touch-manipulation cursor-pointer hover:opacity-90 transition-opacity duration-150"
                  >
                    Choose file
                  </button>
                </div>
              )}

              {(status === 'idle' || status === 'previewing') && (
                <div className="flex items-start gap-2.5">
                  <ScanLine size={16} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-text-2 leading-relaxed">
                    AI automatically detects receipt or mileage and extracts merchant, amount, date, and category.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  )
}
