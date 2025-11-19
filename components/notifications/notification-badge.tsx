"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface NotificationBadgeProps {
  /** Number of unread notifications */
  unreadCount: number
  /** Real-time connection status */
  isConnected: boolean
  /** Badge variant style */
  variant?: 'default' | 'destructive' | 'secondary' | 'outline'
  /** Additional CSS classes */
  className?: string
  /** Show connection status indicator */
  showConnectionStatus?: boolean
}

/**
 * Reusable badge component for notification counts and connection status
 * Designed for use in navigation menus, mobile views, and other UI elements
 */
export function NotificationBadge({
  unreadCount,
  isConnected,
  variant = 'destructive',
  className,
  showConnectionStatus = true
}: NotificationBadgeProps) {
  const hasUnread = unreadCount > 0
  const badgeContent = unreadCount > 99 ? '99+' : unreadCount.toString()

  return (
    <div className="flex items-center gap-2">
      {/* Unread count badge - only show when there are unread notifications */}
      {hasUnread && (
        <Badge
          variant={variant}
          className={cn(
            "min-w-[1.25rem] h-5 text-xs font-medium px-1 animate-pulse",
            className
          )}
          aria-label={`${unreadCount} unread notifications`}
        >
          {badgeContent}
        </Badge>
      )}

      {/* Connection status indicator - small dot */}
      {showConnectionStatus && (
        <div
          className={cn(
            "w-2 h-2 rounded-full transition-all duration-300",
            isConnected
              ? "bg-[hsl(var(--status-success))] animate-pulse"
              : "bg-[hsl(var(--status-neutral))]"
          )}
          title={isConnected ? "Connected to notifications" : "Disconnected from notifications"}
          aria-label={isConnected ? "Connected" : "Disconnected"}
        />
      )}
    </div>
  )
}

/**
 * Compact version for use in collapsed sidebar or mobile contexts
 */
export function NotificationBadgeCompact({
  unreadCount,
  isConnected,
  className
}: Omit<NotificationBadgeProps, 'variant' | 'showConnectionStatus'>) {
  const hasUnread = unreadCount > 0

  if (!hasUnread && isConnected) {
    return (
      <div
        className={cn(
          "w-2 h-2 bg-[hsl(var(--status-success))] rounded-full animate-pulse",
          className
        )}
        title="Connected"
        aria-label="Connected"
      />
    )
  }

  if (!hasUnread && !isConnected) {
    return (
      <div
        className={cn(
          "w-2 h-2 bg-[hsl(var(--status-neutral))] rounded-full",
          className
        )}
        title="Disconnected"
        aria-label="Disconnected"
      />
    )
  }

  // Has unread notifications
  const badgeContent = unreadCount > 99 ? '99+' : unreadCount.toString()

  return (
    <div className="relative">
      <Badge
        variant="destructive"
        className={cn(
          "min-w-[1.25rem] h-5 text-xs font-medium px-1 animate-pulse",
          className
        )}
        aria-label={`${unreadCount} unread notifications`}
      >
        {badgeContent}
      </Badge>

      {/* Connection indicator as small dot on badge */}
      <div
        className={cn(
          "absolute -top-1 -right-1 w-2 h-2 rounded-full border border-white",
          isConnected
            ? "bg-[hsl(var(--status-success))] animate-pulse"
            : "bg-[hsl(var(--status-neutral))]"
        )}
        title={isConnected ? "Connected" : "Disconnected"}
        aria-label={isConnected ? "Connected" : "Disconnected"}
      />
    </div>
  )
}