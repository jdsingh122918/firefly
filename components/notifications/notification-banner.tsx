"use client";

import React, { useState } from "react";
import {
  Bell,
  MessageCircle,
  Info,
  AlertTriangle,
  Users,
  Calendar,
  Reply,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";
import { Notification, NotificationType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

export interface NotificationBannerProps {
  className?: string;
  maxDisplayCount?: number;
  showOnlyActionable?: boolean;
  position?: "top" | "bottom";
}

const notificationTypeIcons = {
  [NotificationType.MESSAGE]: MessageCircle,
  [NotificationType.CARE_UPDATE]: Info,
  [NotificationType.EMERGENCY_ALERT]: AlertTriangle,
  [NotificationType.SYSTEM_ANNOUNCEMENT]: Bell,
  [NotificationType.FAMILY_ACTIVITY]: Users,
};

const notificationTypeBadgeColors = {
  [NotificationType.MESSAGE]: "bg-blue-500",
  [NotificationType.CARE_UPDATE]: "bg-green-500",
  [NotificationType.EMERGENCY_ALERT]: "bg-red-500",
  [NotificationType.SYSTEM_ANNOUNCEMENT]: "bg-purple-500",
  [NotificationType.FAMILY_ACTIVITY]: "bg-orange-500",
};

export function NotificationBanner({
  className,
  maxDisplayCount = 3,
  showOnlyActionable = false,
  position = "top",
}: NotificationBannerProps) {
  const { notifications, unreadCount, markAsRead, isConnected } = useNotifications();
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();
  const { sessionClaims } = useAuth();

  // Get user role from session metadata
  const getUserRole = () => {
    const metadata = sessionClaims?.metadata as { role?: string } | undefined;
    return metadata?.role?.toLowerCase() || 'member';
  };

  // Filter to unread notifications
  const unreadNotifications = notifications.filter(n => !n.isRead);

  // Filter for actionable notifications if required
  const displayNotifications = showOnlyActionable
    ? unreadNotifications.filter(n => n.isActionable)
    : unreadNotifications;

  // Determine how many to show
  const visibleNotifications = isExpanded
    ? displayNotifications
    : displayNotifications.slice(0, maxDisplayCount);

  const hasMoreNotifications = displayNotifications.length > maxDisplayCount;

  // Don't render if no notifications
  if (unreadCount === 0 || displayNotifications.length === 0) {
    return null;
  }

  const handleAction = async (notification: Notification, actionType: string) => {
    try {
      switch (actionType) {
        case "mark-read":
          await markAsRead(notification.id);
          break;

        case "mark-unread":
          // Note: This would require a markAsUnread function
          console.log("Mark as unread not yet implemented");
          break;

        case "view":
          // For MESSAGE notifications, use data.conversationId with role-based routing
          if (notification.type === NotificationType.MESSAGE) {
            const messageData = notification.data as any;
            if (messageData?.conversationId) {
              const role = getUserRole();
              router.push(`/${role}/chat/${messageData.conversationId}`);
            }
          } else if (notification.actionUrl) {
            router.push(notification.actionUrl);
          }
          break;

        case "external":
          if (notification.actionUrl) {
            window.open(notification.actionUrl, "_blank");
          }
          break;

        case "calendar":
          // Extract calendar data from notification.data
          const calendarData = notification.data as any;
          if (calendarData?.eventDate && calendarData?.eventTitle) {
            // Create calendar event (this would integrate with calendar system)
            console.log("Adding to calendar:", calendarData);
            // For now, just mark as read
            await markAsRead(notification.id);
          }
          break;

        case "reply":
          // Navigate to conversation/reply page
          const messageData = notification.data as any;
          if (messageData?.conversationId) {
            const role = getUserRole();
            router.push(`/${role}/chat/${messageData.conversationId}`);
          }
          break;


        default:
          console.warn("Unknown action type:", actionType);
      }
    } catch (error) {
      console.error("Failed to handle notification action:", error);
    }
  };

  const getActionButtons = (notification: Notification) => {
    const buttons = [];

    // Always include mark as read/unread
    if (notification.isRead) {
      buttons.push({
        label: "Mark Unread",
        icon: EyeOff,
        action: "mark-unread",
        variant: "outline" as const,
      });
    } else {
      buttons.push({
        label: "Mark Read",
        icon: Eye,
        action: "mark-read",
        variant: "outline" as const,
      });
    }

    // Type-specific actions
    switch (notification.type) {
      case NotificationType.MESSAGE:
        buttons.push({
          label: "Reply",
          icon: Reply,
          action: "reply",
          variant: "default" as const,
        });
        buttons.push({
          label: "View",
          icon: ExternalLink,
          action: "view",
          variant: "outline" as const,
        });
        break;

      case NotificationType.CARE_UPDATE:
        buttons.push({
          label: "View Details",
          icon: ExternalLink,
          action: "view",
          variant: "default" as const,
        });
        break;

      case NotificationType.SYSTEM_ANNOUNCEMENT:
        // Check if this is a calendar event
        const data = notification.data as any;
        if (data?.eventDate) {
          buttons.push({
            label: "Save to Calendar",
            icon: Calendar,
            action: "calendar",
            variant: "default" as const,
          });
        }
        buttons.push({
          label: "Read More",
          icon: ExternalLink,
          action: "view",
          variant: "outline" as const,
        });
        break;

      case NotificationType.FAMILY_ACTIVITY:
        buttons.push({
          label: "View Activity",
          icon: Users,
          action: "view",
          variant: "default" as const,
        });
        break;

      case NotificationType.EMERGENCY_ALERT:
        buttons.push({
          label: "View Alert",
          icon: AlertTriangle,
          action: "view",
          variant: "destructive" as const,
        });
        break;

      default:
        if (notification.actionUrl) {
          buttons.push({
            label: "View",
            icon: ExternalLink,
            action: "view",
            variant: "default" as const,
          });
        }
    }

    return buttons;
  };

  return (
    <div
      className={cn(
        "w-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-sm transition-all duration-300 ease-in-out",
        position === "top" ? "border-t-0" : "border-b-0",
        "animate-in slide-in-from-top-2",
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="py-2 sm:py-3">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-900 truncate">
                {unreadCount === 1 ? "1 new notification" : `${unreadCount} new notifications`}
              </span>
              <div
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  isConnected ? "bg-green-500" : "bg-gray-400"
                )}
                title={isConnected ? "Live updates active" : "Connection offline"}
              />
            </div>

            <div className="flex items-center gap-2">
              {hasMoreNotifications && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={cn(
                    "text-xs touch-manipulation min-h-[36px]",
                    "hover:scale-105 active:scale-95 transition-all",
                    "focus:ring-2 focus:ring-offset-1 focus:outline-none"
                  )}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Show All ({displayNotifications.length})</span>
                      <span className="sm:hidden">Show All</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-2 sm:space-y-3">
            {visibleNotifications.map((notification) => {
              const IconComponent = notificationTypeIcons[notification.type];
              const actionButtons = getActionButtons(notification);

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "flex flex-col sm:flex-row items-start gap-3 p-3 sm:p-4 rounded-lg border bg-white shadow-sm transition-all duration-200 hover:shadow-md",
                    "animate-in slide-in-from-left-2 fade-in",
                    !notification.isRead && "border-l-4 border-l-blue-500",
                    notification.type === NotificationType.EMERGENCY_ALERT && "border-l-red-500 bg-red-50"
                  )}
                >
                  {/* Mobile: Icon + Content Row */}
                  <div className="flex items-start gap-3 w-full sm:flex-1">
                    {/* Icon & Badge */}
                    <div className="flex-shrink-0 relative">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white",
                          notificationTypeBadgeColors[notification.type]
                        )}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>
                      {!notification.isRead && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border border-white" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {notification.title}
                        </h4>
                        <Badge variant="secondary" className="text-xs w-fit">
                          {notification.type.toLowerCase().replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 sm:line-clamp-1">
                        {notification.message}
                      </p>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(notification.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons - Full width on mobile */}
                  <div className="w-full sm:w-auto">
                    <div className="flex flex-row sm:flex-col lg:flex-row gap-1 sm:gap-1">
                      {actionButtons.map((button, index) => {
                        const ButtonIcon = button.icon;
                        return (
                          <Button
                            key={index}
                            variant={button.variant}
                            size="sm"
                            onClick={() => handleAction(notification, button.action)}
                            className={cn(
                              "text-xs whitespace-nowrap transition-all hover:scale-105 touch-manipulation",
                              "flex-1 sm:flex-initial min-h-[36px] active:scale-95",
                              "focus:ring-2 focus:ring-offset-1 focus:outline-none"
                            )}
                          >
                            <ButtonIcon className="h-3 w-3 sm:mr-1 flex-shrink-0" />
                            <span className="ml-1 sm:inline truncate">{button.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expand/Collapse indicator */}
          {hasMoreNotifications && !isExpanded && (
            <div className="text-center mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(true)}
                className={cn(
                  "text-xs text-gray-500 hover:text-gray-700 touch-manipulation min-h-[36px]",
                  "hover:scale-105 active:scale-95 transition-all",
                  "focus:ring-2 focus:ring-offset-1 focus:outline-none"
                )}
              >
                + {displayNotifications.length - maxDisplayCount} more notification{displayNotifications.length - maxDisplayCount > 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simplified version for when space is limited
export function NotificationBannerCompact({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const { unreadCount, isConnected } = useNotifications();

  if (unreadCount === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-4 py-2 bg-blue-50 border-b border-blue-200 text-left hover:bg-blue-100 transition-colors",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-800">
            {unreadCount} new notification{unreadCount > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-gray-400"
            )}
          />
          <ChevronDown className="h-3 w-3 text-blue-600" />
        </div>
      </div>
    </button>
  );
}