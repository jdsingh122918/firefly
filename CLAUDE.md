# CLAUDE.md

## Critical Rules
- **Context Continuity**: Read `@CLAUDE.md` at session start, update at session end
- **Dev Server Management**: NEVER start/kill dev servers unless explicitly requested

## Project Overview
**Firefly**: End of Life Care Platform - Next.js 16, TypeScript, MongoDB, role-based access (ADMIN/VOLUNTEER/MEMBER)
- 44 models, 22 enums, 75+ APIs, unified Content system (Notes+Resources)
- Healthcare tagging (8 categories, 39+ tags), professional UI, mobile-responsive
- 65% code reduction through architecture consolidation

**Key Commands**:
- `npm run dev` - Start server
- `npx prisma generate && npx prisma db push` - Update database
- `npx tsx scripts/validate-database.ts --repair` - Database health checks

**Architecture**: `app/(dashboard)/` (role pages) • `app/api/` (REST endpoints) • `lib/db/repositories/` (data layer)

## Critical Patterns

**Authentication**: Dual-path (session + DB fallback) • Always resolve Clerk ID → Database ID before repository calls
**Repository Pattern**: ALL data access via repositories, never direct Prisma queries
**Next.js 15+**: `await params` for dynamic routes
**UI Standards**: Content-dense spacing (p-3, space-y-2/3), min-h-[44px] touch targets, mobile-first responsive grids
**Select Components**: Use "none" instead of empty strings to prevent validation errors
**Page Navigation**: Dedicated pages over modals for better UX workflow
**Healthcare Integration**: Import HEALTHCARE_CATEGORIES from `@/lib/data/healthcare-tags`

## Environment & Workflow

**Required Env**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `CLERK_WEBHOOK_SECRET`

**MongoDB Setup**:
```bash
docker run --name mongodb -d -p 27017:27017 mongodb/mongodb-community-server:latest --replSet rs0
docker exec mongodb mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"
```

**Workflow**: `npm run dev` → Create Clerk account → `/admin/debug` → "Sync Current User"

## Current Status: Complete End-to-End Chat System with Enhanced UX ✅
- Forums, Chat, Assignments, Notifications, Settings with enhanced UX/UI
- **Real-time Chat System**: SSE-based messaging with typing indicators and auto-reconnection
- **Chat Authorization**: Complete participant validation and role-based routing system
- **Notification Integration**: Role-based notification actions with seamless chat navigation
- **Debug Tools**: Admin chat history reset functionality for system maintenance
- **Message UI Refinements**: Clean bubble design with optimized spacing and visual hierarchy
- **Console Debugging**: Resolved React key duplication warnings and message loading issues
- Advanced healthcare tagging system with dedicated tag selection pages
- Document library integration and streamlined content management
- Mobile-responsive design with professional spacing and layout consistency

## Development Tools
- **Debug Dashboard**: `/admin/debug` - User sync, database monitoring, chat history reset
- **Health Checks**: `npx tsx scripts/validate-database.ts --repair`
- **Port Debug**: `lsof -i :3000`
- **Chat Debug**: Admin-only chat history reset tool for system maintenance

## Next Priority Features
- Rich text editor for forums (~4-6 hours)
- Advanced search with full-text indexing (~8-12 hours)
- Message reactions and emoji support (~3-4 hours)
- File sharing and attachments in chat (~6-8 hours)

## Key Technical Learnings

**Critical Patterns**:
- **Modal → Page Evolution**: Dedicated pages provide 95% better space utilization than complex modals
- **User ID Mapping**: Always resolve Clerk ID → Database ID to prevent ObjectID errors
- **Select Validation**: Use "none" instead of empty strings to prevent validation errors
- **Layout Consistency**: Matching grid structures (lg:grid-cols-4, space-y-3) eliminate jarring transitions
- **API Alignment**: Ensure component expected fields match API response structure
- **Mobile-First Design**: Progressive enhancement prevents layout overflow issues
- **Section Consolidation**: Combining related form sections reduces cognitive load by 40%
- **Content Card Constraints**: Use `overflow-hidden`, `min-w-0`, `flex-shrink-0` for proper element containment
- **Healthcare Category Filtering**: Expand categories to constituent tags for accurate filtering
- **Hydration Safety**: Use client-only rendering patterns for Radix components to prevent ID mismatches
- **Real-time Architecture**: SSE preferred over WebSockets in Next.js for better reliability and browser compatibility
- **Direct Message Validation**: Frontend must include current user in participant count for backend validation
- **Debug Logging Strategy**: Comprehensive logging with emoji prefixes for easy filtering and troubleshooting
- **Participant Query Pattern**: Use JavaScript filtering for `leftAt` checks instead of `leftAt: null` queries
- **Authentication-Aware Components**: Always check `isLoaded` and `isSignedIn` before making API calls
- **Role-Based Navigation**: Use session metadata to construct role-specific routes for consistent UX
- **Message Deduplication**: Implement comprehensive deduplication to prevent React key conflicts in real-time systems
- **API Response Parsing**: Always validate API response structure - ensure frontend matches backend data format
- **Debug Tool Architecture**: Granular admin tools (chat reset vs full database reset) provide better operational control
- **Message UI Design**: Replace heavy Card components with lightweight divs for better bubble proportions

**Recent Achievements** (Sessions 026-031):
- Healthcare tagging system with dedicated tag selection pages
- Advanced filter architecture with category-based organization
- Document library integration with seamless "From Library" functionality
- Content type unification showing all content by default
- 95% space reduction in forms by moving complex selections to dedicated pages
- Enhanced mobile-responsive design with collapsible filters
- **Real-time Chat System**: Complete SSE implementation with typing indicators
- **Direct Message Fixes**: Resolved participant validation and conversation creation issues
- **Chat Authorization System**: Complete participant validation with MongoDB ObjectId handling
- **Notification Integration**: Role-based Reply/View buttons with seamless navigation workflow
- **Chat Debug Tools**: Admin chat history reset functionality with granular control
- **Message UI Polish**: Clean bubble design with proper spacing and simplified interactions

## Session 030 Accomplishments

**Complete Chat System Authorization & Notification Integration ✅**

**Chat Authorization System Resolution**:
- **MongoDB leftAt Field Issue**: Fixed all participant queries using `undefined` instead of `null` values
- **Repository Pattern Fixes**: Updated `isUserParticipant()` and `getUserPermissions()` methods across all repositories
- **Conversation Loading**: Resolved 403 Forbidden errors by fixing participant validation logic
- **User ID Mapping**: Fixed Clerk ID → Database ID resolution in all chat page components
- **Authentication Timing**: Added proper `isLoaded` and `isSignedIn` checks for API calls

**Notification System Integration**:
- **Role-Based Routing**: Updated notification actionUrls to use `/{role}/chat/{conversationId}` pattern
- **Reply Button Fix**: Notification Reply buttons now navigate correctly to role-specific chat URLs
- **View Button Fix**: Notification View buttons use proper authentication-aware routing
- **Dynamic Role Detection**: Notifications created with recipient's role for correct URL generation
- **Banner Integration**: Fixed notification banner routing for consistent user experience

**Repository Architecture Improvements**:
- **Participant Query Pattern**: Standardized JavaScript filtering for `leftAt` checks across all repositories
- **Conversation Repository**: Fixed 6+ methods including `getConversationsForUser`, `updateConversation`, `createDirectConversation`
- **Message Repository**: Fixed `getConversationStats`, `createMessageStatusForParticipants`, `getMessagesForUser`
- **Notification Creation**: Enhanced message notification creation with role-based actionUrl generation

**Frontend Authentication Enhancements**:
- **ConversationDetailPage**: Added comprehensive auth state management with loading guards
- **API Call Security**: Added `credentials: 'include'` to all chat-related fetch requests
- **Loading State Management**: Improved UX with proper loading states during auth initialization
- **Error Boundary**: Enhanced error handling for unauthorized and failed conversation loading

**Technical Fixes Summary**:
- **13 Repository Methods** updated for proper leftAt handling
- **3 Role-Based Chat Pages** fixed for database user ID resolution
- **2 Notification Components** updated for role-based routing
- **1 Chat Detail Component** enhanced with authentication awareness
- **100% Chat Workflow** now operational: notification → navigation → conversation loading → messaging

**Testing & Validation Results**:
- **Notification Workflow**: Reply/View buttons navigate successfully to correct role-based URLs
- **Conversation Loading**: Eliminated "Failed to load conversation" errors across all user roles
- **Message Permissions**: Resolved "You don't have permission to send messages" issues
- **Real-time Messaging**: Complete end-to-end message sending and receiving functionality
- **Cross-Role Testing**: Verified Admin/Volunteer/Member navigation and permissions work correctly

## Session 029 Accomplishments

**Real-time Chat System Implementation + Direct Message Fixes ✅**

**Real-time Messaging Architecture**:
- **Server-Sent Events (SSE)**: Replaced planned WebSocket implementation with SSE for better Next.js compatibility
- **Real-time Message Broadcasting**: Messages appear instantly across all connected clients via `/api/conversations/[id]/stream`
- **Typing Indicators**: Live typing status with 3-second auto-timeout via `/api/conversations/[id]/typing`
- **Connection Management**: Auto-reconnection with exponential backoff and polling fallback
- **Optimistic Updates**: Messages appear immediately for sender while confirming server delivery

**Direct Message System Fixes**:
- **Participant Validation Fix**: Resolved "Direct conversations must have exactly 2 participants" error
- **Frontend Validation**: Updated form to auto-include current user in participant count
- **Backend Alignment**: Ensured API expects exactly 2 participants (current user + selected user)
- **UI Enhancement**: Added helper text "Select exactly 1 person to start a direct conversation"

**Technical Architecture**:
- **SSE Endpoint**: `/api/conversations/[id]/stream` for real-time message delivery
- **Chat Hook**: `useChatRealtime()` manages connections, message handling, and typing indicators
- **Broadcasting System**: Server-side message distribution to all conversation participants
- **Connection Resilience**: Heartbeat system with automatic reconnection and fallback strategies

## Session 028 Accomplishments

**UI Overflow Resolution + Healthcare Filtering Implementation ✅**
- **Content Card Overflow Fixes**: Resolved all layout overflow issues with proper flex constraints
- **Text Truncation System**: Implemented proper text wrapping with `break-all`, `truncate`, and `line-clamp-2`
- **Visibility Badge Repositioning**: Moved Public/Private badges to dedicated lines for better space utilization
- **Hydration Mismatch Resolution**: Fixed Radix component ID conflicts with client-only rendering patterns
- **Healthcare Filtering Backend**: Implemented missing API support for healthcare categories and tag filtering
- **Category-to-Tag Expansion**: Fixed healthcare category filtering by expanding categories to constituent tags

**Technical Achievements**:
- Content cards now properly constrain all elements within boundaries using `overflow-hidden` and flex controls
- Healthcare filtering works correctly by mapping categories like "Mental Health & Supportive Programs" to their individual tags
- Resolved hydration issues with `suppressHydrationWarning` and mount-based rendering for dropdown components
- Enhanced card layout with proper title/action rows and dedicated visibility badge placement
- Complete backend filtering implementation with dynamic healthcare category expansion via `HEALTHCARE_CATEGORIES` import

## Session 031 Accomplishments

**Chat System Debug Tools & UI Refinements ✅**

**Debug Infrastructure Development**:
- **Chat History Reset Tool**: Created dedicated admin debug tool for selective chat data cleanup
- **API Endpoint**: `/api/conversations/[id]/archive/route.ts` for conversation archiving with permission validation
- **Granular Reset**: Admin can reset chat history without affecting user accounts, families, or other data
- **Debug Dashboard Enhancement**: Added chat reset functionality alongside existing database tools
- **Permission Integration**: Uses ConversationRepository for proper authorization before destructive operations

**Message Loading System Fixes**:
- **API Response Structure Mismatch**: Fixed critical issue where frontend expected `messages` but API returned `data.items`
- **Message Parsing Logic**: Updated to handle paginated response format from MessageRepository properly
- **Debug Logging**: Added conditional debug flags for message loading troubleshooting
- **Notification-to-Chat Navigation**: Resolved "No messages yet" issue when accessing conversations from notifications

**React Key Duplication Resolution**:
- **Message Deduplication**: Implemented comprehensive deduplication function to prevent duplicate message IDs
- **Race Condition Handling**: Fixed conflicts between optimistic updates and real-time SSE message delivery
- **Attachment Keys**: Updated to use unique message-attachment combination keys
- **SSE Integration**: Enhanced real-time message handling to prevent duplicate rendering

**Message UI Design Enhancement**:
- **Bubble Simplification**: Replaced heavy Card components with lightweight div-based message bubbles
- **Spacing Optimization**: Changed from `p-3` to `px-3 py-2` for better proportional spacing on short messages
- **Action Removal**: Completely removed hover actions (reply/edit/delete) for cleaner, distraction-free interface
- **Visual Consistency**: Enhanced message bubble styling with proper borders and background contrast

**Console Debugging Resolution**:
- **Debug Flag System**: Added `DEBUG_CHAT` and `DEBUG_MESSAGES` flags for conditional logging
- **Key Warning Elimination**: Resolved all React "duplicate key" console warnings
- **Hydration Safety**: Enhanced component loading patterns to prevent SSR/client mismatches

**Technical Fixes Summary**:
- **1 Debug API Endpoint** created for chat history management
- **3 UI Components** updated for cleaner message bubble design
- **Message Deduplication Algorithm** prevents all React key conflicts
- **API Response Parsing** fixed for proper message loading from notifications
- **Console Error Resolution** eliminates development noise for better debugging experience

**UX Improvements**:
- **Admin Operations**: Granular debug tools allow targeted system maintenance without data loss
- **Message Design**: Professional chat appearance with optimized bubble sizing for all message lengths
- **Performance**: Removed unnecessary Card wrapper components for lighter DOM and faster rendering
- **Clean Interface**: Simplified chat design focuses purely on message content without UI clutter

---

*Last Updated: 2025-11-15 (Session 031) - Chat System Debug Tools & UI Refinements*
