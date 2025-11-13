/**
 * Type definitions for Firefly Platform
 *
 * This file re-exports all types from the comprehensive types/index.ts
 * Maintains backward compatibility for imports from "@/lib/types"
 */

// Re-export all types from the comprehensive types file
export * from "./types/index";

// Explicitly re-export enums to ensure they're available at runtime
export {
  UserRole,
  NotificationType,
  MessageType,
  ForumVisibility,
  PostType,
  VoteType,
  NoteVisibility,
  NoteType,
  ResourceContentType,
  ResourceStatus,
} from "./types/index";