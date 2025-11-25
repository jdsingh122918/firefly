"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { Notification, NotificationType } from "@/lib/types";

// Connection state machine
export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected' | 'polling';

interface NotificationHookState {
  notifications: Notification[];
  unreadCount: number;
  connectionState: ConnectionState;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastRefreshedAt: Date | null;
  connectionId: string | null;
}

interface UseNotificationsOptions {
  limit?: number;
  autoConnect?: boolean;
  onNewNotification?: (notification: Notification) => void;
  onUnreadCountChange?: (count: number) => void;
  onConnectionChange?: (state: ConnectionState) => void;
  enablePollingFallback?: boolean;
  pollingInterval?: number;
}

// Add jitter to prevent thundering herd
function addJitter(delay: number, jitterFactor: number = 0.3): number {
  const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
  return Math.max(1000, delay + jitter);
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
    connectionState: 'disconnected',
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastRefreshedAt: null,
    connectionId: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 5;
  const baseRetryDelay = 2000;

  // Update connection state and trigger callback
  const setConnectionState = useCallback((newState: ConnectionState) => {
    setState((prev) => {
      if (prev.connectionState !== newState) {
        onConnectionChange?.(newState);
        return { ...prev, connectionState: newState };
      }
      return prev;
    });
  }, [onConnectionChange]);

  // Fetch notifications from API
  const fetchNotifications = useCallback(
    async (
      fetchOptions: {
        isRead?: boolean;
        type?: NotificationType;
        page?: number;
        silent?: boolean; // Don't update loading state
      } = {},
    ) => {
      if (!isSignedIn) return;

      const { silent = false, ...queryOptions } = fetchOptions;

      if (!silent) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
      }

      try {
        const token = await getToken();
        const searchParams = new URLSearchParams();

        if (queryOptions.isRead !== undefined) {
          searchParams.append("isRead", queryOptions.isRead.toString());
        }
        if (queryOptions.type) {
          searchParams.append("type", queryOptions.type);
        }
        searchParams.append("page", (queryOptions.page || 1).toString());
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
              lastRefreshedAt: new Date(),
              error: null,
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
            lastRefreshedAt: new Date(),
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

  // Manual refresh function
  const refreshNotifications = useCallback(async () => {
    if (!isSignedIn) return;

    setState((prev) => ({ ...prev, isRefreshing: true }));

    try {
      const token = await getToken();

      // Fetch both notifications and unread count in parallel
      const [notificationsResponse, countResponse] = await Promise.all([
        fetch(`/api/notifications?limit=${limit}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/notifications/count`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null), // Don't fail if count endpoint doesn't exist
      ]);

      if (!notificationsResponse.ok) {
        if (notificationsResponse.status === 404) {
          console.log("🔔 User not found in database yet");
          setState((prev) => ({
            ...prev,
            notifications: [],
            unreadCount: 0,
            isRefreshing: false,
            lastRefreshedAt: new Date(),
          }));
          return;
        }
        throw new Error("Failed to refresh notifications");
      }

      const notificationsData = await notificationsResponse.json();
      let unreadCount = state.unreadCount;

      if (countResponse?.ok) {
        const countData = await countResponse.json();
        if (countData.success) {
          unreadCount = countData.data.count;
          onUnreadCountChange?.(unreadCount);
        }
      }

      if (notificationsData.success) {
        setState((prev) => ({
          ...prev,
          notifications: notificationsData.data.items,
          unreadCount,
          isRefreshing: false,
          lastRefreshedAt: new Date(),
          error: null,
        }));
        console.log("🔔 Notifications refreshed manually");
      }
    } catch (error) {
      console.error("❌ Failed to refresh notifications:", error);
      setState((prev) => ({
        ...prev,
        isRefreshing: false,
        error: error instanceof Error ? error.message : "Refresh failed",
      }));
    }
  }, [isSignedIn, getToken, limit, state.unreadCount, onUnreadCountChange]);

  // Start polling fallback when SSE fails
  const startPollingFallback = useCallback(() => {
    if (!enablePollingFallback || pollingIntervalRef.current) return;

    console.log("🔔 Starting polling fallback for notifications");
    setConnectionState('polling');

    // Use longer interval for unsynced users to reduce noise
    const adjustedInterval = Math.max(pollingInterval, 60000);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        await fetchNotifications({ silent: true });
      } catch {
        // Don't log errors for polling fallback
      }
    }, adjustedInterval);

    // Also do an immediate fetch
    fetchNotifications({ silent: true });
  }, [enablePollingFallback, pollingInterval, fetchNotifications, setConnectionState]);

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

    let connectionTimeout: NodeJS.Timeout | undefined;

    try {
      await getToken();
      console.log("🔔 Connecting to notification stream...");
      setConnectionState('reconnecting');

      const eventSource = new EventSource(`/api/notifications/stream`, {
        // Note: EventSource doesn't support custom headers directly
        // The authentication will be handled by the cookie session
      });

      // Add connection timeout to detect stuck connections
      connectionTimeout = setTimeout(() => {
        if (eventSource.readyState === EventSource.CONNECTING) {
          console.warn("🔔 Connection timeout, closing EventSource");
          eventSource.close();
        }
      }, 15000);

      eventSource.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log("🔔 Notification stream connected");
        setConnectionState('connected');
        setState((prev) => ({ ...prev, error: null }));
        retryCount.current = 0;
        // Stop polling fallback when SSE reconnects
        stopPollingFallback();
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
              // Store connection ID for debugging
              if (message.data.connectionId) {
                setState((prev) => ({
                  ...prev,
                  connectionId: message.data.connectionId,
                }));
              }
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
                lastRefreshedAt: new Date(),
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
              // Update lastRefreshedAt to show connection is alive
              setState((prev) => ({
                ...prev,
                lastRefreshedAt: new Date(),
              }));
              break;

            case "user_not_synced":
              console.log("🔔 User not synced to database yet, using polling fallback");
              setState((prev) => ({
                ...prev,
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
        clearTimeout(connectionTimeout);
        const errorDetails = {
          readyState: eventSource.readyState,
          readyStateText: eventSource.readyState === 0 ? 'CONNECTING' :
                         eventSource.readyState === 1 ? 'OPEN' :
                         eventSource.readyState === 2 ? 'CLOSED' : 'UNKNOWN',
          url: eventSource.url,
          errorEvent: error,
          errorType: error?.type || 'unknown',
          timestamp: new Date().toISOString()
        };
        console.error("❌ Notification stream error:", errorDetails);

        setState((prev) => ({
          ...prev,
          error: "Real-time connection lost",
          connectionId: null,
        }));

        // Cleanup current connection
        eventSource.close();
        eventSourceRef.current = null;

        // Retry connection with exponential backoff + jitter
        if (retryCount.current < maxRetries) {
          const baseDelay = baseRetryDelay * Math.pow(2, retryCount.current);
          const delay = addJitter(baseDelay);
          retryCount.current++;

          console.log(
            `🔔 Retrying connection in ${Math.round(delay)}ms (attempt ${retryCount.current}/${maxRetries})`,
          );

          setConnectionState('reconnecting');

          retryTimeoutRef.current = setTimeout(() => {
            if (isSignedIn) {
              connectToStream();
            }
          }, delay);
        } else {
          console.log("🔔 Max retry attempts reached, starting polling fallback");
          setState((prev) => ({
            ...prev,
            error: "Using polling mode (real-time connection unavailable)",
          }));
          startPollingFallback();
        }
      };

      eventSourceRef.current = eventSource;
    } catch (error) {
      if (connectionTimeout) clearTimeout(connectionTimeout);
      console.error("❌ Failed to connect to notification stream:", error);
      setConnectionState('disconnected');
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
    setConnectionState,
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

    setConnectionState('disconnected');
    setState((prev) => ({ ...prev, connectionId: null }));
  }, [setConnectionState, stopPollingFallback]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    console.log("🔔 Manual reconnect requested");

    // Reset retry counter
    retryCount.current = 0;

    // Disconnect first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    stopPollingFallback();

    // Reconnect
    if (isSignedIn) {
      connectToStream();
    }
  }, [isSignedIn, connectToStream, stopPollingFallback]);

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

  // Legacy compatibility: isConnected maps to connectionState === 'connected'
  const isConnected = state.connectionState === 'connected';

  return {
    // State
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    connectionState: state.connectionState,
    isConnected, // Legacy compatibility
    isLoading: state.isLoading,
    isRefreshing: state.isRefreshing,
    error: state.error,
    lastRefreshedAt: state.lastRefreshedAt,
    connectionId: state.connectionId,

    // Actions
    fetchNotifications,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    connectToStream,
    disconnect,
    reconnect,

    // Utilities
    getUnreadNotifications: () => state.notifications.filter((n) => !n.isRead),
    getNotificationsByType: (type: NotificationType) =>
      state.notifications.filter((n) => n.type === type),
  };
}
