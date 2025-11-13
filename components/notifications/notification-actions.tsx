"use client";

import React from "react";
import {
  Calendar,
  Reply,
  ExternalLink,
  CheckCircle,
  Eye,
  EyeOff,
  Users,
  AlertTriangle,
  MessageCircle,
  Info,
  Bell,
  Download,
  Share,
  Clock
} from "lucide-react";
import { Notification, NotificationType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/use-notifications";

export interface NotificationAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "outline" | "destructive" | "ghost" | "secondary";
  primary?: boolean; // Whether this is the primary action
  requiresConfirmation?: boolean;
  confirmationTitle?: string;
  confirmationMessage?: string;
}

export interface NotificationActionsProps {
  notification: Notification;
  onActionComplete?: (actionId: string, notification: Notification) => void;
  size?: "sm" | "md" | "lg";
  layout?: "horizontal" | "vertical" | "compact";
  showLabels?: boolean;
  maxActions?: number;
}

export function NotificationActions({
  notification,
  onActionComplete,
  size = "sm",
  layout = "horizontal",
  showLabels = true,
  maxActions = 4,
}: NotificationActionsProps) {
  const { markAsRead } = useNotifications();
  const router = useRouter();

  const handleAction = async (action: NotificationAction) => {
    try {
      let success = false;

      switch (action.id) {
        case "mark-read":
          if (!notification.isRead) {
            await markAsRead(notification.id);
            success = true;
          }
          break;

        case "mark-unread":
          // Note: This would require implementing markAsUnread in the hook
          console.log("Mark as unread not yet implemented");
          success = true;
          break;

        case "view":
          if (notification.actionUrl) {
            router.push(notification.actionUrl);
            success = true;
          }
          break;

        case "external":
          if (notification.actionUrl) {
            window.open(notification.actionUrl, "_blank");
            success = true;
          }
          break;

        case "reply":
          const messageData = notification.data as any;
          if (messageData?.conversationId) {
            router.push(`/messages/${messageData.conversationId}`);
            success = true;
          } else if (messageData?.senderId) {
            // Navigate to direct message with sender
            router.push(`/messages?userId=${messageData.senderId}`);
            success = true;
          }
          break;

        case "calendar":
          const calendarData = notification.data as any;
          if (calendarData?.eventDate && calendarData?.eventTitle) {
            // Create calendar event (would integrate with calendar system)
            const event = {
              title: calendarData.eventTitle,
              date: calendarData.eventDate,
              description: notification.message,
              location: calendarData.location,
            };

            // For now, create a downloadable .ics file
            await createCalendarEvent(event);

            // Mark notification as read after saving to calendar
            if (!notification.isRead) {
              await markAsRead(notification.id);
            }
            success = true;
          }
          break;

        case "acknowledge":
          // Simple acknowledgment - mark as read
          if (!notification.isRead) {
            await markAsRead(notification.id);
          }
          success = true;
          break;

        case "family-view":
          const familyData = notification.data as any;
          if (familyData?.familyId) {
            router.push(`/families/${familyData.familyId}`);
            success = true;
          }
          break;

        case "conversation":
          const conversationData = notification.data as any;
          if (conversationData?.conversationId) {
            router.push(`/messages/${conversationData.conversationId}`);
            success = true;
          }
          break;

        case "emergency-response":
          const emergencyData = notification.data as any;
          if (emergencyData?.responseUrl) {
            router.push(emergencyData.responseUrl);
            success = true;
          }
          break;

        case "download":
          const downloadData = notification.data as any;
          if (downloadData?.downloadUrl) {
            window.open(downloadData.downloadUrl, "_blank");
            success = true;
          }
          break;

        case "share":
          if (navigator.share && notification.actionUrl) {
            await navigator.share({
              title: notification.title,
              text: notification.message,
              url: notification.actionUrl,
            });
            success = true;
          }
          break;

        case "snooze":
          // Implement snooze functionality (would need backend support)
          console.log("Snooze functionality not yet implemented");
          success = true;
          break;

        default:
          console.warn("Unknown action:", action.id);
      }

      if (success && onActionComplete) {
        onActionComplete(action.id, notification);
      }
    } catch (error) {
      console.error("Failed to execute notification action:", error);
    }
  };

  const getActionsForNotification = (notification: Notification): NotificationAction[] => {
    const actions: NotificationAction[] = [];

    // Common actions for all notifications
    if (notification.isRead) {
      actions.push({
        id: "mark-unread",
        label: "Mark Unread",
        icon: EyeOff,
        variant: "outline",
      });
    } else {
      actions.push({
        id: "mark-read",
        label: "Mark Read",
        icon: Eye,
        variant: "outline",
      });
    }

    // Type-specific actions
    switch (notification.type) {
      case NotificationType.MESSAGE:
        actions.push({
          id: "reply",
          label: "Reply",
          icon: Reply,
          variant: "default",
          primary: true,
        });

        actions.push({
          id: "conversation",
          label: "View Chat",
          icon: MessageCircle,
          variant: "outline",
        });
        break;

      case NotificationType.CARE_UPDATE:
        actions.push({
          id: "view",
          label: "View Update",
          icon: Info,
          variant: "default",
          primary: true,
        });

        actions.push({
          id: "acknowledge",
          label: "Acknowledge",
          icon: CheckCircle,
          variant: "outline",
        });

        // Check if there's a downloadable document
        const careData = notification.data as any;
        if (careData?.downloadUrl) {
          actions.push({
            id: "download",
            label: "Download",
            icon: Download,
            variant: "outline",
          });
        }
        break;

      case NotificationType.SYSTEM_ANNOUNCEMENT:
        // Check if this is a calendar event
        const announcementData = notification.data as any;
        if (announcementData?.eventDate) {
          actions.push({
            id: "calendar",
            label: "Add to Calendar",
            icon: Calendar,
            variant: "default",
            primary: true,
          });
        }

        actions.push({
          id: "view",
          label: "Read More",
          icon: ExternalLink,
          variant: "outline",
        });

        // Check if sharing is available
        if (notification.actionUrl) {
          actions.push({
            id: "share",
            label: "Share",
            icon: Share,
            variant: "outline",
          });
        }
        break;

      case NotificationType.FAMILY_ACTIVITY:
        actions.push({
          id: "family-view",
          label: "View Family",
          icon: Users,
          variant: "default",
          primary: true,
        });

        actions.push({
          id: "acknowledge",
          label: "Acknowledge",
          icon: CheckCircle,
          variant: "outline",
        });
        break;

      case NotificationType.EMERGENCY_ALERT:
        actions.push({
          id: "emergency-response",
          label: "Respond",
          icon: AlertTriangle,
          variant: "destructive",
          primary: true,
          requiresConfirmation: true,
          confirmationTitle: "Emergency Response",
          confirmationMessage: "This will mark you as responding to the emergency alert.",
        });

        actions.push({
          id: "acknowledge",
          label: "Acknowledge",
          icon: CheckCircle,
          variant: "outline",
        });

        // Emergency alerts can be shared
        actions.push({
          id: "share",
          label: "Share Alert",
          icon: Share,
          variant: "outline",
        });
        break;

      default:
        // Fallback actions
        if (notification.actionUrl) {
          actions.push({
            id: "view",
            label: "View",
            icon: ExternalLink,
            variant: "default",
            primary: true,
          });
        }
    }

    // Add snooze for non-emergency notifications
    if (notification.type !== NotificationType.EMERGENCY_ALERT && !notification.isRead) {
      actions.push({
        id: "snooze",
        label: "Snooze",
        icon: Clock,
        variant: "ghost",
      });
    }

    // Limit actions if specified
    if (maxActions && actions.length > maxActions) {
      const primaryActions = actions.filter(a => a.primary);
      const otherActions = actions.filter(a => !a.primary);

      return [
        ...primaryActions.slice(0, Math.max(1, maxActions - 2)),
        ...otherActions.slice(0, maxActions - primaryActions.length)
      ];
    }

    return actions;
  };

  const actions = getActionsForNotification(notification);

  if (actions.length === 0) {
    return null;
  }

  const getButtonSize = () => {
    switch (size) {
      case "sm": return "sm";
      case "md": return "default";
      case "lg": return "lg";
      default: return "sm";
    }
  };

  const renderActions = () => {
    return actions.map((action) => {
      const IconComponent = action.icon;

      return (
        <Button
          key={action.id}
          variant={action.variant}
          size={getButtonSize()}
          onClick={() => handleAction(action)}
          className={layout === "vertical" ? "w-full justify-start" : ""}
        >
          <IconComponent className="h-3 w-3 mr-1" />
          {(showLabels || layout === "vertical") && action.label}
        </Button>
      );
    });
  };

  return (
    <div
      className={
        layout === "horizontal"
          ? "flex items-center gap-1 flex-wrap"
          : layout === "vertical"
          ? "flex flex-col gap-2"
          : "flex items-center gap-1" // compact
      }
    >
      {renderActions()}
    </div>
  );
}

// Utility function to create calendar events
async function createCalendarEvent(event: {
  title: string;
  date: string;
  description?: string;
  location?: string;
}) {
  const startDate = new Date(event.date);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Firefly//Notification Calendar//EN',
    'BEGIN:VEVENT',
    `DTSTART:${formatDate(startDate)}`,
    `DTEND:${formatDate(endDate)}`,
    `SUMMARY:${event.title}`,
    event.description ? `DESCRIPTION:${event.description}` : '',
    event.location ? `LOCATION:${event.location}` : '',
    `UID:${Date.now()}@firefly.app`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// Pre-configured action sets for common notification scenarios
export const NotificationActionPresets = {
  // For message notifications
  message: (notification: Notification) => (
    <NotificationActions
      notification={notification}
      maxActions={3}
      layout="horizontal"
    />
  ),

  // For emergency alerts (simplified, urgent actions)
  emergency: (notification: Notification) => (
    <NotificationActions
      notification={notification}
      maxActions={2}
      layout="horizontal"
      size="md"
    />
  ),

  // For compact display (like in banner)
  compact: (notification: Notification) => (
    <NotificationActions
      notification={notification}
      maxActions={2}
      layout="compact"
      showLabels={false}
    />
  ),

  // For detailed view (like in notification center)
  detailed: (notification: Notification) => (
    <NotificationActions
      notification={notification}
      layout="vertical"
      size="sm"
    />
  ),
};