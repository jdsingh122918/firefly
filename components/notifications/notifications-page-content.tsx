"use client"

import React, { useState } from "react"
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  MessageCircle,
  Info,
  AlertTriangle,
  Users,
  Inbox,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { NotificationType } from "@/lib/types"
import { useNotifications } from "@/hooks/use-notifications"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const notificationTypeIcons = {
  [NotificationType.MESSAGE]: MessageCircle,
  [NotificationType.CARE_UPDATE]: Info,
  [NotificationType.EMERGENCY_ALERT]: AlertTriangle,
  [NotificationType.SYSTEM_ANNOUNCEMENT]: Bell,
  [NotificationType.FAMILY_ACTIVITY]: Users,
}

const notificationTypeLabels = {
  [NotificationType.MESSAGE]: "Message",
  [NotificationType.CARE_UPDATE]: "Care Update",
  [NotificationType.EMERGENCY_ALERT]: "Emergency Alert",
  [NotificationType.SYSTEM_ANNOUNCEMENT]: "Announcement",
  [NotificationType.FAMILY_ACTIVITY]: "Family Activity",
}

const notificationTypeColors = {
  [NotificationType.MESSAGE]: "text-blue-600",
  [NotificationType.CARE_UPDATE]: "text-green-600",
  [NotificationType.EMERGENCY_ALERT]: "text-red-600",
  [NotificationType.SYSTEM_ANNOUNCEMENT]: "text-purple-600",
  [NotificationType.FAMILY_ACTIVITY]: "text-yellow-600",
}

/**
 * Full-page notifications component
 * Renders notification center content without modal wrapper
 */
export function NotificationsPageContent() {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    isConnected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications({
    autoConnect: true,
    enablePollingFallback: true,
  })

  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [typeFilter, setTypeFilter] = useState<NotificationType | "all">("all")

  // Filter notifications based on current filters
  const filteredNotifications = notifications.filter((notification) => {
    const matchesReadFilter = filter === "all" ||
      (filter === "unread" && !notification.isRead)

    const matchesTypeFilter = typeFilter === "all" ||
      notification.type === typeFilter

    return matchesReadFilter && matchesTypeFilter
  })

  const formatTimeAgo = (date: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
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
    }).format(date)
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id)
    } catch (error) {
      console.error("Failed to mark notification as read:", error instanceof Error ? error.message : 'Unknown error')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead()
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error instanceof Error ? error.message : 'Unknown error')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id)
    } catch (error) {
      console.error("Failed to delete notification:", error instanceof Error ? error.message : 'Unknown error')
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-medium">Failed to load notifications</p>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Inbox className="h-6 w-6" />
              <CardTitle className="text-xl">
                Notifications {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount}
                  </Badge>
                )}
              </CardTitle>
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  isConnected ? "bg-green-500" : "bg-gray-400"
                )}
                title={isConnected ? "Connected" : "Disconnected"}
              />
            </div>

            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-4 pt-4">
            <Select value={filter} onValueChange={(value: "all" | "unread") => setFilter(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(value: NotificationType | "all") => setTypeFilter(value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(notificationTypeLabels).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Notifications list */}
      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p>Loading notifications...</p>
            </CardContent>
          </Card>
        ) : filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">No notifications</p>
              <p className="text-sm text-muted-foreground mt-2">
                {filter === "unread"
                  ? "You're all caught up! No unread notifications."
                  : "You don't have any notifications yet."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification) => {
            const Icon = notificationTypeIcons[notification.type] || Bell
            return (
              <Card
                key={notification.id}
                className={cn(
                  "transition-colors hover:bg-muted/50",
                  !notification.isRead && "border-l-4 border-l-primary"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-lg flex-shrink-0",
                      notification.isRead ? "bg-muted" : "bg-primary/10"
                    )}>
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          notification.isRead
                            ? "text-muted-foreground"
                            : notificationTypeColors[notification.type]
                        )}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={cn(
                          "text-sm font-medium truncate",
                          !notification.isRead && "font-semibold"
                        )}>
                          {notification.title}
                        </h4>
                        <Badge variant="secondary" className="text-xs">
                          {notificationTypeLabels[notification.type]}
                        </Badge>
                      </div>

                      <p className={cn(
                        "text-sm text-muted-foreground line-clamp-2",
                        !notification.isRead && "text-foreground"
                      )}>
                        {notification.message}
                      </p>

                      <p className="text-xs text-muted-foreground mt-2">
                        {formatTimeAgo(new Date(notification.createdAt))}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="h-8 w-8 p-0"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(notification.id)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                        title="Delete notification"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}