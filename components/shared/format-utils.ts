/**
 * Shared formatting utilities used across Notes and Forums
 * Centralized to avoid duplication and ensure consistency
 */

export function formatTimeAgo(date: string | Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(date))
}

export function getAuthorName(author: {
  name?: string
  firstName?: string
  lastName?: string
  email?: string
}): string {
  return author.name ||
    `${author.firstName || ''} ${author.lastName || ''}`.trim() ||
    author.email ||
    'Unknown User'
}

export function getInitials(author: {
  name?: string
  firstName?: string
  lastName?: string
  email?: string
}): string {
  const name = getAuthorName(author)
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function getAuthorDisplay(author: {
  name?: string
  firstName?: string
  lastName?: string
  email?: string
}): { name: string; initials: string } {
  const name = getAuthorName(author)
  const initials = getInitials(author)

  return { name, initials }
}