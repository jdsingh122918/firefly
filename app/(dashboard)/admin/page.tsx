import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users,
  UserPlus,
  Building,
  Calendar,
  FileText,
  Heart,
  MessageSquare,
  MessagesSquare,
  Activity,
  TrendingUp,
  FileImage,
  CheckSquare
} from 'lucide-react'
import { UserRepository } from '@/lib/db/repositories/user.repository'
import { FamilyRepository } from '@/lib/db/repositories/family.repository'
import { NoteRepository } from '@/lib/db/repositories/note.repository'
import { ForumRepository } from '@/lib/db/repositories/forum.repository'
import { DocumentRepository } from '@/lib/db/repositories/document.repository'
import { UserRole } from '@/lib/auth/roles'

export default async function AdminDashboard() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  const userRole = (sessionClaims?.metadata as { role?: string })?.role

  console.log('🔍 Admin dashboard access check:', {
    userRole,
    userRoleType: typeof userRole,
    expected: UserRole.ADMIN,
    matches: userRole === UserRole.ADMIN
  });

  // Only admins can access this page
  if (userRole !== UserRole.ADMIN) {
    console.log('❌ Admin access denied, redirecting to sign-in');
    redirect('/sign-in')
  }

  // Fetch dashboard statistics
  const userRepository = new UserRepository()
  const familyRepository = new FamilyRepository()
  const noteRepository = new NoteRepository()
  const forumRepository = new ForumRepository()
  const documentRepository = new DocumentRepository()

  const [userStats, familyStats, noteStats, forumStats, documentStats] = await Promise.all([
    userRepository.getUserStats(),
    familyRepository.getFamilyStats(),
    noteRepository.getNoteStats(),
    forumRepository.getForumStats(),
    documentRepository.getDocumentStats()
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Admin Dashboard</h2>
        <p className="text-muted-foreground">
          Manage users, families, and platform settings
        </p>
      </div>

      {/* User & Family Metrics */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <h3 className="text-lg font-medium">User & Family Management</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{userStats.total}</div>
              <p className="text-xs text-muted-foreground">
                All platform users
              </p>
            </CardContent>
          </Card>

          <Card className="p-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Volunteers</CardTitle>
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{userStats.volunteers}</div>
              <p className="text-xs text-muted-foreground">
                Active volunteers
              </p>
            </CardContent>
          </Card>

          <Card className="p-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Families</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{familyStats.total}</div>
              <p className="text-xs text-muted-foreground">
                Families being served
              </p>
            </CardContent>
          </Card>

          <Card className="p-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Members</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{userStats.members}</div>
              <p className="text-xs text-muted-foreground">
                Community members
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Care Documentation Metrics */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4" />
          <h3 className="text-lg font-medium">Care Documentation</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Notes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{noteStats.totalNotes}</div>
              <p className="text-xs text-muted-foreground">
                All documentation
              </p>
            </CardContent>
          </Card>

          <Card className="p-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Care Plans</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{noteStats.carePlanNotes}</div>
              <p className="text-xs text-muted-foreground">
                Care plan documents
              </p>
            </CardContent>
          </Card>

          <Card className="p-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Documents</CardTitle>
              <FileImage className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{documentStats.totalDocuments}</div>
              <p className="text-xs text-muted-foreground">
                Uploaded files
              </p>
            </CardContent>
          </Card>

          <Card className="p-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assignments</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{noteStats.notesWithAssignments}</div>
              <p className="text-xs text-muted-foreground">
                Tasks assigned
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Community Engagement Metrics */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <h3 className="text-lg font-medium">Community Engagement</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Forums</CardTitle>
              <MessagesSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{forumStats.totalForums}</div>
              <p className="text-xs text-muted-foreground">
                Discussion spaces
              </p>
            </CardContent>
          </Card>

          <Card className="p-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Posts</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{forumStats.totalPosts}</div>
              <p className="text-xs text-muted-foreground">
                Discussion topics
              </p>
            </CardContent>
          </Card>

          <Card className="p-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Replies</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{forumStats.totalReplies}</div>
              <p className="text-xs text-muted-foreground">
                Community responses
              </p>
            </CardContent>
          </Card>

          <Card className="p-3">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold">{forumStats.postsThisMonth}</div>
              <p className="text-xs text-muted-foreground">
                Posts this month
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}