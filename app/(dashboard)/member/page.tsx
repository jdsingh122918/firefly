import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Heart, MessageSquare, FileText, Calendar, Users, Mail, User, Eye, Plus, BookOpen } from 'lucide-react'
import { UserRepository } from '@/lib/db/repositories/user.repository'
import { ConversationRepository } from '@/lib/db/repositories/conversation.repository'
import { ResourceRepository } from '@/lib/db/repositories/resource.repository'
import { ForumRepository } from '@/lib/db/repositories/forum.repository'
import { NotificationRepository } from '@/lib/db/repositories/notification.repository'
import { prisma } from '@/lib/db/prisma'

const userRepository = new UserRepository()
const conversationRepository = new ConversationRepository()
const resourceRepository = new ResourceRepository(prisma)
const forumRepository = new ForumRepository()
const notificationRepository = new NotificationRepository()

export default async function MemberDashboard() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  const userRole = (sessionClaims?.metadata as { role?: string })?.role

  console.log('🔍 Member dashboard access check:', {
    userRole,
    userRoleType: typeof userRole,
    note: 'All authenticated users can access member dashboard'
  });

  // Get user data including family information
  const user = await userRepository.getUserByClerkId(userId)
  let familyMembers: Array<{ id: string; firstName: string | null; lastName?: string | null; role: string; email: string }> = []
  let userStats = { conversations: 0, unreadNotifications: 0, content: 0, recentForums: 0 }

  if (user) {
    try {
      // Get family members if user has a family
      if (user?.family) {
        familyMembers = await userRepository.getAllUsers({
          familyId: user.family.id
        })
        console.log('👨‍👩‍👧‍👦 Member dashboard - family data:', {
          userId: user.id,
          familyName: user.family.name,
          memberCount: familyMembers.length
        })
      }

      // Fetch user-specific data
      const [conversations, notifications, content] = await Promise.allSettled([
        conversationRepository.getConversationsForUser(user.id),
        notificationRepository.getUnreadCount(user.id),
        resourceRepository.filter({
          createdBy: user.id,
          page: 1,
          limit: 5
        }, user.id, user.role)
      ])

      userStats = {
        conversations: conversations.status === 'fulfilled' ? conversations.value.total : 0,
        unreadNotifications: notifications.status === 'fulfilled' ? notifications.value : 0,
        content: content.status === 'fulfilled' ? content.value.total : 0,
        recentForums: 0 // Will be updated when we add forum integration
      }

      console.log('📊 Member dashboard stats:', userStats)
    } catch (error) {
      console.error('❌ Error fetching member dashboard data:', error)
    }
  }

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome{user?.firstName ? `, ${user.firstName}` : ''}
        </h2>
        <p className="text-muted-foreground">
          Your family support and care resources
        </p>
      </div>

      {/* Quick Info */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-[var(--healthcare-home)] bg-[hsl(var(--healthcare-home)/0.05)] hover:bg-[hsl(var(--healthcare-home)/0.08)] transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Family</CardTitle>
            <Heart className="h-4 w-4 text-[hsl(var(--healthcare-home))]" />
          </CardHeader>
          <CardContent>
            {user?.family ? (
              <>
                <div className="text-2xl font-bold truncate">{user.family.name}</div>
                <p className="text-xs text-muted-foreground">
                  {familyMembers.length} {familyMembers.length === 1 ? 'member' : 'members'}
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-muted-foreground">
                  No family assigned yet
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[var(--healthcare-mental)] bg-[hsl(var(--healthcare-mental)/0.05)] hover:bg-[hsl(var(--healthcare-mental)/0.08)] transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-[hsl(var(--healthcare-mental))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.conversations}</div>
            <p className="text-xs text-muted-foreground">
              Active conversations
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[var(--healthcare-education)] bg-[hsl(var(--healthcare-education)/0.05)] hover:bg-[hsl(var(--healthcare-education)/0.08)] transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Content</CardTitle>
            <FileText className="h-4 w-4 text-[hsl(var(--healthcare-education))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.content}</div>
            <p className="text-xs text-muted-foreground">
              Notes & resources
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[var(--ppcc-orange)] bg-[hsl(var(--ppcc-orange)/0.05)] hover:bg-[hsl(var(--ppcc-orange)/0.08)] transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notifications</CardTitle>
            <Calendar className="h-4 w-4 text-[hsl(var(--ppcc-orange))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.unreadNotifications}</div>
            <p className="text-xs text-muted-foreground">
              Unread notifications
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Family Information */}
        <Card className="border-l-4 border-l-[var(--healthcare-home)] bg-[hsl(var(--healthcare-home)/0.05)] hover:bg-[hsl(var(--healthcare-home)/0.08)] transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Heart className="h-5 w-5 text-[hsl(var(--healthcare-home))]" />
              <span>My Family</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user?.family ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">{user.family.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Your care support family group
                  </p>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3">Family Members ({familyMembers.length})</h4>
                  <div className="space-y-2">
                    {familyMembers.map((member) => (
                      <div key={member.id} className="flex items-center space-x-3 p-2 rounded-lg border">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {member.firstName ?
                              `${member.firstName[0]}${member.lastName?.[0] || ''}` :
                              member.email[0].toUpperCase()
                            }
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            {member.firstName ?
                              `${member.firstName} ${member.lastName || ''}`.trim() :
                              member.email
                            }
                            {member.id === user?.id && (
                              <span className="text-xs text-muted-foreground ml-2">(You)</span>
                            )}
                          </p>
                          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{member.email}</span>
                          </div>
                        </div>
                        <Badge variant={member.role === 'VOLUNTEER' ? 'default' : 'secondary'} className="text-xs">
                          {member.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-muted-foreground">No family assigned</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  You haven&apos;t been assigned to a family group yet. Contact your volunteer coordinator for assistance.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-l-4 border-l-[var(--healthcare-education)] bg-[hsl(var(--healthcare-education)/0.05)] hover:bg-[hsl(var(--healthcare-education)/0.08)] transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-[hsl(var(--healthcare-education))]" />
              <span>Quick Access</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Button asChild variant="outline" className="h-auto flex-col p-4">
                  <Link href="/member/chat">
                    <MessageSquare className="h-5 w-5 mb-2" />
                    <span className="text-sm">Chat</span>
                  </Link>
                </Button>

                <Button asChild variant="outline" className="h-auto flex-col p-4">
                  <Link href="/member/resources">
                    <FileText className="h-5 w-5 mb-2" />
                    <span className="text-sm">Content</span>
                  </Link>
                </Button>

                <Button asChild variant="outline" className="h-auto flex-col p-4">
                  <Link href="/member/forums">
                    <Users className="h-5 w-5 mb-2" />
                    <span className="text-sm">Forums</span>
                  </Link>
                </Button>

                <Button asChild variant="outline" className="h-auto flex-col p-4">
                  <Link href="/member/notifications">
                    <Calendar className="h-5 w-5 mb-2" />
                    <span className="text-sm">Notifications</span>
                  </Link>
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-medium text-blue-900">Create Content</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    Share notes, resources, and documentation
                  </p>
                  <div className="mt-2">
                    <Button size="sm" asChild>
                      <Link href="/member/resources/new">
                        <Plus className="mr-2 h-3 w-3" />
                        New Content
                      </Link>
                    </Button>
                  </div>
                </div>

                {user?.family && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <h3 className="font-medium text-green-900">Family Communication</h3>
                    <p className="text-sm text-green-800 mt-1">
                      Connect with your family members and volunteers
                    </p>
                    <div className="mt-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/member/chat">
                          <MessageSquare className="mr-2 h-3 w-3" />
                          Message Family
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Info */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Activity */}
        <Card className="border-l-4 border-l-[var(--ppcc-orange)] bg-[hsl(var(--ppcc-orange)/0.05)] hover:bg-[hsl(var(--ppcc-orange)/0.08)] transition-colors">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-[hsl(var(--ppcc-orange))]" />
                <span>Recent Activity</span>
              </CardTitle>
              <Button size="sm" variant="outline" asChild>
                <Link href="/member/resources">
                  <Eye className="mr-2 h-4 w-4" />
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userStats.content > 0 ? (
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg">
                    <div className="text-sm text-muted-foreground">
                      You have {userStats.content} content items
                    </div>
                    <Button size="sm" variant="ghost" asChild className="p-0 h-auto text-primary hover:underline">
                      <Link href="/member/resources">View your resources →</Link>
                    </Button>
                  </div>
                  {userStats.conversations > 0 && (
                    <div className="p-3 border rounded-lg">
                      <div className="text-sm text-muted-foreground">
                        You have {userStats.conversations} active conversations
                      </div>
                      <Button size="sm" variant="ghost" asChild className="p-0 h-auto text-primary hover:underline">
                        <Link href="/member/chat">Go to chat →</Link>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold text-muted-foreground">No recent activity</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get started by creating content or joining conversations.
                  </p>
                  <div className="mt-6 space-x-2">
                    <Button size="sm" asChild>
                      <Link href="/member/resources/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Content
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/member/chat">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Start Chat
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        {user && (
          <Card className="border-l-4 border-l-[var(--ppcc-gray)] bg-[hsl(var(--ppcc-gray)/0.05)] hover:bg-[hsl(var(--ppcc-gray)/0.08)] transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5 text-[hsl(var(--ppcc-gray))]" />
                <span>My Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium">Name</h4>
                    <p className="text-muted-foreground">
                      {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">Email</h4>
                    <p className="text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div>
                    <h4 className="font-medium">Phone</h4>
                    <p className="text-muted-foreground">
                      {user.phoneNumber || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">Member Since</h4>
                    <p className="text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Platform Stats</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Conversations</span>
                      <span>{userStats.conversations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Content Created</span>
                      <span>{userStats.content}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unread Notifications</span>
                      <span>{userStats.unreadNotifications}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}