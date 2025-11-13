"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Crown,
  TrendingUp,
  Download,
  Shield,
  Activity,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportingData {
  userStats: {
    total: number;
    byRole: Record<string, number>;
    recentGrowth: {
      thisMonth: number;
      lastMonth: number;
      percentageChange: number;
    };
    verificationStats: {
      emailVerified: number;
      phoneVerified: number;
    };
  };
  familyStats: {
    total: number;
    totalMembers: number;
    averageMembersPerFamily: number;
    withPrimaryContact: number;
    recentActivity: {
      familiesCreatedThisMonth: number;
      membersAssignedThisMonth: number;
    };
  };
  engagementMetrics: {
    activeVolunteers: number;
    familiesCreatedByVolunteers: number;
    averageFamilySizeByVolunteer: number;
  };
}

interface BasicReportingDashboardProps {
  className?: string;
}

export function BasicReportingDashboard({ className }: BasicReportingDashboardProps) {
  const [data, setData] = useState<ReportingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("last30");
  const [exportFormat, setExportFormat] = useState("csv");
  const [exporting, setExporting] = useState(false);

  // Mock data for demonstration - replace with actual API calls
  useEffect(() => {
    const fetchReportingData = async () => {
      setLoading(true);
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock data - replace with actual API calls
      const mockData: ReportingData = {
        userStats: {
          total: 45,
          byRole: {
            ADMIN: 3,
            VOLUNTEER: 12,
            MEMBER: 30,
          },
          recentGrowth: {
            thisMonth: 8,
            lastMonth: 6,
            percentageChange: 33.3,
          },
          verificationStats: {
            emailVerified: 43,
            phoneVerified: 22,
          },
        },
        familyStats: {
          total: 18,
          totalMembers: 30,
          averageMembersPerFamily: 1.67,
          withPrimaryContact: 12,
          recentActivity: {
            familiesCreatedThisMonth: 4,
            membersAssignedThisMonth: 7,
          },
        },
        engagementMetrics: {
          activeVolunteers: 8,
          familiesCreatedByVolunteers: 15,
          averageFamilySizeByVolunteer: 1.25,
        },
      };

      setData(mockData);
      setLoading(false);
    };

    fetchReportingData();
  }, [dateRange]);

  const handleExport = async (type: 'families' | 'users') => {
    setExporting(true);
    try {
      const endpoint = type === 'families' ? '/api/families/export' : '/api/users/export';
      const params = new URLSearchParams({
        format: exportFormat,
        dateRange,
        includeMembers: 'true',
        includeContactInfo: 'true',
      });

      const response = await fetch(`${endpoint}?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${type}-export-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error(`Failed to export ${type}:`, error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-8 bg-muted animate-pulse rounded" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const StatCard = ({
    title,
    value,
    description,
    icon: Icon,
    trend
  }: {
    title: string;
    value: string | number;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    trend?: { value: number; isPositive: boolean }
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          {description}
        </p>
        {trend && (
          <div className="flex items-center space-x-2 text-xs mt-1">
            <TrendingUp className={cn(
              "h-3 w-3",
              trend.isPositive ? "text-green-500" : "text-red-500"
            )} />
            <span className={cn(
              "font-medium",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}>
              {trend.value > 0 ? '+' : ''}{trend.value}%
            </span>
            <span className="text-muted-foreground">from last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Platform Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive insights into user engagement and family management
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last30">Last 30 days</SelectItem>
              <SelectItem value="last90">Last 90 days</SelectItem>
              <SelectItem value="lastYear">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={data.userStats.total}
          description="Platform registered users"
          icon={Users}
          trend={{
            value: data.userStats.recentGrowth.percentageChange,
            isPositive: data.userStats.recentGrowth.percentageChange > 0
          }}
        />

        <StatCard
          title="Active Families"
          value={data.familyStats.total}
          description={`${data.familyStats.totalMembers} total members`}
          icon={Home}
          trend={{
            value: 15.2,
            isPositive: true
          }}
        />

        <StatCard
          title="Primary Contacts"
          value={data.familyStats.withPrimaryContact}
          description={`${Math.round((data.familyStats.withPrimaryContact / data.familyStats.total) * 100)}% of families`}
          icon={Crown}
        />

        <StatCard
          title="Active Volunteers"
          value={data.engagementMetrics.activeVolunteers}
          description={`Managing ${data.engagementMetrics.familiesCreatedByVolunteers} families`}
          icon={Shield}
        />
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">User Analytics</TabsTrigger>
          <TabsTrigger value="families">Family Management</TabsTrigger>
          <TabsTrigger value="engagement">Volunteer Engagement</TabsTrigger>
          <TabsTrigger value="exports">Data Export</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  User Distribution by Role
                </CardTitle>
                <CardDescription>Breakdown of user roles across the platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(data.userStats.byRole).map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant={
                        role === 'ADMIN' ? 'default' :
                        role === 'VOLUNTEER' ? 'secondary' : 'outline'
                      }>
                        {role}
                      </Badge>
                      <span className="text-sm font-medium">{count} users</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {Math.round((count / data.userStats.total) * 100)}%
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Verification Status
                </CardTitle>
                <CardDescription>User verification completion rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Email Verified</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{data.userStats.verificationStats.emailVerified}</span>
                    <Badge variant="outline">
                      {Math.round((data.userStats.verificationStats.emailVerified / data.userStats.total) * 100)}%
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Phone Verified</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{data.userStats.verificationStats.phoneVerified}</span>
                    <Badge variant="outline">
                      {Math.round((data.userStats.verificationStats.phoneVerified / data.userStats.total) * 100)}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="families" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Family Structure</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.familyStats.averageMembersPerFamily}</div>
                <p className="text-xs text-muted-foreground">Average members per family</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>New families</span>
                    <span className="font-medium">{data.familyStats.recentActivity.familiesCreatedThisMonth}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Member assignments</span>
                    <span className="font-medium">{data.familyStats.recentActivity.membersAssignedThisMonth}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Management Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.familyStats.withPrimaryContact}</div>
                <p className="text-xs text-muted-foreground">
                  Families with primary contact assigned
                </p>
                <Badge variant="outline" className="mt-2">
                  {Math.round((data.familyStats.withPrimaryContact / data.familyStats.total) * 100)}% coverage
                </Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Volunteer Performance Metrics</CardTitle>
              <CardDescription>
                Insights into volunteer activity and family management effectiveness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {data.engagementMetrics.activeVolunteers}
                  </div>
                  <div className="text-sm text-muted-foreground">Active Volunteers</div>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {data.engagementMetrics.familiesCreatedByVolunteers}
                  </div>
                  <div className="text-sm text-muted-foreground">Families Created</div>
                </div>

                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {data.engagementMetrics.averageFamilySizeByVolunteer}
                  </div>
                  <div className="text-sm text-muted-foreground">Avg. Family Size</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Export Settings</CardTitle>
                <CardDescription>Configure data export parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Export Format</label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Export Actions</CardTitle>
                <CardDescription>Download data exports for analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => handleExport('families')}
                  disabled={exporting}
                  className="w-full"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? 'Exporting...' : 'Export Families Data'}
                </Button>

                <Button
                  onClick={() => handleExport('users')}
                  disabled={exporting}
                  className="w-full"
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exporting ? 'Exporting...' : 'Export Users Data'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}