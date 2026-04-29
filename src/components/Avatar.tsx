interface AvatarProps {
  initials: string
  size?: 'sm' | 'md'
}

export function Avatar({ initials, size = 'md' }: AvatarProps) {
  const cls = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div
      className={`${cls} rounded-full bg-primary-light text-primary font-semibold flex items-center justify-center select-none shrink-0`}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}
