// Core notification services
export {
  NotificationDispatcher,
  notificationDispatcher,
} from "./notification-dispatcher.service";

// Helper functions for easy notification dispatching
export {
  notifyMessage,
  notifyCareUpdate,
  notifyEmergencyAlert,
  notifySystemAnnouncement,
  notifyFamilyActivity,
  notifyFamily,
  notifySimple,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  NotificationHelpers,
} from "./notification-helpers";

// Export default for convenience
export { default as NotificationService } from "./notification-helpers";
