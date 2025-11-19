'use client';

/**
 * Advance Directive Management Dashboard
 * Complete integration example showing the full workflow
 * Demonstrates the system in action with all components
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Users,
  BarChart3,
  Settings,
  CheckCircle,
  Clock,
  AlertCircle,
  Play,
  Send,
  Download
} from 'lucide-react';
import AdvanceDirectiveAssignments from '@/components/admin/advance-directive-assignments';

// Mock data for demonstration
const MOCK_STATS = {
  totalTemplates: 6,
  activeAssignments: 24,
  completedAssignments: 18,
  familiesInvolved: 8,
  completionRate: 75
};

const MOCK_RECENT_ACTIVITY = [
  {
    id: '1',
    type: 'assignment_created',
    user: 'John Doe',
    template: 'Healthcare Values Assessment',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    status: 'pending'
  },
  {
    id: '2',
    type: 'form_completed',
    user: 'Jane Smith',
    template: 'Medical Team & Contact Information',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    status: 'completed'
  },
  {
    id: '3',
    type: 'assignment_created',
    user: 'Bob Johnson',
    template: 'Advance Directive Overview',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    status: 'in_progress'
  }
];

const MOCK_ASSIGNMENTS = [
  {
    id: '1',
    template: 'Advance Directive Overview & Importance',
    assignedTo: 'John Doe',
    family: 'Doe Family',
    status: 'completed',
    priority: 'medium',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    completionRate: 100
  },
  {
    id: '2',
    template: 'Healthcare Values & Quality of Life Assessment',
    assignedTo: 'Jane Smith',
    family: 'Smith Family',
    status: 'in_progress',
    priority: 'high',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    completionRate: 65
  },
  {
    id: '3',
    template: 'Medical Team & Contact Information',
    assignedTo: 'Bob Johnson',
    family: 'Johnson Family',
    status: 'pending',
    priority: 'medium',
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    completionRate: 0
  }
];

// Components
const StatsOverview: React.FC<{ stats: typeof MOCK_STATS }> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Templates</p>
              <p className="text-2xl font-bold">{stats.totalTemplates}</p>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{stats.activeAssignments}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">{stats.completedAssignments}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Families</p>
              <p className="text-2xl font-bold">{stats.familiesInvolved}</p>
            </div>
            <Users className="h-8 w-8 text-purple-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-bold">{stats.completionRate}%</p>
            </div>
            <BarChart3 className="h-8 w-8 text-orange-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const RecentActivity: React.FC<{ activities: typeof MOCK_RECENT_ACTIVITY }> = ({ activities }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'assignment_created':
        return <Send className="w-4 h-4 text-blue-500" />;
      case 'form_completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'pending': 'destructive',
      'in_progress': 'default',
      'completed': 'outline'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {activities.map(activity => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                {getActivityIcon(activity.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    <span className="text-primary">{activity.user}</span>
                    {activity.type === 'assignment_created' ? ' was assigned' : ' completed'}{' '}
                    <span className="font-semibold">{activity.template}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activity.timestamp.toLocaleString()}
                  </p>
                </div>
                {getStatusBadge(activity.status)}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const AssignmentsList: React.FC<{ assignments: typeof MOCK_ASSIGNMENTS }> = ({ assignments }) => {
  const getStatusBadge = (status: string) => {
    const variants = {
      'pending': 'secondary',
      'in_progress': 'default',
      'completed': 'outline'
    } as const;

    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'in_progress': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800'
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'} className={colors[status as keyof typeof colors]}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      'low': 'bg-gray-100 text-gray-800',
      'medium': 'bg-blue-100 text-blue-800',
      'high': 'bg-orange-100 text-orange-800',
      'urgent': 'bg-red-100 text-red-800'
    };

    return (
      <Badge variant="outline" className={colors[priority as keyof typeof colors]}>
        {priority}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Assignments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {assignments.map(assignment => (
            <div key={assignment.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{assignment.template}</h4>
                  <p className="text-sm text-muted-foreground">
                    Assigned to: <span className="font-medium">{assignment.assignedTo}</span> ({assignment.family})
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-right">
                  {getStatusBadge(assignment.status)}
                  {getPriorityBadge(assignment.priority)}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Due: {assignment.dueDate.toLocaleDateString()}
                </span>
                <span className="text-muted-foreground">
                  Progress: {assignment.completionRate}%
                </span>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${assignment.completionRate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Main Page Component
export default function AdvanceDirectivesPage() {
  const [assignmentCreated, setAssignmentCreated] = useState(false);

  const handleAssignmentCreated = (assignments: any[]) => {
    console.log('Created assignments:', assignments);
    setAssignmentCreated(true);
    // In real implementation, you would refresh the data here
    setTimeout(() => setAssignmentCreated(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advance Directive Management</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive end-of-life care planning system with interactive templates and assignment workflow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Reports
          </Button>
          <Button variant="outline" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Success Alert */}
      {assignmentCreated && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-800 font-medium">
              Advance directive assignments created successfully!
            </p>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <StatsOverview stats={MOCK_STATS} />

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assignments">Create Assignments</TabsTrigger>
          <TabsTrigger value="management">Manage Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AssignmentsList assignments={MOCK_ASSIGNMENTS} />
            <RecentActivity activities={MOCK_RECENT_ACTIVITY} />
          </div>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-6">
          <AdvanceDirectiveAssignments
            userRole="ADMIN"
            userId="current-user-id"
            onAssignmentCreated={handleAssignmentCreated}
          />
        </TabsContent>

        <TabsContent value="management" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="text-lg font-medium mb-2">Template Management</h4>
                <p className="text-muted-foreground mb-4">
                  Advanced template editing and customization features coming soon.
                  Current templates are system-generated and can be seeded using the database script.
                </p>
                <div className="flex justify-center gap-2">
                  <Button variant="outline">
                    View System Templates
                  </Button>
                  <Button variant="outline">
                    Import Custom Templates
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Implementation Notes */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-800">Implementation Guide</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-700">
          <div className="space-y-3 text-sm">
            <div>
              <strong>1. Database Setup:</strong> Run <code>npx tsx scripts/create-system-admin.ts</code> followed by <code>npx tsx scripts/seed-advance-directives.ts</code> to set up the system.
            </div>
            <div>
              <strong>2. Content Assignment:</strong> Use the "Create Assignments" tab to assign advance directive templates to family members.
            </div>
            <div>
              <strong>3. Form Completion:</strong> Members receive assignments in their dashboard and complete interactive forms.
            </div>
            <div>
              <strong>4. Progress Tracking:</strong> Monitor completion status through the overview dashboard.
            </div>
            <div>
              <strong>5. Video Integration:</strong> Members can add video wishes with QR code generation for easy sharing.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}