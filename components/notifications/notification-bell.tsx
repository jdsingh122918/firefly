"use client";

import React, { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationCenter } from "./notification-center";

export interface NotificationBellProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "ghost";
  showCount?: boolean;
  maxDisplayCount?: number;
}

export function NotificationBell({
  className,
  size = "md",
  variant = "ghost",
  showCount = true,
  maxDisplayCount = 99,
}: NotificationBellProps) {
  const { unreadCount, isConnected } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background text-foreground hover:bg-accent",
    ghost: "text-foreground hover:bg-accent",
  };

  const displayCount = unreadCount > maxDisplayCount ? `${maxDisplayCount}+` : unreadCount.toString();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "relative flex items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        {unreadCount > 0 ? (
          <BellRing className={cn(iconSizes[size], "animate-pulse")} />
        ) : (
          <Bell className={iconSizes[size]} />
        )}

        {/* Connection indicator */}
        <div
          className={cn(
            "absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full transition-all duration-300",
            isConnected
              ? "bg-green-500 animate-pulse"
              : "bg-gray-400 animate-none"
          )}
          title={isConnected ? "Connected" : "Disconnected"}
        />

        {/* Unread count badge */}
        {showCount && unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 flex items-center justify-center bg-red-500 text-white text-xs font-semibold rounded-full px-1 animate-pulse">
            {displayCount}
          </div>
        )}

        {/* Activity pulse for new notifications */}
        {unreadCount > 0 && (
          <div className="absolute inset-0 rounded-full bg-current opacity-20 animate-ping" />
        )}
      </button>

      {/* Notification Center */}
      <NotificationCenter
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

// Compact version for smaller spaces
export function NotificationBellCompact({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const { unreadCount, isConnected } = useNotifications();

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all duration-200 touch-manipulation",
        "min-h-[44px] min-w-[44px] flex items-center justify-center", // Touch-friendly size
        className
      )}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
    >
      {unreadCount > 0 ? (
        <BellRing className="h-5 w-5 transition-transform duration-200" />
      ) : (
        <Bell className="h-5 w-5 transition-transform duration-200" />
      )}

      {/* Unread count badge - more prominent */}
      {unreadCount > 0 && (
        <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center px-1 animate-pulse">
          {unreadCount > 99 ? "99+" : unreadCount}
        </div>
      )}

      {/* Connection status - improved positioning */}
      <div
        className={cn(
          "absolute bottom-1 left-1 w-2 h-2 rounded-full transition-all duration-300",
          isConnected
            ? "bg-green-500 animate-pulse"
            : "bg-gray-400"
        )}
        title={isConnected ? "Connected" : "Disconnected"}
      />
    </button>
  );
}

// Hook for managing notification bell state across components
export function useNotificationBell() {
  const { unreadCount, isConnected, error } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const openNotifications = () => setIsOpen(true);
  const closeNotifications = () => setIsOpen(false);
  const toggleNotifications = () => setIsOpen(!isOpen);

  return {
    unreadCount,
    isConnected,
    hasError: !!error,
    error,
    isOpen,
    openNotifications,
    closeNotifications,
    toggleNotifications,
  };
}