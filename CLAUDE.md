# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Rules
- **Context Continuity**: Read `@CLAUDE.md` at session start, update at session end
- **Dev Server Management**: NEVER start/kill dev servers unless explicitly requested

## Project Overview
**Firefly**: End of Life Care Platform - Next.js 16, TypeScript, MongoDB, role-based access (ADMIN/VOLUNTEER/MEMBER)
- 44 Prisma models, 22 enums, 75+ API routes, unified Resource system (replaces separate Notes/Content systems)
- Real-time SSE chat, healthcare tagging (8 categories, 39+ tags), production-ready accessibility features
- Enterprise-grade security with HIPAA compliance indicators, auto-save, and comprehensive error boundaries

**Key Development Commands**:
```bash
# Core Development
npm run dev                                    # Start development server
npm run build                                  # Build production (includes Prisma generate)
npm run lint                                   # Run ESLint

# Database Management
npx tsx scripts/initialize-database.ts        # Interactive setup (Local MongoDB/Atlas)
npx prisma generate && npx prisma db push    # Update schema and database
npm run db:validate-full                      # Comprehensive database health checks
npm run db:seed-tags                          # Initialize healthcare tag system
npm run db:backup                             # Create database backup

# Production Database
npm run db:init                               # Initialize production database
npm run db:init:force                         # Force initialization (destructive)
npm run db:validate                           # Validate schema only

# Development Tools
npx tsx scripts/test-editor.ts               # Test Editor.js integration
npx tsx scripts/validate-database.ts --repair # Database health checks with auto-repair
lsof -i :3000                                # Debug port conflicts
```

**Architecture**: `app/(dashboard)/` (role-based pages) • `app/api/` (75+ REST endpoints) • `lib/db/repositories/` (data access layer) • `components/` (reusable UI) • `lib/` (utilities/types)

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

**Interactive Setup (Recommended)**:
```bash
npx tsx scripts/initialize-database.ts
```
Choose between Local MongoDB or MongoDB Atlas with guided configuration.

**Manual Local MongoDB**:
```bash
docker run --name mongodb -d -p 27017:27017 mongodb/mongodb-community-server:latest --replSet rs0
docker exec mongodb mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"
```

**Manual Atlas Setup**:
Update `.env.local` with Atlas connection string:
```
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/firefly?retryWrites=true&w=majority"
```

**Workflow**:
1. **Database Setup**: `npx tsx scripts/initialize-database.ts` (choose Local MongoDB or Atlas)
2. **Start Server**: `npm run dev`
3. **Account Setup**: Create Clerk account → `/admin/debug` → "Sync Current User"

## Current Status: Production-Ready Healthcare Platform ✅
- **Real-Time Communication**: SSE-based chat with typing indicators, reactions, emoji support, markdown formatting
- **Advanced Healthcare Directives**: Interactive forms with QR codes, auto-save, progress tracking
- **Role-Based Access Control**: ADMIN/VOLUNTEER/MEMBER permissions with family-scoped security constraints
- **Accessibility Features**: Font scaling, high contrast mode, 44px touch targets, WCAG 2.1 AA compliance
- **Healthcare Data Security**: HIPAA compliance indicators, privacy transparency, encryption badges
- **File Management**: Database storage (15MB limit) with document linking across all features
- **Professional UI**: Mobile-responsive design with dark mode, glass morphism, optimized spacing
- **Resource Management**: Unified system replacing separate Notes/Content with curation and rating support
- **Forum System**: Community discussions with voting, moderation, role-based access
- **Family Coordination**: Multi-member families with volunteer management

## Development Tools
- **Database Initialization**: `npx tsx scripts/initialize-database.ts` - Interactive setup for Local/Atlas databases
- **Debug Dashboard**: `/admin/debug` - User sync, database monitoring, chat history reset
- **Health Checks**: `npx tsx scripts/validate-database.ts --repair`
- **Editor Testing**: `npx tsx scripts/test-editor.ts` - Comprehensive Editor.js functionality validation
- **Port Debug**: `lsof -i :3000`

## Immediate Development Priorities
- **Auto-Save Integration**: Extend auto-save system to all form components beyond advance directives
- **Advanced Search**: Full-text indexing across resources and chat messages
- **Admin User Management**: Enhanced user role management and family interfaces
- **Mobile Experience**: Optimize touch interactions and form completion on mobile devices

## Key Technical Learnings

**Critical Architecture Patterns**:
- **Repository Pattern**: ALL data access via repositories, never direct Prisma queries
- **User ID Mapping**: Always resolve Clerk ID → Database ID to prevent ObjectID errors
- **Real-time Architecture**: SSE preferred over WebSockets in Next.js for reliability
- **Dynamic Import SSR Prevention**: Use Next.js dynamic imports with `ssr: false` for client-only libraries
- **Transaction Safety**: Wrap multi-step operations in `prisma.$transaction()` for data consistency
- **Family-Scoped Security**: Volunteers restricted to families they created using `getFamiliesByCreator()` pattern
- **React Hook Optimization**: Use `useMemo` for complex object creation to prevent infinite re-renders
- **Draft.js State Validation**: Always validate EditorState with `getCurrentContent` before rendering Editor components
- **Editor.js Integration**: Use ref-based onChange handling with `useRef` to prevent re-initialization loops in useEffect dependencies
- **Module Resolution Safety**: Prefer standard packages over isomorphic variants to prevent Next.js build failures
- **Button Focus Management**: Use `onMouseDown={(e) => e.preventDefault()}` to prevent focus theft from textareas
- **Hook Instance Safety**: Never create new hook instances in callbacks; reuse existing hook functions
- **Markdown Content Detection**: Smart content type detection with fallback rendering for Editor.js/markdown/plain text

**UI/UX Best Practices**:
- **Accessibility First**: min-h-[44px] touch targets, font scaling support, high contrast mode, WCAG 2.1 compliance
- **Healthcare Privacy**: HIPAA badges, privacy level indicators, data access transparency in sensitive areas
- **Auto-Save Integration**: 30-second intervals, LocalStorage backup, visual status indicators, conflict resolution
- **Content-Dense Spacing**: Use p-3, space-y-2/3 for professional healthcare UI density
- **Modal → Page Evolution**: Dedicated pages for complex workflows (resource editing, content management)
- **Full Card Interaction**: Make entire cards clickable, prominent primary action buttons
- **Theme-Aware Components**: CSS variables (bg-accent, text-foreground), comprehensive dark mode support
- **Glass Morphism UI**: backdrop-blur-sm with transparency for modern healthcare aesthetic
- **Professional Navigation**: Integrated breadcrumbs, role-based sidebar navigation, clear information hierarchy

**Database & Performance**:
- **Composite Index Optimization**: Use `@@index([field1, field2])` for common query patterns
- **Participant Query Pattern**: Use JavaScript filtering for `leftAt` checks instead of `leftAt: null` queries
- **Connection Pool Recovery**: Restart dev server with explicit DATABASE_URL after container restarts
- **Graceful API Degradation**: Systems remain functional even when components fail to load

**Development Workflow**:
- **Repository Pattern Enforcement**: ALL data access via repositories in `lib/db/repositories/`, never direct Prisma
- **Auto-Save Integration**: Extend `lib/utils/auto-save.ts` pattern to all forms requiring persistence
- **Accessibility Testing**: Test with font scaling, high contrast mode, keyboard navigation, screen readers
- **Healthcare Compliance**: Include privacy components from `components/shared/privacy-security.tsx`
- **Authentication-Aware Components**: Always check `isLoaded` and `isSignedIn` before API calls
- **Error Boundaries**: Comprehensive error handling with loading states and graceful degradation
- **Performance Optimization**: Use `useMemo` for complex objects, avoid infinite re-rendering loops
- **Bundle Optimization**: Regular dependency auditing prevents bloat (TipTap removal saved 2MB)
- **Editor Component Stability**: Use `useRef` for stable function references, avoid `onChange` in useEffect

## New Component Integration Patterns

**Auto-Save Forms**:
```typescript
import { useAutoSave } from '@/lib/utils/auto-save';
import { SaveStatusIndicator } from '@/components/shared/save-status-indicator';

// Standard auto-save implementation with 30s intervals and LocalStorage backup
const autoSave = useAutoSave({
  interval: 30000,
  storageKey: `form-${contentId}-${userId}`,
  onSave: async (data) => await repository.saveFormData(data),
});
```

**Accessibility Controls**:
```typescript
import { AccessibilityWidget } from '@/components/ui/accessibility-controls';

// Add to any page with forms or complex interactions
<AccessibilityWidget showLabels />
```

**Healthcare Privacy**:
```typescript
import { HealthcarePrivacyHeader, FormPrivacyFooter } from '@/components/shared/privacy-security';

// Standard privacy header for healthcare forms
<HealthcarePrivacyHeader formType="medical information" accessLevel="family" />
```

---

*Last Updated: 2025-11-27 - Removed ResourceAssignment feature (kept VolunteerFamilyAssignment for volunteer-family management)*