"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

type SourceField =
  | "conversationId"
  | "postId"
  | "forumId"
  | "resourceId"
  | "alertId"
  | "announcementId";

interface UseAutoDismissNotificationsOptions {
  /**
   * Whether the auto-dismiss should be enabled.
   * Useful for disabling during loading states.
   * @default true
   */
  enabled?: boolean;

  /**
   * Debounce delay in milliseconds before making the API call.
   * Prevents rapid API calls on re-renders.
   * @default 1000
   */
  debounceMs?: number;
}

interface UseAutoDismissNotificationsResult {
  /**
   * Manually trigger marking notifications as read.
   * Useful if you need to call it outside of the automatic effect.
   */
  markNotificationsRead: () => Promise<void>;

  /**
   * Whether notifications for this source have already been marked in this session.
   */
  hasMarked: boolean;
}

/**
 * Hook that automatically marks notifications as read when viewing an activity page.
 * Call this hook on activity pages (chat, forum posts, resources, etc.) to auto-dismiss
 * notifications related to that activity.
 *
 * @param sourceField - The field name in notification data (e.g., "conversationId", "postId")
 * @param sourceValue - The value to match (e.g., the actual conversation ID)
 * @param options - Configuration options
 *
 * @example
 * // In a chat conversation page
 * useAutoDismissNotifications('conversationId', conversationId, {
 *   enabled: !!conversationId && !loading
 * });
 *
 * @example
 * // In a forum post page
 * useAutoDismissNotifications('postId', post?.id, {
 *   enabled: !!post && !loading
 * });
 */
export function useAutoDismissNotifications(
  sourceField: SourceField,
  sourceValue: string | undefined | null,
  options: UseAutoDismissNotificationsOptions = {},
): UseAutoDismissNotificationsResult {
  const { enabled = true, debounceMs = 1000 } = options;

  const { isSignedIn, getToken } = useAuth();

  // Track already-processed sources to prevent duplicate API calls
  const markedSourcesRef = useRef<Set<string>>(new Set());

  // Track if we've marked for the current source
  const hasMarkedRef = useRef(false);

  // Timeout ref for debouncing
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create stable key for tracking
  const sourceKey = sourceValue ? `${sourceField}:${sourceValue}` : null;

  // Update hasMarked status when sourceKey changes
  if (sourceKey) {
    hasMarkedRef.current = markedSourcesRef.current.has(sourceKey);
  }

  const markNotificationsRead = useCallback(async () => {
    if (!isSignedIn || !sourceValue || !enabled) {
      return;
    }

    const key = `${sourceField}:${sourceValue}`;

    // Skip if already processed in this session
    if (markedSourcesRef.current.has(key)) {
      return;
    }

    try {
      const token = await getToken();

      const response = await fetch("/api/notifications/mark-read-by-source", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceField,
          sourceValue,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Add to tracked set to prevent duplicate calls
        markedSourcesRef.current.add(key);
        hasMarkedRef.current = true;

        if (data.data?.markedCount > 0) {
          console.log(
            `🔔 Auto-dismissed ${data.data.markedCount} notification(s) for ${sourceField}:${sourceValue}`,
          );
        }
      } else {
        console.error(
          "❌ Failed to auto-dismiss notifications:",
          response.status,
        );
      }
    } catch (error) {
      // Log error but don't throw - this is a background operation
      console.error("❌ Error auto-dismissing notifications:", error);
    }
  }, [isSignedIn, getToken, sourceField, sourceValue, enabled]);

  // Auto-trigger on mount/value change with debounce
  useEffect(() => {
    if (!sourceValue || !enabled || !isSignedIn) {
      return;
    }

    const key = `${sourceField}:${sourceValue}`;

    // Skip if already processed
    if (markedSourcesRef.current.has(key)) {
      return;
    }

    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce the API call
    debounceTimeoutRef.current = setTimeout(() => {
      markNotificationsRead();
    }, debounceMs);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [sourceField, sourceValue, enabled, isSignedIn, debounceMs, markNotificationsRead]);

  return {
    markNotificationsRead,
    hasMarked: sourceKey ? markedSourcesRef.current.has(sourceKey) : false,
  };
}
