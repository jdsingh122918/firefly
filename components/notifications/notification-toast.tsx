"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X, Bell, AlertTriangle, Info, CheckCircle, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Notification, NotificationType } from "@/lib/types";

export interface NotificationToastProps {
  notification: Notification;
  onClose: () => void;
  onMarkAsRead?: (id: string) => void;
  onAction?: (notification: Notification) => void;
  autoHideDuration?: number;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

const notificationTypeIcons = {
  [NotificationType.MESSAGE]: MessageCircle,
  [NotificationType.CARE_UPDATE]: Info,
  [NotificationType.EMERGENCY_ALERT]: AlertTriangle,
  [NotificationType.SYSTEM_ANNOUNCEMENT]: Bell,
  [NotificationType.FAMILY_ACTIVITY]: CheckCircle,
};

const notificationTypeColors = {
  [NotificationType.MESSAGE]: "border-blue-200 bg-blue-50 text-blue-900",
  [NotificationType.CARE_UPDATE]: "border-green-200 bg-green-50 text-green-900",
  [NotificationType.EMERGENCY_ALERT]: "border-red-200 bg-red-50 text-red-900",
  [NotificationType.SYSTEM_ANNOUNCEMENT]: "border-purple-200 bg-purple-50 text-purple-900",
  [NotificationType.FAMILY_ACTIVITY]: "border-yellow-200 bg-yellow-50 text-yellow-900",
};

const notificationTypeAccents = {
  [NotificationType.MESSAGE]: "text-blue-600",
  [NotificationType.CARE_UPDATE]: "text-green-600",
  [NotificationType.EMERGENCY_ALERT]: "text-red-600",
  [NotificationType.SYSTEM_ANNOUNCEMENT]: "text-purple-600",
  [NotificationType.FAMILY_ACTIVITY]: "text-yellow-600",
};

export function NotificationToast({
  notification,
  onClose,
  onMarkAsRead,
  onAction,
  autoHideDuration = 5000,
  position = "top-right",
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const Icon = notificationTypeIcons[notification.type] || Bell;

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 200);
  }, [onClose]);

  useEffect(() => {
    // Animate in - use requestAnimationFrame to avoid synchronous setState
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Auto-hide timer
    const hideTimer = setTimeout(() => {
      if (autoHideDuration > 0) {
        handleClose();
      }
    }, autoHideDuration);

    // Mark as read after a short delay if not already read
    if (!notification.isRead) {
      const readTimer = setTimeout(() => {
        onMarkAsRead?.(notification.id);
      }, 1000);

      return () => {
        clearTimeout(hideTimer);
        clearTimeout(readTimer);
      };
    }

    return () => clearTimeout(hideTimer);
  }, [notification.id, notification.isRead, autoHideDuration, onMarkAsRead, handleClose]);

  const handleAction = () => {
    if (notification.isActionable && onAction) {
      onAction(notification);
    }
    handleClose();
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
  };

  return (
    <div
      className={cn(
        "fixed z-50 w-80 p-4 border rounded-lg shadow-lg transition-all duration-200",
        notificationTypeColors[notification.type],
        positionClasses[position],
        isVisible && !isExiting
          ? "translate-x-0 opacity-100"
          : position.includes("right")
          ? "translate-x-full opacity-0"
          : "-translate-x-full opacity-0"
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className={cn("flex-shrink-0 mt-0.5", notificationTypeAccents[notification.type])}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-medium text-sm truncate">{notification.title}</h3>
            <button
              onClick={handleClose}
              className="flex-shrink-0 p-0.5 rounded-full hover:bg-black/10 transition-colors"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm text-gray-700 mb-2 line-clamp-2">
            {notification.message}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {formatTimestamp(notification.createdAt)}
            </span>

            {notification.isActionable && notification.actionUrl && (
              <button
                onClick={handleAction}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  "hover:bg-white/50",
                  notificationTypeAccents[notification.type]
                )}
              >
                View
              </button>
            )}
          </div>

          {/* Unread indicator */}
          {!notification.isRead && (
            <div className="absolute -top-1 -right-1">
              <div className={cn("w-3 h-3 rounded-full", {
                "bg-blue-500": notification.type === NotificationType.MESSAGE,
                "bg-green-500": notification.type === NotificationType.CARE_UPDATE,
                "bg-red-500": notification.type === NotificationType.EMERGENCY_ALERT,
                "bg-purple-500": notification.type === NotificationType.SYSTEM_ANNOUNCEMENT,
                "bg-yellow-500": notification.type === NotificationType.FAMILY_ACTIVITY,
              })} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Toast container for managing multiple toasts
export interface NotificationToastContainerProps {
  notifications: Notification[];
  onClose: (id: string) => void;
  onMarkAsRead?: (id: string) => void;
  onAction?: (notification: Notification) => void;
  maxToasts?: number;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

export function NotificationToastContainer({
  notifications,
  onClose,
  onMarkAsRead,
  onAction,
  maxToasts = 3,
  position = "top-right",
}: NotificationToastContainerProps) {
  // Only show the most recent notifications
  const visibleNotifications = notifications.slice(0, maxToasts);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {visibleNotifications.map((notification, index) => {
        // Calculate position offset for stacked toasts
        const offset = index * 88; // Height + margin

        const positionStyles = {
          "top-right": { top: 16 + offset, right: 16 },
          "top-left": { top: 16 + offset, left: 16 },
          "bottom-right": { bottom: 16 + offset, right: 16 },
          "bottom-left": { bottom: 16 + offset, left: 16 },
        };

        return (
          <div
            key={notification.id}
            className="pointer-events-auto absolute"
            style={positionStyles[position]}
          >
            <NotificationToast
              notification={notification}
              onClose={() => onClose(notification.id)}
              onMarkAsRead={onMarkAsRead}
              onAction={onAction}
              position={position}
            />
          </div>
        );
      })}
    </div>
  );
}