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
  User,
  Calendar,
  FileText,
  Heart,
  Shield,
  Reply,
  Eye,
  Phone,
  ExternalLink,
  CheckCircle,
  AlertOctagon,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { NotificationType, Notification } from "@/lib/types"
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

// Priority levels for visual hierarchy
const notificationPriority = {
  [NotificationType.EMERGENCY_ALERT]: 'critical',
  [NotificationType.CARE_UPDATE]: 'high',
  [NotificationType.MESSAGE]: 'medium',
  [NotificationType.FAMILY_ACTIVITY]: 'medium',
  [NotificationType.SYSTEM_ANNOUNCEMENT]: 'low',
} as const

// Role icons for sender information
const roleIcons = {
  ADMIN: Shield,
  VOLUNTEER: Heart,
  MEMBER: User,
  CARE_TEAM: Info,
  SYSTEM: Bell,
} as const

/**
 * Extract sender information from notification data
 */
function extractSenderInfo(notification: Notification): {
  name?: string
  role?: string
  userId?: string
} | null {
  const data = notification.data as any

  if (!data) return null

  // Family activity notifications
  if (data.addedByName) {
    return {
      name: data.addedByName,
      role: 'MEMBER', // Default role, could be enhanced with more data
      userId: data.addedById
    }
  }

  // Creator information
  if (data.creatorName) {
    return {
      name: data.creatorName,
      role: 'MEMBER',
      userId: data.creatorId
    }
  }

  // User information (general)
  if (data.user?.name) {
    return {
      name: data.user.name,
      role: data.user.role || 'MEMBER',
      userId: data.user.id
    }
  }

  // Sender information (messages/conversations)
  if (data.sender?.name) {
    return {
      name: data.sender.name,
      role: data.sender.role || 'MEMBER',
      userId: data.sender.id
    }
  }

  return null
}

/**
 * Extract contextual source information from notification data
 */
function extractSourceInfo(notification: Notification): {
  type: string
  name?: string
  icon: any
} | null {
  const data = notification.data as any

  if (!data) return null

  // Family context
  if (data.familyName) {
    return {
      type: 'Family',
      name: data.familyName,
      icon: Users
    }
  }

  // Forum context
  if (data.forumName) {
    return {
      type: 'Forum',
      name: data.forumName,
      icon: MessageCircle
    }
  }

  // Resource context
  if (data.resourceTitle) {
    return {
      type: 'Resource',
      name: data.resourceTitle,
      icon: FileText
    }
  }

  // Conversation context
  if (data.conversationId) {
    return {
      type: 'Conversation',
      name: data.conversationTitle || 'Chat',
      icon: MessageCircle
    }
  }

  // Care plan context
  if (data.carePlan) {
    return {
      type: 'Care Plan',
      name: data.carePlan.title,
      icon: Heart
    }
  }

  // Appointment context
  if (data.appointment) {
    return {
      type: 'Appointment',
      name: data.appointment.title,
      icon: Calendar
    }
  }

  return null
}

/**
 * Generate enhanced preview text with context
 */
function generatePreviewText(notification: Notification): string {
  const data = notification.data as any
  let preview = notification.message

  // Add activity context for family activities
  if (data?.activityType) {
    switch (data.activityType) {
      case 'member_added_welcome':
        preview = `Welcome message: ${preview}`
        break
      case 'member_added_notification':
        preview = `New member alert: ${preview}`
        break
      case 'family_created':
        preview = `Family creation: ${preview}`
        break
      default:
        preview = `Activity: ${preview}`
    }
  }

  // Add resource context
  if (data?.resourceType) {
    preview = `${data.resourceType}: ${preview}`
  }

  // Truncate to reasonable length
  return preview.length > 150 ? preview.slice(0, 150) + '...' : preview
}

/**
 * Get priority styling based on notification type
 */
function getPriorityStyles(notification: Notification) {
  const priority = notificationPriority[notification.type]
  const baseStyles = "transition-all duration-200 hover:shadow-md border-2"

  if (!notification.isRead) {
    switch (priority) {
      case 'critical':
        return cn(baseStyles, "border-l-4 border-l-red-600 bg-red-50/50 hover:bg-red-50/70")
      case 'high':
        return cn(baseStyles, "border-l-4 border-l-amber-500 bg-amber-50/50 hover:bg-amber-50/70")
      case 'medium':
        return cn(baseStyles, "border-l-4 border-l-primary bg-primary/3 hover:bg-primary/5")
      default:
        return cn(baseStyles, "border-l-4 border-l-muted-foreground bg-muted/20 hover:bg-muted/30")
    }
  }

  return cn(baseStyles, "border-muted hover:border-muted-foreground/50")
}

/**
 * Generate contextual action buttons based on notification type and data
 */
function getContextualActions(notification: Notification): {
  icon: any
  label: string
  action: () => void
  variant?: "default" | "outline" | "destructive" | "ghost"
  primary?: boolean
}[] {
  const actions: any[] = []
  const data = notification.data as any

  switch (notification.type) {
    case NotificationType.MESSAGE:
      if (notification.actionUrl) {
        actions.push({
          icon: Eye,
          label: "View",
          action: () => window.location.href = notification.actionUrl!,
          variant: "default",
          primary: true
        })
      }
      if (data?.conversationId) {
        actions.push({
          icon: Reply,
          label: "Reply",
          action: () => window.location.href = `/chat/${data.conversationId}`,
          variant: "outline"
        })
      }
      break

    case NotificationType.CARE_UPDATE:
      if (notification.actionUrl) {
        actions.push({
          icon: Eye,
          label: "View Details",
          action: () => window.location.href = notification.actionUrl!,
          variant: "default",
          primary: true
        })
      }
      actions.push({
        icon: CheckCircle,
        label: "Acknowledge",
        action: () => console.log("Acknowledged care update"),
        variant: "outline"
      })
      if (data?.appointment) {
        actions.push({
          icon: Calendar,
          label: "Add to Calendar",
          action: () => console.log("Add to calendar"),
          variant: "ghost"
        })
      }
      break

    case NotificationType.EMERGENCY_ALERT:
      if (notification.actionUrl) {
        actions.push({
          icon: AlertOctagon,
          label: "Respond Now",
          action: () => window.location.href = notification.actionUrl!,
          variant: "destructive",
          primary: true
        })
      }
      if (data?.careTeamPhone) {
        actions.push({
          icon: Phone,
          label: "Call Care Team",
          action: () => window.location.href = `tel:${data.careTeamPhone}`,
          variant: "outline"
        })
      }
      break

    case NotificationType.FAMILY_ACTIVITY:
      if (notification.actionUrl) {
        actions.push({
          icon: Eye,
          label: "View Family",
          action: () => window.location.href = notification.actionUrl!,
          variant: "default",
          primary: true
        })
      }
      if (data?.familyId) {
        actions.push({
          icon: Users,
          label: "Manage",
          action: () => window.location.href = `/families/${data.familyId}`,
          variant: "outline"
        })
      }
      break

    case NotificationType.SYSTEM_ANNOUNCEMENT:
      if (notification.actionUrl) {
        actions.push({
          icon: ExternalLink,
          label: "Learn More",
          action: () => window.open(notification.actionUrl!, '_blank'),
          variant: "outline"
        })
      }
      actions.push({
        icon: CheckCircle,
        label: "Dismiss",
        action: () => console.log("Dismissed announcement"),
        variant: "ghost"
      })
      break
  }


  return actions
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
      <Card className="p-2">
        <CardContent className="p-4 text-center">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-red-500/60" />
          <h3 className="text-sm font-semibold mb-1 text-red-600">Failed to load notifications</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Notifications</h1>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                {unreadCount}
              </Badge>
            )}
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
              className="min-h-[32px] h-8 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1.5" />
              Mark All Read
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          View and manage all your notifications
        </p>
      </div>

      {/* Filters */}
      <Card className="p-2">
        <div className="flex gap-2">
          <Select value={filter} onValueChange={(value: "all" | "unread") => setFilter(value)}>
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(value: NotificationType | "all") => setTypeFilter(value)}>
            <SelectTrigger className="w-40 h-8 text-sm">
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
      </Card>

      {/* Notifications list - Mobile optimized spacing */}
      <div className="space-y-2 sm:space-y-1">
        {isLoading ? (
          <Card className="p-2">
            <CardContent className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto mb-2" />
              <p className="text-sm font-medium">Loading notifications...</p>
              <p className="text-xs text-muted-foreground">Please wait while we fetch your updates</p>
            </CardContent>
          </Card>
        ) : filteredNotifications.length === 0 ? (
          <Card className="p-2">
            <CardContent className="p-4 text-center">
              <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
              <h3 className="text-sm font-semibold mb-1">No notifications found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {filter === "unread"
                  ? "You're all caught up! No unread notifications to show."
                  : "You don't have any notifications yet. When you receive updates, they'll appear here."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification) => {
            const Icon = notificationTypeIcons[notification.type] || Bell
            const senderInfo = extractSenderInfo(notification)
            const sourceInfo = extractSourceInfo(notification)
            const previewText = generatePreviewText(notification)
            const priority = notificationPriority[notification.type]
            const RoleIcon = senderInfo?.role ? roleIcons[senderInfo.role as keyof typeof roleIcons] || User : null
            const SourceIcon = sourceInfo?.icon || null

            return (
              <Card
                key={notification.id}
                className={cn(
                  getPriorityStyles(notification),
                  notification.actionUrl && "cursor-pointer hover:shadow-lg transition-shadow",
                  "group"
                )}
                onClick={() => {
                  if (notification.actionUrl) {
                    window.location.href = notification.actionUrl
                  }
                }}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Main notification icon with priority styling */}
                    <div className={cn(
                      "p-2 rounded-lg flex-shrink-0 border",
                      notification.isRead ? "bg-muted/40 border-muted" : cn(
                        "border-current",
                        priority === 'critical' && "bg-red-100 text-red-600",
                        priority === 'high' && "bg-amber-100 text-amber-600",
                        priority === 'medium' && "bg-blue-100 text-blue-600",
                        priority === 'low' && "bg-gray-100 text-gray-600"
                      )
                    )}>
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          notification.isRead
                            ? "text-muted-foreground"
                            : "text-current"
                        )}
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1 sm:space-y-2">
                      {/* Header with title, sender, and type - Mobile stacked layout */}
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={cn(
                            "text-sm sm:text-base font-medium leading-tight flex-1",
                            !notification.isRead && "font-semibold text-foreground"
                          )}>
                            {notification.title}
                          </h4>

                          <Badge
                            variant={priority === 'critical' ? 'destructive' : 'secondary'}
                            className="text-xs px-2 py-1 font-medium flex-shrink-0"
                          >
                            {notificationTypeLabels[notification.type]}
                          </Badge>
                        </div>

                        {/* Sender information - Better mobile spacing */}
                        {senderInfo && (
                          <div className="flex items-center gap-1.5">
                            {RoleIcon && <RoleIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                            <span className="text-xs text-muted-foreground font-medium">
                              {senderInfo.name}
                              {senderInfo.role && (
                                <span className="hidden sm:inline">
                                  {` • ${senderInfo.role.toLowerCase().replace('_', ' ')}`}
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Enhanced message preview - Better mobile readability */}
                      <p className={cn(
                        "text-sm sm:text-base leading-relaxed",
                        notification.isRead
                          ? "text-muted-foreground"
                          : "text-foreground/90"
                      )}>
                        {previewText}
                      </p>

                      {/* Footer with source info and timestamp */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          {sourceInfo && (
                            <>
                              <SourceIcon className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                in {sourceInfo.name}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-medium">
                            {formatTimeAgo(new Date(notification.createdAt))}
                          </span>

                          {/* Priority indicator dot */}
                          {!notification.isRead && (
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              priority === 'critical' && "bg-red-500",
                              priority === 'high' && "bg-amber-500",
                              priority === 'medium' && "bg-blue-500",
                              priority === 'low' && "bg-gray-400"
                            )} />
                          )}
                        </div>
                      </div>

                      {/* Contextual Action Buttons - Mobile optimized */}
                      {getContextualActions(notification).length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-3 mt-2 border-t border-muted/30">
                          {getContextualActions(notification).slice(0, 3).map((action, index) => {
                            const ActionIcon = action.icon
                            return (
                              <Button
                                key={index}
                                variant={action.variant || "outline"}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation() // Prevent card click
                                  action.action()
                                }}
                                className={cn(
                                  "h-9 px-3 text-xs font-medium gap-1.5 min-w-[44px]", // 44px minimum touch target for mobile
                                  "sm:h-7 sm:px-2 sm:gap-1", // Smaller on desktop
                                  action.primary && "font-semibold"
                                )}
                              >
                                <ActionIcon className="h-3 w-3 flex-shrink-0" />
                                <span className="hidden sm:inline">{action.label}</span>
                                <span className="sm:hidden sr-only">{action.label}</span>
                              </Button>
                            )
                          })}

                          {/* Show overflow indicator if more than 3 actions */}
                          {getContextualActions(notification).length > 3 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0 text-muted-foreground min-w-[44px] sm:h-7 sm:w-7"
                              title={`${getContextualActions(notification).length - 3} more actions`}
                            >
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons - Mobile optimized */}
                    <div className="flex items-start gap-1 sm:gap-1 flex-shrink-0">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation() // Prevent card click
                            handleMarkAsRead(notification.id)
                          }}
                          className="h-9 w-9 p-0 hover:bg-accent min-w-[44px] sm:h-8 sm:w-8 sm:min-w-[32px]"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation() // Prevent card click
                          handleDelete(notification.id)
                        }}
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-orange-600 hover:bg-orange-100 min-w-[44px] sm:h-8 sm:w-8 sm:min-w-[32px]"
                        title="Delete notification"
                      >
                        <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
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