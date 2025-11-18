"use client";

import React, { useState } from "react";
import { Bell, Clock, Mail, Smartphone, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";

export interface NotificationPreferencesProps {
  className?: string;
}

export function NotificationPreferences({ className }: NotificationPreferencesProps) {
  const {
    isLoading,
    error,
    isSaving,
    updatePreferences,
    isEmailEnabled,
    isInAppEnabled,
    isQuietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    timezone,
    getEmailPreference,
    getInAppPreference,
  } = useNotificationPreferences();

  const [localQuietStart, setLocalQuietStart] = useState(quietHoursStart || "22:00");
  const [localQuietEnd, setLocalQuietEnd] = useState(quietHoursEnd || "08:00");
  const [localTimezone, setLocalTimezone] = useState(timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

  const handleToggleEmail = async (enabled: boolean) => {
    try {
      await updatePreferences({ emailEnabled: enabled });
    } catch (error) {
      console.error("Failed to update email preference:", error);
    }
  };

  const handleToggleInApp = async (enabled: boolean) => {
    try {
      await updatePreferences({ inAppEnabled: enabled });
    } catch (error) {
      console.error("Failed to update in-app preference:", error);
    }
  };

  const handleToggleQuietHours = async (enabled: boolean) => {
    try {
      if (enabled) {
        await updatePreferences({
          quietHoursEnabled: true,
          quietHoursStart: localQuietStart,
          quietHoursEnd: localQuietEnd,
          timezone: localTimezone,
        });
      } else {
        await updatePreferences({ quietHoursEnabled: false });
      }
    } catch (error) {
      console.error("Failed to update quiet hours:", error);
    }
  };

  const handleUpdateQuietHours = async () => {
    try {
      await updatePreferences({
        quietHoursStart: localQuietStart,
        quietHoursEnd: localQuietEnd,
        timezone: localTimezone,
      });
    } catch (error) {
      console.error("Failed to update quiet hours times:", error);
    }
  };

  const handleEmailTypeToggle = async (type: string, enabled: boolean) => {
    try {
      const updates: Record<string, boolean> = {};
      updates[`email${type.charAt(0).toUpperCase()}${type.slice(1)}`] = enabled;
      await updatePreferences(updates);
    } catch (error) {
      console.error(`Failed to update email ${type} preference:`, error);
    }
  };

  const handleInAppTypeToggle = async (type: string, enabled: boolean) => {
    try {
      const updates: Record<string, boolean> = {};
      updates[`inApp${type.charAt(0).toUpperCase()}${type.slice(1)}`] = enabled;
      await updatePreferences(updates);
    } catch (error) {
      console.error(`Failed to update in-app ${type} preference:`, error);
    }
  };

  const notificationTypes = [
    { key: "messages", label: "Messages", description: "New messages in conversations" },
    { key: "announcements", label: "Announcements", description: "Important system announcements" },
    { key: "familyActivity", label: "Family Activity", description: "Family events and activities" },
  ];

  if (isLoading) {
    return (
      <div className={cn("p-6", className)}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notification Preferences
        </h2>
        <p className="text-gray-600 text-xs mt-0.5">
          Manage how and when you receive notifications
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Global Toggles */}
      <div className="space-y-3">
        <h3 className="text-base font-medium text-gray-900">General Settings</h3>

        {/* Email Notifications */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Mail className={cn("h-4 w-4", isEmailEnabled ? "text-blue-600" : "text-gray-400")} />
            <div>
              <h4 className="font-medium text-gray-900 text-sm">Email Notifications</h4>
              <p className="text-xs text-gray-600">Receive notifications via email</p>
            </div>
          </div>
          <button
            onClick={() => handleToggleEmail(!isEmailEnabled)}
            disabled={isSaving}
            className={cn(
              "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              isEmailEnabled ? "bg-blue-600" : "bg-gray-200"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                isEmailEnabled ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* In-App Notifications */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Smartphone className={cn("h-4 w-4", isInAppEnabled ? "text-blue-600" : "text-gray-400")} />
            <div>
              <h4 className="font-medium text-gray-900 text-sm">In-App Notifications</h4>
              <p className="text-xs text-gray-600">Receive real-time notifications in the app</p>
            </div>
          </div>
          <button
            onClick={() => handleToggleInApp(!isInAppEnabled)}
            disabled={isSaving}
            className={cn(
              "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              isInAppEnabled ? "bg-blue-600" : "bg-gray-200"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                isInAppEnabled ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* Quiet Hours */}
        <div className="p-3 bg-gray-50 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className={cn("h-4 w-4", isQuietHoursEnabled ? "text-blue-600" : "text-gray-400")} />
              <div>
                <h4 className="font-medium text-gray-900 text-sm">Quiet Hours</h4>
                <p className="text-xs text-gray-600">Pause non-critical notifications during these hours</p>
              </div>
            </div>
            <button
              onClick={() => handleToggleQuietHours(!isQuietHoursEnabled)}
              disabled={isSaving}
              className={cn(
                "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                isQuietHoursEnabled ? "bg-blue-600" : "bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  isQuietHoursEnabled ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {isQuietHoursEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={localQuietStart}
                  onChange={(e) => setLocalQuietStart(e.target.value)}
                  onBlur={handleUpdateQuietHours}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={localQuietEnd}
                  onChange={(e) => setLocalQuietEnd(e.target.value)}
                  onBlur={handleUpdateQuietHours}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <select
                  value={localTimezone}
                  onChange={(e) => setLocalTimezone(e.target.value)}
                  onBlur={handleUpdateQuietHours}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification Types */}
      <div className="space-y-3">
        <h3 className="text-base font-medium text-gray-900">Notification Types</h3>

        <div className="space-y-2">
          {notificationTypes.map((type) => (
            <div key={type.key} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-medium text-gray-900 text-sm">{type.label}</h4>
                  <p className="text-xs text-gray-600">{type.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* Email */}
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700">Email</span>
                  </div>
                  <button
                    onClick={() => handleEmailTypeToggle(type.key, !getEmailPreference(type.key as "messages" | "careUpdates" | "announcements" | "familyActivity" | "emergencyAlerts"))}
                    disabled={isSaving || !isEmailEnabled}
                    className={cn(
                      "relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-blue-500",
                      getEmailPreference(type.key as "messages" | "careUpdates" | "announcements" | "familyActivity" | "emergencyAlerts") && isEmailEnabled ? "bg-blue-600" : "bg-gray-200",
                      !isEmailEnabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        getEmailPreference(type.key as "messages" | "careUpdates" | "announcements" | "familyActivity" | "emergencyAlerts") && isEmailEnabled ? "translate-x-3" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {/* In-App */}
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="h-3 w-3 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700">In-App</span>
                  </div>
                  <button
                    onClick={() => handleInAppTypeToggle(type.key, !getInAppPreference(type.key as "messages" | "careUpdates" | "announcements" | "familyActivity" | "emergencyAlerts"))}
                    disabled={isSaving || !isInAppEnabled}
                    className={cn(
                      "relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-blue-500",
                      getInAppPreference(type.key as "messages" | "careUpdates" | "announcements" | "familyActivity" | "emergencyAlerts") && isInAppEnabled ? "bg-blue-600" : "bg-gray-200",
                      !isInAppEnabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        getInAppPreference(type.key as "messages" | "careUpdates" | "announcements" | "familyActivity" | "emergencyAlerts") && isInAppEnabled ? "translate-x-3" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t pt-2">
        <p className="text-xs text-gray-600">
          Changes are saved automatically.
        </p>
      </div>
    </div>
  );
}