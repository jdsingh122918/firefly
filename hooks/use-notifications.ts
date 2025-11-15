"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { Notification, NotificationType } from "@/lib/types";

interface NotificationHookState {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseNotificationsOptions {
  limit?: number;
  autoConnect?: boolean;
  onNewNotification?: (notification: Notification) => void;
  onUnreadCountChange?: (count: number) => void;
  onConnectionChange?: (connected: boolean) => void;
  enablePollingFallback?: boolean;
  pollingInterval?: number;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    limit = 20,
    autoConnect = true,
    onNewNotification,
    onUnreadCountChange,
    onConnectionChange,
    enablePollingFallback = true,
    pollingInterval = 30000, // 30 seconds
  } = options;

  const { isSignedIn, getToken } = useAuth();
  const [state, setState] = useState<NotificationHookState>({
    notifications: [],
    unreadCount: 0,
    isConnected: false,
    isLoading: false,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 3; // Reduced from 5 to 3 for less noise
  const baseRetryDelay = 2000; // Increased from 1000 to 2000ms

  // Fetch notifications from API
  const fetchNotifications = useCallback(
    async (
      options: {
        isRead?: boolean;
        type?: NotificationType;
        page?: number;
      } = {},
    ) => {
      if (!isSignedIn) return;

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const token = await getToken();
        const searchParams = new URLSearchParams();

        if (options.isRead !== undefined) {
          searchParams.append("isRead", options.isRead.toString());
        }
        if (options.type) {
          searchParams.append("type", options.type);
        }
        searchParams.append("page", (options.page || 1).toString());
        searchParams.append("limit", limit.toString());

        const response = await fetch(`/api/notifications?${searchParams}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // Handle 404 more gracefully (user not synced yet)
          if (response.status === 404) {
            console.log("🔔 User not found in database yet");
            setState((prev) => ({
              ...prev,
              notifications: [],
              unreadCount: 0,
              isLoading: false,
              error: null, // Don't treat this as an error
            }));
            return;
          }
          throw new Error(
            `Failed to fetch notifications: ${response.statusText}`,
          );
        }

        const data = await response.json();

        if (data.success) {
          setState((prev) => ({
            ...prev,
            notifications: data.data.items,
            isLoading: false,
          }));
        } else {
          throw new Error(data.error || "Failed to fetch notifications");
        }
      } catch (error) {
        console.error("❌ Failed to fetch notifications:", error);
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch notifications",
          isLoading: false,
        }));
      }
    },
    [isSignedIn, getToken, limit],
  );

  // Start polling fallback when SSE fails
  const startPollingFallback = useCallback(() => {
    if (!enablePollingFallback || pollingIntervalRef.current) return;

    console.log("🔔 Starting polling fallback for notifications");

    // Use longer interval for unsynced users to reduce noise
    const adjustedInterval = Math.max(pollingInterval, 60000); // At least 60 seconds for unsynced users

    pollingIntervalRef.current = setInterval(async () => {
      try {
        await fetchNotifications();
      } catch (error) {
        // Don't log errors for polling fallback - they're expected for unsynced users
        // console.error("❌ Polling fallback error:", error);
      }
    }, adjustedInterval);
  }, [enablePollingFallback, pollingInterval, fetchNotifications]);

  // Stop polling fallback
  const stopPollingFallback = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log("🔔 Stopped polling fallback");
    }
  }, []);

  // Connect to real-time notifications
  const connectToStream = useCallback(async () => {
    if (!isSignedIn || eventSourceRef.current) return;

    try {
      await getToken();
      console.log("🔔 Connecting to notification stream...");

      const eventSource = new EventSource(`/api/notifications/stream`, {
        // Note: EventSource doesn't support custom headers directly
        // The authentication will be handled by the cookie session
      });

      eventSource.onopen = () => {
        console.log("🔔 Notification stream connected");
        setState((prev) => ({ ...prev, isConnected: true, error: null }));
        retryCount.current = 0;
        // Stop polling fallback when SSE reconnects
        stopPollingFallback();
        onConnectionChange?.(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case "connected":
              console.log(
                "🔔 Stream connection confirmed:",
                message.data.message,
              );
              break;

            case "notification":
              console.log("🔔 New notification received:", message.data);
              const newNotification = message.data as Notification;

              // Add to notifications list
              setState((prev) => ({
                ...prev,
                notifications: [
                  newNotification,
                  ...prev.notifications.slice(0, limit - 1),
                ],
              }));

              // Trigger callback
              onNewNotification?.(newNotification);
              break;

            case "unread_count":
              console.log("🔔 Unread count updated:", message.data.count);
              setState((prev) => ({
                ...prev,
                unreadCount: message.data.count,
              }));

              onUnreadCountChange?.(message.data.count);
              break;

            case "heartbeat":
              // Just log heartbeat if needed
              // console.log("💓 Notification stream heartbeat");
              break;

            case "user_not_synced":
              console.log("🔔 User not synced to database yet, using polling fallback");
              setState((prev) => ({
                ...prev,
                isConnected: false,
                error: "User sync pending",
              }));
              // Don't retry immediately for unsynced users
              retryCount.current = maxRetries;
              startPollingFallback();
              break;

            default:
              console.warn(
                "🔔 Unknown notification message type:",
                message.type,
              );
          }
        } catch (error) {
          console.error("❌ Failed to parse notification message:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("❌ Notification stream error:", {
          readyState: eventSource.readyState,
          url: eventSource.url,
          errorEvent: error,
          timestamp: new Date().toISOString()
        });
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: "Real-time connection lost",
        }));
        onConnectionChange?.(false);

        // Cleanup current connection
        eventSource.close();
        eventSourceRef.current = null;

        // Retry connection with exponential backoff
        if (retryCount.current < maxRetries) {
          const delay = baseRetryDelay * Math.pow(2, retryCount.current);
          retryCount.current++;

          console.log(
            `🔔 Retrying connection in ${delay}ms (attempt ${retryCount.current}/${maxRetries})`,
          );

          retryTimeoutRef.current = setTimeout(() => {
            if (isSignedIn) {
              connectToStream();
            }
          }, delay);
        } else {
          console.error("🔔 Max retry attempts reached, starting polling fallback");
          setState((prev) => ({
            ...prev,
            error:
              "Real-time connection failed, using fallback mode",
          }));
          startPollingFallback();
        }
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error("❌ Failed to connect to notification stream:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to connect to real-time notifications",
      }));
    }
  }, [
    isSignedIn,
    getToken,
    limit,
    onNewNotification,
    onUnreadCountChange,
    onConnectionChange,
    startPollingFallback,
    stopPollingFallback,
  ]);

  // Disconnect from stream
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    stopPollingFallback();

    setState((prev) => ({ ...prev, isConnected: false }));
    onConnectionChange?.(false);
  }, [onConnectionChange, stopPollingFallback]);

  // Mark notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!isSignedIn) return;

      try {
        const token = await getToken();
        const response = await fetch(`/api/notifications/${notificationId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Failed to mark notification as read: ${response.statusText}`,
          );
        }

        const data = await response.json();

        if (data.success) {
          // Update local state
          setState((prev) => ({
            ...prev,
            notifications: prev.notifications.map((notification) =>
              notification.id === notificationId
                ? { ...notification, isRead: true, readAt: new Date() }
                : notification,
            ),
          }));

          console.log("🔔 Notification marked as read:", notificationId);
        } else {
          throw new Error(data.error || "Failed to mark notification as read");
        }
      } catch (error) {
        console.error("❌ Failed to mark notification as read:", error);
        throw error;
      }
    },
    [isSignedIn, getToken],
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!isSignedIn) return;

    try {
      const token = await getToken();
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to mark all notifications as read: ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (data.success) {
        // Update local state
        setState((prev) => ({
          ...prev,
          notifications: prev.notifications.map((notification) => ({
            ...notification,
            isRead: true,
            readAt: new Date(),
          })),
          unreadCount: 0,
        }));

        onUnreadCountChange?.(0);
        console.log("🔔 All notifications marked as read");
      } else {
        throw new Error(
          data.error || "Failed to mark all notifications as read",
        );
      }
    } catch (error) {
      console.error("❌ Failed to mark all notifications as read:", error);
      throw error;
    }
  }, [isSignedIn, getToken, onUnreadCountChange]);

  // Delete notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!isSignedIn) return;

      try {
        const token = await getToken();
        const response = await fetch(`/api/notifications/${notificationId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Failed to delete notification: ${response.statusText}`,
          );
        }

        const data = await response.json();

        if (data.success) {
          // Update local state
          setState((prev) => ({
            ...prev,
            notifications: prev.notifications.filter(
              (notification) => notification.id !== notificationId,
            ),
          }));

          console.log("🔔 Notification deleted:", notificationId);
        } else {
          throw new Error(data.error || "Failed to delete notification");
        }
      } catch (error) {
        console.error("❌ Failed to delete notification:", error);
        throw error;
      }
    },
    [isSignedIn, getToken],
  );

  // Initialize and cleanup
  useEffect(() => {
    if (isSignedIn && autoConnect) {
      // Fetch initial notifications
      fetchNotifications();

      // Connect to real-time stream
      connectToStream();
    }

    return () => {
      disconnect();
    };
  }, [
    isSignedIn,
    autoConnect,
    fetchNotifications,
    connectToStream,
    disconnect,
  ]);

  return {
    // State
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    connectToStream,
    disconnect,

    // Utilities
    getUnreadNotifications: () => state.notifications.filter((n) => !n.isRead),
    getNotificationsByType: (type: NotificationType) =>
      state.notifications.filter((n) => n.type === type),
  };
}
