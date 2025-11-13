"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { NotificationPreferences } from "@/lib/types";

interface NotificationPreferencesState {
  preferences: NotificationPreferences | null;
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
}

export function useNotificationPreferences() {
  const { isSignedIn, getToken } = useAuth();
  const [state, setState] = useState<NotificationPreferencesState>({
    preferences: null,
    isLoading: false,
    error: null,
    isSaving: false,
  });

  // Fetch notification preferences
  const fetchPreferences = useCallback(async () => {
    if (!isSignedIn) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const token = await getToken();
      const response = await fetch("/api/notifications/preferences", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch preferences: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setState((prev) => ({
          ...prev,
          preferences: data.data,
          isLoading: false,
        }));
      } else {
        throw new Error(data.error || "Failed to fetch preferences");
      }
    } catch (error) {
      console.error("❌ Failed to fetch notification preferences:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch preferences",
        isLoading: false,
      }));
    }
  }, [isSignedIn, getToken]);

  // Update notification preferences
  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>) => {
      if (!isSignedIn) return;

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        const token = await getToken();
        const response = await fetch("/api/notifications/preferences", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to update preferences: ${response.statusText}`,
          );
        }

        const data = await response.json();

        if (data.success) {
          setState((prev) => ({
            ...prev,
            preferences: data.data,
            isSaving: false,
          }));

          console.log("✅ Notification preferences updated");
          return data.data;
        } else {
          throw new Error(data.error || "Failed to update preferences");
        }
      } catch (error) {
        console.error("❌ Failed to update notification preferences:", error);
        setState((prev) => ({
          ...prev,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update preferences",
          isSaving: false,
        }));
        throw error;
      }
    },
    [isSignedIn, getToken],
  );

  // Helper functions for common preference updates
  const toggleEmailNotifications = useCallback(
    (enabled: boolean) => updatePreferences({ emailEnabled: enabled }),
    [updatePreferences],
  );

  const toggleInAppNotifications = useCallback(
    (enabled: boolean) => updatePreferences({ inAppEnabled: enabled }),
    [updatePreferences],
  );

  const updateQuietHours = useCallback(
    (
      enabled: boolean,
      startTime?: string,
      endTime?: string,
      timezone?: string,
    ) => {
      const updates: Partial<NotificationPreferences> = {
        quietHoursEnabled: enabled,
      };

      if (enabled && startTime && endTime) {
        updates.quietHoursStart = startTime;
        updates.quietHoursEnd = endTime;
        if (timezone) {
          updates.timezone = timezone;
        }
      }

      return updatePreferences(updates);
    },
    [updatePreferences],
  );

  const updateEmailPreferences = useCallback(
    (preferences: {
      messages?: boolean;
      careUpdates?: boolean;
      announcements?: boolean;
      familyActivity?: boolean;
      emergencyAlerts?: boolean;
    }) => {
      const updates: Partial<NotificationPreferences> = {};

      if (preferences.messages !== undefined) {
        updates.emailMessages = preferences.messages;
      }
      if (preferences.careUpdates !== undefined) {
        updates.emailCareUpdates = preferences.careUpdates;
      }
      if (preferences.announcements !== undefined) {
        updates.emailAnnouncements = preferences.announcements;
      }
      if (preferences.familyActivity !== undefined) {
        updates.emailFamilyActivity = preferences.familyActivity;
      }
      if (preferences.emergencyAlerts !== undefined) {
        updates.emailEmergencyAlerts = preferences.emergencyAlerts;
      }

      return updatePreferences(updates);
    },
    [updatePreferences],
  );

  const updateInAppPreferences = useCallback(
    (preferences: {
      messages?: boolean;
      careUpdates?: boolean;
      announcements?: boolean;
      familyActivity?: boolean;
      emergencyAlerts?: boolean;
    }) => {
      const updates: Partial<NotificationPreferences> = {};

      if (preferences.messages !== undefined) {
        updates.inAppMessages = preferences.messages;
      }
      if (preferences.careUpdates !== undefined) {
        updates.inAppCareUpdates = preferences.careUpdates;
      }
      if (preferences.announcements !== undefined) {
        updates.inAppAnnouncements = preferences.announcements;
      }
      if (preferences.familyActivity !== undefined) {
        updates.inAppFamilyActivity = preferences.familyActivity;
      }
      if (preferences.emergencyAlerts !== undefined) {
        updates.inAppEmergencyAlerts = preferences.emergencyAlerts;
      }

      return updatePreferences(updates);
    },
    [updatePreferences],
  );

  // Load preferences when signed in
  useEffect(() => {
    if (isSignedIn) {
      fetchPreferences();
    } else {
      setState({
        preferences: null,
        isLoading: false,
        error: null,
        isSaving: false,
      });
    }
  }, [isSignedIn, fetchPreferences]);

  // Get current preference values with defaults
  const getEmailPreference = useCallback(
    (
      type:
        | "messages"
        | "careUpdates"
        | "announcements"
        | "familyActivity"
        | "emergencyAlerts",
    ) => {
      if (!state.preferences) return true; // Default to enabled

      switch (type) {
        case "messages":
          return state.preferences.emailMessages;
        case "careUpdates":
          return state.preferences.emailCareUpdates;
        case "announcements":
          return state.preferences.emailAnnouncements;
        case "familyActivity":
          return state.preferences.emailFamilyActivity;
        case "emergencyAlerts":
          return state.preferences.emailEmergencyAlerts;
        default:
          return true;
      }
    },
    [state.preferences],
  );

  const getInAppPreference = useCallback(
    (
      type:
        | "messages"
        | "careUpdates"
        | "announcements"
        | "familyActivity"
        | "emergencyAlerts",
    ) => {
      if (!state.preferences) return true; // Default to enabled

      switch (type) {
        case "messages":
          return state.preferences.inAppMessages;
        case "careUpdates":
          return state.preferences.inAppCareUpdates;
        case "announcements":
          return state.preferences.inAppAnnouncements;
        case "familyActivity":
          return state.preferences.inAppFamilyActivity;
        case "emergencyAlerts":
          return state.preferences.inAppEmergencyAlerts;
        default:
          return true;
      }
    },
    [state.preferences],
  );

  return {
    // State
    preferences: state.preferences,
    isLoading: state.isLoading,
    error: state.error,
    isSaving: state.isSaving,

    // Actions
    fetchPreferences,
    updatePreferences,

    // Helper functions
    toggleEmailNotifications,
    toggleInAppNotifications,
    updateQuietHours,
    updateEmailPreferences,
    updateInAppPreferences,

    // Getters
    getEmailPreference,
    getInAppPreference,

    // Convenience properties
    isEmailEnabled: state.preferences?.emailEnabled ?? true,
    isInAppEnabled: state.preferences?.inAppEnabled ?? true,
    isQuietHoursEnabled: state.preferences?.quietHoursEnabled ?? false,
    quietHoursStart: state.preferences?.quietHoursStart,
    quietHoursEnd: state.preferences?.quietHoursEnd,
    timezone: state.preferences?.timezone,
  };
}
