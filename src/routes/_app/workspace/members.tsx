import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Users, UserPlus, Upload, X, Copy, Check } from 'lucide-react'
import { useAuth } from '#/context/AuthContext'
import { useWorkspace } from '#/context/WorkspaceContext'
import { Avatar } from '#/components/Avatar'
import { formatCurrency, getInitials } from '#/lib/format'
import { useQuery } from '@tanstack/react-query'
import { fetchWorkspaceMembers, createInvite } from '#/lib/queries'
import { queryKeys } from '#/lib/queryKeys'
import type { UserRole, WorkspaceMember } from '#/lib/types'

export const Route = createFileRoute('/_app/workspace/members')({
  component: WorkspaceMembersScreen,
})

function WorkspaceMembersScreen() {
  const { role, user } = useAuth()
  const { current } = useWorkspace()
  const { data: members = [] } = useQuery({
    queryKey: queryKeys.workspaceMembers(),
    queryFn: fetchWorkspaceMembers,
  })
  const isOwner = role === 'owner'
  const [showModal, setShowModal] = useState(false)
  const [inviteFields, setInviteFields] = useState({ email: '', role: 'member' as 'member' | 'admin' })
  const [inviteError, setInviteError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)

  const ROLE_BADGE: Record<UserRole, string> = {
    member: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    admin: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    owner: 'bg-primary/10 text-primary',
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError('')
    if (!inviteFields.email.includes('@')) {
      setInviteError('Enter a valid email address')
      return
    }
    if (!user) return
    setInviteLoading(true)
    try {
      const code = await createInvite(current.id, user.id, inviteFields.email, inviteFields.role)
      const link = `${window.location.origin}/join/${code}`
      setInviteLink(link)
    } catch {
      setInviteError('Failed to generate invite. Please try again.')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const closeModal = () => {
    setShowModal(false)
    setInviteFields({ email: '', role: 'member' })
    setInviteError('')
    setInviteLink('')
    setCopied(false)
  }

  return (
    <div>
      <div className="mt-3 mx-4">
        {isOwner && (
          <div className="flex justify-end gap-1.5 mb-3">
            <button
              onClick={() => setShowModal(true)}
              aria-label="Invite member"
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors duration-150 cursor-pointer"
            >
              <UserPlus size={14} />
              Invite
            </button>
            <button
              aria-label="Batch import via CSV"
              className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-text-2 border border-border rounded-lg hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer"
            >
              <Upload size={14} />
              CSV
            </button>
          </div>
        )}

        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          {members.map((member, i) => (
            <div
              key={member.id}
              className={`flex items-center gap-3 px-4 py-3 animate-fade-in-up ${
                i > 0 ? 'border-t border-border' : ''
              }`}
              style={{ '--stagger-delay': `${i * 40}ms` } as React.CSSProperties}
            >
              <Avatar initials={getInitials(member.name)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-text-1">{member.name}</p>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${ROLE_BADGE[member.role]}`}
                  >
                    {member.role}
                  </span>
                </div>
                <p className="text-xs text-text-2 mt-0.5">{member.department ?? '—'}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-text-1 tabular-nums">
                  {formatCurrency(member.totalExpenses)}
                </p>
                {member.pendingExpenses > 0 && (
                  <p className="text-xs text-primary mt-0.5">{member.pendingExpenses} pending</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-text-2 text-center mt-3">
          {members.length} members · {current.name}
        </p>
      </div>

      {/* Invite modal */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={closeModal}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-modal-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-sm mx-auto bg-surface rounded-2xl border border-border shadow-2xl p-5 animate-fade-in-up"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="invite-modal-title" className="text-sm font-semibold text-text-1 flex items-center gap-2">
                <Users size={16} className="text-primary" />
                Invite member
              </h2>
              <button
                onClick={closeModal}
                aria-label="Close"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-text-2 hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {!inviteLink ? (
              <form onSubmit={handleInviteSubmit} noValidate className="space-y-3">
                <div>
                  <label htmlFor="invite-email" className="block text-xs font-medium text-text-1 mb-1">
                    Email <span className="text-danger">*</span>
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    autoComplete="email"
                    value={inviteFields.email}
                    onChange={(e) => {
                      setInviteFields((f) => ({ ...f, email: e.target.value }))
                      setInviteError('')
                    }}
                    placeholder="colleague@example.com"
                    className="w-full h-11 px-3 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {inviteError && (
                    <p role="alert" className="mt-1 text-xs text-danger">{inviteError}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="invite-role" className="block text-xs font-medium text-text-1 mb-1">
                    Role
                  </label>
                  <select
                    id="invite-role"
                    value={inviteFields.role}
                    onChange={(e) => setInviteFields((f) => ({ ...f, role: e.target.value as 'member' | 'admin' }))}
                    className="w-full h-11 px-3 text-sm border border-border rounded-xl bg-surface text-text-1 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={inviteLoading}
                  aria-busy={inviteLoading}
                  className="w-full h-11 bg-primary text-white text-sm font-semibold rounded-xl disabled:opacity-50 touch-manipulation cursor-pointer transition-opacity duration-150"
                >
                  {inviteLoading ? 'Generating…' : 'Generate invite link'}
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-text-2">
                  Share this link with <strong className="text-text-1">{inviteFields.email}</strong>.
                  They'll join as <strong className="text-text-1 capitalize">{inviteFields.role}</strong>.
                </p>
                <div className="flex items-center gap-2 p-3 bg-background rounded-xl border border-border">
                  <p className="flex-1 text-xs text-text-2 truncate font-mono">{inviteLink}</p>
                  <button
                    onClick={handleCopy}
                    aria-label="Copy invite link"
                    className="shrink-0 flex items-center gap-1 text-xs font-semibold text-primary cursor-pointer"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={closeModal}
                  className="w-full h-10 border border-border text-text-2 text-sm font-medium rounded-xl hover:bg-nav-hover-bg transition-colors duration-150 cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
