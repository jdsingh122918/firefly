'use client';

/**
 * Advance Directive Management Dashboard
 * Complete integration example showing the full workflow
 * Demonstrates the system in action with all components
 */

import React from 'react';
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
  AlertCircle,
  Send,
  Download
} from 'lucide-react';

// Mock data for demonstration
const MOCK_STATS = {
  totalTemplates: 6,
  familiesInvolved: 8,
  documentsCreated: 42
};

const MOCK_RECENT_ACTIVITY = [
  {
    id: '1',
    type: 'document_created',
    user: 'John Doe',
    template: 'Healthcare Values Assessment',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    status: 'draft'
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
    type: 'document_created',
    user: 'Bob Johnson',
    template: 'Advance Directive Overview',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    status: 'draft'
  }
];

// Components
const StatsOverview: React.FC<{ stats: typeof MOCK_STATS }> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-sm text-muted-foreground">Documents Created</p>
              <p className="text-2xl font-bold">{stats.documentsCreated}</p>
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
      case 'document_created':
        return <Send className="w-4 h-4 text-blue-500" />;
      case 'form_completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'draft': 'secondary',
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
                    {activity.type === 'document_created' ? ' created' : ' completed'}{' '}
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

// Main Page Component
export default function AdvanceDirectivesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advance Directive Management</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive end-of-life care planning system with interactive templates
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

      {/* Stats Overview */}
      <StatsOverview stats={MOCK_STATS} />

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="management">Manage Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
            <RecentActivity activities={MOCK_RECENT_ACTIVITY} />
          </div>
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
              <strong>2. Template Creation:</strong> Create advance directive templates through the Resources system.
            </div>
            <div>
              <strong>3. Form Completion:</strong> Members access templates and complete interactive forms.
            </div>
            <div>
              <strong>4. Video Integration:</strong> Members can add video wishes with QR code generation for easy sharing.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}