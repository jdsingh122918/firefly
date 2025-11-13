import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Heart, MessageSquare, FileText, Calendar, Users, Mail, User } from 'lucide-react'
import { UserRepository } from '@/lib/db/repositories/user.repository'

const userRepository = new UserRepository()

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

  if (user?.family) {
    try {
      // Get all family members
      familyMembers = await userRepository.getAllUsers({
        familyId: user.family.id
      })
      console.log('👨‍👩‍👧‍👦 Member dashboard - family data:', {
        userId: user.id,
        familyName: user.family.name,
        memberCount: familyMembers.length
      })
    } catch (error) {
      console.error('❌ Error fetching family members:', error)
    }
  }

  return (
    <div className="space-y-6">
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Family</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Coming soon - messaging
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resources</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Coming soon - documents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Coming soon - scheduling
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Family Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Heart className="h-5 w-5" />
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

        {/* Support & Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Support & Resources</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-900">Care Coordination</h3>
                <p className="text-sm text-blue-800 mt-1">
                  Your volunteer coordinator will help connect you with resources and support services.
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-medium text-green-900">24/7 Support</h3>
                <p className="text-sm text-green-800 mt-1">
                  Emergency support and resources are available around the clock for urgent needs.
                </p>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h3 className="font-medium text-purple-900">Community Connection</h3>
                <p className="text-sm text-purple-800 mt-1">
                  Connect with other families and share experiences in our supportive community.
                </p>
              </div>

              <Separator />

              <div className="text-center">
                <h4 className="font-medium mb-2">Need Help?</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Reach out to your volunteer coordinator or contact support.
                </p>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full">
                    <Mail className="mr-2 h-4 w-4" />
                    Contact Support
                  </Button>
                  {user?.family && (
                    <Button variant="outline" size="sm" className="w-full">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Message Family
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Personal Information */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>My Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}