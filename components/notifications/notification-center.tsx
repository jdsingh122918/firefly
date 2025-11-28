"use client";

import React, { useState } from "react";
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  MessageCircle,
  Info,
  AlertTriangle,
  Users,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Notification, NotificationType } from "@/lib/types";
import { useNotifications } from "@/hooks/use-notifications";
import { ConnectionStatusBanner } from "./connection-status-banner";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

export interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const notificationTypeIcons = {
  [NotificationType.MESSAGE]: MessageCircle,
  [NotificationType.CARE_UPDATE]: Info,
  [NotificationType.EMERGENCY_ALERT]: AlertTriangle,
  [NotificationType.SYSTEM_ANNOUNCEMENT]: Bell,
  [NotificationType.FAMILY_ACTIVITY]: Users,
};

const notificationTypeLabels = {
  [NotificationType.MESSAGE]: "Message",
  [NotificationType.CARE_UPDATE]: "Care Update",
  [NotificationType.EMERGENCY_ALERT]: "Emergency Alert",
  [NotificationType.SYSTEM_ANNOUNCEMENT]: "Announcement",
  [NotificationType.FAMILY_ACTIVITY]: "Family Activity",
};

const notificationTypeColors = {
  [NotificationType.MESSAGE]: "text-blue-600",
  [NotificationType.CARE_UPDATE]: "text-green-600",
  [NotificationType.EMERGENCY_ALERT]: "text-red-600",
  [NotificationType.SYSTEM_ANNOUNCEMENT]: "text-purple-600",
  [NotificationType.FAMILY_ACTIVITY]: "text-yellow-600",
};

export function NotificationCenter({ isOpen, onClose, className }: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    error,
    connectionState,
    lastRefreshedAt,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    reconnect,
  } = useNotifications();
  const router = useRouter();
  const { sessionClaims } = useAuth();

  const [filter, setFilter] = useState<"all" | "unread" | NotificationType>("all");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Get user role from session metadata
  const getUserRole = () => {
    const metadata = sessionClaims?.metadata as { role?: string } | undefined;
    return metadata?.role?.toLowerCase() || 'member';
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === "all") return true;
    if (filter === "unread") return !notification.isRead;
    return notification.type === filter;
  });

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    if (minutes < 10080) return `${Math.floor(minutes / 1440)}d ago`;
    return date.toLocaleDateString();
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    setIsDeleting(notificationId);
    try {
      await deleteNotification(notificationId);
    } catch (error) {
      console.error("Failed to delete notification:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleAction = async (notification: Notification) => {
    let targetUrl: string | null = null;

    // For MESSAGE notifications, construct URL dynamically with current role
    if (notification.type === NotificationType.MESSAGE) {
      const messageData = notification.data as Record<string, unknown>;
      if (messageData?.conversationId) {
        const role = getUserRole();
        targetUrl = `/${role}/chat/${messageData.conversationId}`;
      }
    }

    // Fall back to actionUrl for other types or if no conversationId
    if (!targetUrl && notification.actionUrl) {
      targetUrl = notification.actionUrl;
    }

    // Mark as read BEFORE navigation so notification disappears immediately
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }

    if (targetUrl) {
      router.push(targetUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full md:w-96 bg-background shadow-xl z-50",
          "transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshNotifications?.()}
              disabled={isRefreshing}
              className="p-2 hover:bg-accent rounded-full transition-colors"
              aria-label="Refresh notifications"
              title="Refresh notifications"
            >
              <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-full transition-colors"
              aria-label="Close notifications"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Connection Status */}
        {connectionState !== 'connected' && (
          <div className="px-4 pt-2">
            <ConnectionStatusBanner
              connectionState={connectionState}
              lastRefreshedAt={lastRefreshedAt}
              isRefreshing={isRefreshing}
              error={error}
              onReconnect={reconnect}
              onRefresh={refreshNotifications}
            />
          </div>
        )}

        {/* Filters and Actions */}
        <div className="p-4 border-b border-border bg-muted/20 space-y-3">
          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "px-3 py-1 text-sm rounded-full transition-colors",
                filter === "all"
                  ? "bg-primary/20 text-primary font-medium"
                  : "bg-accent text-accent-foreground hover:bg-accent/80"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={cn(
                "px-3 py-1 text-sm rounded-full transition-colors",
                filter === "unread"
                  ? "bg-primary/20 text-primary font-medium"
                  : "bg-accent text-accent-foreground hover:bg-accent/80"
              )}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Type filters */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(notificationTypeLabels).map(([type, label]) => {
              const Icon = notificationTypeIcons[type as NotificationType];
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type as NotificationType)}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1 text-sm rounded-full transition-colors",
                    filter === type
                      ? "bg-primary/20 text-primary font-medium"
                      : "bg-accent text-accent-foreground hover:bg-accent/80"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          {unreadCount > 0 && (
            <div className="flex items-center justify-between">
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 px-3 py-1 text-sm text-primary hover:text-primary/80 hover:bg-primary/10 rounded-md transition-colors"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all as read
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {error && (
            <div className="p-4 text-center text-destructive">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!isLoading && !error && filteredNotifications.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {filter === "unread" ? "No unread notifications" : "No notifications"}
              </h3>
              <p className="text-muted-foreground text-sm">
                {filter === "unread"
                  ? "You're all caught up!"
                  : "When you receive notifications, they'll appear here."}
              </p>
            </div>
          )}

          {!isLoading && !error && filteredNotifications.length > 0 && (
            <div className="space-y-2 p-2">
              {filteredNotifications.map((notification) => {
                const Icon = notificationTypeIcons[notification.type] || Bell;
                const colorClass = notificationTypeColors[notification.type];

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 rounded-lg border border-border transition-colors group cursor-pointer",
                      notification.isRead
                        ? "bg-card hover:bg-accent/50"
                        : "bg-accent/20 hover:bg-accent/30"
                    )}
                    onClick={() => handleAction(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("flex-shrink-0 mt-0.5", colorClass)}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3
                            className={cn(
                              "font-medium text-sm",
                              notification.isRead ? "text-card-foreground" : "text-card-foreground font-semibold"
                            )}
                          >
                            {notification.title}
                          </h3>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!notification.isRead && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(notification.id);
                                }}
                                className="p-1 hover:bg-primary/20 rounded transition-colors"
                                title="Mark as read"
                              >
                                <Check className="h-3 w-3 text-primary" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(notification.id);
                              }}
                              disabled={isDeleting === notification.id}
                              className="p-1 hover:bg-destructive/20 rounded transition-colors"
                              title="Delete"
                            >
                              {isDeleting === notification.id ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b border-destructive" />
                              ) : (
                                <Trash2 className="h-3 w-3 text-destructive" />
                              )}
                            </button>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {notification.message}
                        </p>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(notification.createdAt)}
                          </span>

                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs font-medium", colorClass)}>
                              {notificationTypeLabels[notification.type]}
                            </span>
                            {!notification.isRead && (
                              <div className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-muted/20">
          <button
            onClick={() => {
              // Navigate to notification settings
              console.log("Navigate to notification settings");
            }}
            className="flex items-center gap-2 w-full p-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <Settings className="h-4 w-4" />
            Notification Settings
          </button>
        </div>
      </div>
    </>
  );
}