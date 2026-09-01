import * as React from 'react'
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/types'

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
      {...props}
    />
  )
}

// Full literal class names so Tailwind's static scanner can find them
// (a template/concat string like `bg-category-${category}` would not be detected).
const CATEGORY_BG: Record<Category, string> = {
  activity: 'bg-category-activity',
  meal: 'bg-category-meal',
  chore: 'bg-category-chore',
  project: 'bg-category-project',
  appointment: 'bg-category-appointment',
  milestone: 'bg-category-milestone',
  note: 'bg-category-note',
}

export const CATEGORY_TEXT: Record<Category, string> = {
  activity: 'text-category-activity',
  meal: 'text-category-meal',
  chore: 'text-category-chore',
  project: 'text-category-project',
  appointment: 'text-category-appointment',
  milestone: 'text-category-milestone',
  note: 'text-category-note',
}

export const CATEGORY_BORDER: Record<Category, string> = {
  activity: 'border-category-activity',
  meal: 'border-category-meal',
  chore: 'border-category-chore',
  project: 'border-category-project',
  appointment: 'border-category-appointment',
  milestone: 'border-category-milestone',
  note: 'border-category-note',
}

export function CategoryDot({ category, className }: { category: Category; className?: string }) {
  return (
    <span className={cn('inline-block h-2.5 w-2.5 rounded-full', CATEGORY_BG[category], className)} aria-hidden />
  )
}
