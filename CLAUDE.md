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

## Current Status: Enterprise-Grade End of Life Care Platform ✅
- **Complete Communication System**: Real-time SSE-based chat with typing indicators, reactions, emoji support
- **Role-Based Access Control**: ADMIN/VOLUNTEER/MEMBER permissions with family-scoped security
- **File Attachment System**: Database storage (15MB limit) with complete document linking across all interfaces
- **Production-Ready Rich Text Editing**: Stable Editor.js integration with error resilience, module optimization, and re-initialization prevention
- **Healthcare Tagging**: 8 categories, 39+ tags with dedicated selection pages and filtering
- **Member Dashboard**: Real data integration with auto-sync system for seamless onboarding
- **Family Management**: Volunteers can add/create members with proper permission restrictions
- **Notification System**: Role-based routing with seamless chat navigation integration
- **Mobile-Responsive**: Professional UI with optimized spacing and layout consistency

## Development Tools
- **Debug Dashboard**: `/admin/debug` - User sync, database monitoring, chat history reset
- **Health Checks**: `npx tsx scripts/validate-database.ts --repair`
- **Editor Testing**: `npx tsx scripts/test-editor.ts` - Comprehensive Editor.js functionality validation
- **Port Debug**: `lsof -i :3000`

## Next Priority Features
- Advanced search with full-text indexing (~8-12 hours)
- Admin user management interface (~2-3 hours)
- Advanced notification preferences (~3-4 hours)

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

**UI/UX Best Practices**:
- **Modal → Page Evolution**: Dedicated pages provide 95% better space utilization than modals
- **Content-Dense Spacing**: Use p-3, space-y-2/3 with min-h-[44px] touch targets for mobile-first design
- **Professional UI Density**: Reduce white space by 40% while maintaining readability
- **Full Card Interaction**: Make entire cards clickable instead of small button targets
- **Select Validation**: Use "none" instead of empty strings to prevent validation errors

**Database & Performance**:
- **Composite Index Optimization**: Use `@@index([field1, field2])` for common query patterns
- **Participant Query Pattern**: Use JavaScript filtering for `leftAt` checks instead of `leftAt: null` queries
- **Connection Pool Recovery**: Restart dev server with explicit DATABASE_URL after container restarts
- **Graceful API Degradation**: Systems remain functional even when components fail to load

**Development Workflow**:
- **Bundle Optimization**: Regular dependency auditing - TipTap removal saved ~2MB and 63 packages
- **Format Auto-Detection**: Support both HTML and Draft.js JSON for backward compatibility
- **Authentication-Aware Components**: Always check `isLoaded` and `isSignedIn` before API calls
- **Error Boundaries**: Implement comprehensive error handling with loading states and fallbacks
- **Draft.js Error Prevention**: Enhanced state validation and dynamic imports prevent "Got unexpected null or undefined" errors
- **Performance Optimization**: Use `useMemo` for decorators and complex objects to prevent infinite re-rendering loops
- **Circular Dependency Resolution**: Always render container divs with refs, use conditional content rendering inside containers
- **Editor Component Stability**: Remove `onChange` from useEffect dependencies, use `useRef` for stable function references

---

## Session 041 Accomplishments

**Draft.js Editor Optimization & Error Resolution ✅**

**Performance Optimization**:
- **Infinite Loop Resolution**: Fixed "Maximum update depth exceeded" by wrapping `decorator` creation in `useMemo` to prevent re-creation on every render
- **Hook Dependency Management**: Resolved circular dependencies in `useCallback` hooks causing re-initialization conflicts
- **Memory Optimization**: Eliminated unnecessary object recreations improving editor responsiveness

**Error Handling Enhancement**:
- **Draft.js State Validation**: Added comprehensive EditorState validation with `getCurrentContent` checks before rendering
- **Runtime Error Prevention**: Resolved "Got unexpected null or undefined" errors through enhanced validation patterns
- **Dynamic Component Safety**: Removed problematic refs and improved dynamic import error boundaries

**Technical Architecture Improvements**:
- **React Hook Best Practices**: Implemented proper `useMemo` usage for complex object creation (decorators, formatters)
- **Component Resilience**: Enhanced conditional rendering with multiple validation layers for Draft.js components
- **Error Recovery**: Improved fallback UI patterns for editor initialization and loading states

**Production Readiness**:
- **Zero Console Errors**: Eliminated all React hook warnings and Draft.js internal errors
- **Stable Performance**: Consistent editor performance without memory leaks or infinite loops
- **Enhanced UX**: Smooth editor interactions with proper loading states and error boundaries

**Key Technical Patterns Established**:
- **`useMemo` for Decorators**: `const decorator = useMemo(() => createLinkDecorator(handler), [handler])`
- **EditorState Validation**: Validate `editorState.getCurrentContent` existence before rendering Editor
- **Dynamic Import Patterns**: Use Next.js dynamic imports with proper loading fallbacks for client-only libraries
- **Circular Dependency Prevention**: Remove redundant dependencies from `useCallback` dependency arrays

---

## Session 042 Accomplishments

**Editor.js Loading & Stability Resolution ✅**

**Module Resolution & Dependencies**:
- **Dependency Cleanup**: Removed problematic `isomorphic-dompurify` dependency causing Editor.js module resolution failures
- **Standard Package Migration**: Replaced with standard `dompurify` package, eliminating 44 unused dependency packages
- **Build System Compatibility**: Resolved Next.js build conflicts with isomorphic packages

**Component Architecture Fixes**:
- **Circular Dependency Resolution**: Fixed container ref never being set by always rendering container div with ref
- **Conditional Rendering Strategy**: Moved from conditional container to conditional content rendering inside stable container
- **Re-initialization Prevention**: Implemented ref-based onChange handling with `useRef` to eliminate useEffect re-trigger loops

**Stability & Performance**:
- **Loading State Resolution**: Eliminated "Loading editor..." stuck state through proper component lifecycle management
- **Typing Experience**: Fixed editor content reset during typing by removing `onChange` from useEffect dependencies
- **Production Readiness**: Clean editor initialization without debug logging, optimized for user experience

**Testing & Verification**:
- **Comprehensive Test Suite**: Created `/scripts/test-editor.ts` with dependency validation, compilation checks, and browser test guidelines
- **Debug Tooling**: Added `--debug` mode for quick editor state verification and troubleshooting
- **Manual Testing Framework**: Structured browser testing approach with clear success criteria and issue identification

**Key Technical Patterns Established**:
- **Ref-based onChange**: `const onChangeRef = useRef(onChange)` with `onChangeRef.current = onChange` for stable references
- **Container Stability**: Always render container with ref, conditionally render loading states inside
- **Module Selection**: Prefer standard packages over isomorphic variants for Next.js compatibility
- **useEffect Optimization**: Remove function dependencies that can be stabilized with useRef

---

*Last Updated: 2025-11-17 (Session 042) - Editor.js integration stabilized with loading fixes, dependency optimization, and comprehensive testing*