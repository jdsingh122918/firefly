"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  UserCheck,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  Play,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { AssignmentCard } from "./assignment-card";
import { AssignmentForm } from "./assignment-form";
import {
  ResourceAssignment,
  AssignmentStatus,
  AssignmentPriority,
  UserRole
} from "@/lib/types";

interface AssignmentStats {
  assigned: number;
  inProgress: number;
  completed: number;
  overdue: number;
  created?: number; // For ADMIN/VOLUNTEER
}

interface AssignmentDashboardProps {
  className?: string;
}

export function AssignmentDashboard({ className }: AssignmentDashboardProps) {
  console.log('🎯 [Assignment Dashboard] Component initializing...');
  const { sessionClaims } = useAuth();
  const userRole = (sessionClaims?.metadata as { role?: UserRole })?.role || UserRole.MEMBER;
  console.log('🎯 [Assignment Dashboard] User role detected:', userRole);

  // Data state
  const [assignments, setAssignments] = useState<ResourceAssignment[]>([]);
  const [stats, setStats] = useState<AssignmentStats>({
    assigned: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [view, setView] = useState<"assigned" | "created">("assigned");
  const [sortBy, setSortBy] = useState<string>("createdAt");

  // UI state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<ResourceAssignment | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Permission checks
  const canCreateAssignments = userRole === UserRole.ADMIN || userRole === UserRole.VOLUNTEER;
  const canSwitchViews = canCreateAssignments;

  // Filter assignments client-side
  const filteredAssignments = assignments.filter((assignment) => {
    const matchesSearch = searchTerm === "" ||
      // Search in resource title
      assignment.resource?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      // Search in assignment title and description
      assignment.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.description?.toLowerCase().includes(searchTerm.toLowerCase());
      // TODO: Add notes field to ResourceAssignment model if needed for search
      // assignment.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || assignment.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || assignment.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Sort filtered assignments
  const sortedAssignments = [...filteredAssignments].sort((a, b) => {
    // Overdue items first
    const aOverdue = a.dueDate && new Date(a.dueDate) < new Date() &&
      a.status !== AssignmentStatus.COMPLETED;
    const bOverdue = b.dueDate && new Date(b.dueDate) < new Date() &&
      b.status !== AssignmentStatus.COMPLETED;

    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // Then by selected criteria
    switch (sortBy) {
      case "dueDate":
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return a.dueDate ? -1 : 1;
      case "priority":
        const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      case "status":
        return a.status.localeCompare(b.status);
      case "createdAt":
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  // Fetch assignments
  const fetchAssignments = useCallback(async () => {
    console.log('🔍 [Assignment Dashboard] FETCHASSIGNMENTS FUNCTION CALLED!', { view, sortBy });
    console.log('🔍 [Assignment Dashboard] Starting to fetch assignments', { view, sortBy });
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        view,
        page: "1",
        limit: "50",
        sortBy,
        sortOrder: "desc"
      });

      const url = `/api/assignments?${params}`;
      console.log('🌐 [Assignment Dashboard] Making request to:', url);

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include', // Important: Include cookies for Clerk auth
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 [Assignment Dashboard] Response status:', response.status);
      console.log('📡 [Assignment Dashboard] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorDetails;
        try {
          // Try to parse JSON error response first
          const errorText = await response.text();
          try {
            errorDetails = JSON.parse(errorText);
          } catch {
            errorDetails = errorText;
          }
        } catch (readError) {
          errorDetails = `Failed to read error response: ${readError}`;
        }

        console.error('❌ [Assignment Dashboard] API Error:', {
          url: response.url,
          method: 'GET',
          status: response.status,
          statusText: response.statusText,
          error: errorDetails,
          headers: Object.fromEntries(response.headers.entries()),
          timestamp: new Date().toISOString()
        });

        // Provide user-friendly error messages based on status
        let userMessage = `Failed to load assignments (${response.status})`;
        if (response.status === 401) {
          userMessage = 'Authentication failed. Please sign in again.';
        } else if (response.status === 404) {
          userMessage = 'User not found. Please sync your account in Admin Debug.';
        } else if (response.status >= 500) {
          userMessage = 'Server error. Please try again or contact support.';
        }

        throw new Error(userMessage);
      }

      const data = await response.json();
      console.log('📦 [Assignment Dashboard] Response data:', {
        assignmentsCount: Array.isArray(data.assignments) ? data.assignments.length : 'not array',
        stats: data.stats,
        hasAssignments: !!data.assignments,
        dataKeys: Object.keys(data)
      });

      setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
      setStats(data.stats || { assigned: 0, inProgress: 0, completed: 0, overdue: 0 });

      console.log('✅ [Assignment Dashboard] Successfully loaded assignments');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load assignments';
      console.error('💥 [Assignment Dashboard] Error fetching assignments:', {
        error: err,
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(errorMessage);
      setAssignments([]);
    } finally {
      setLoading(false);
      console.log('🏁 [Assignment Dashboard] Fetch complete');
    }
  }, [view, sortBy]);

  // Load assignments on mount and when filters change
  useEffect(() => {
    console.log('🚀 [Assignment Dashboard] useEffect triggered, calling fetchAssignments');
    fetchAssignments();
  }, [fetchAssignments]);

  // Handle assignment status change
  const handleStatusChange = useCallback(async (assignment: ResourceAssignment, newStatus: AssignmentStatus) => {
    console.log('🔄 [Assignment Dashboard] Updating assignment status:', {
      assignmentId: assignment.id,
      currentStatus: assignment.status,
      newStatus
    });
    setUpdatingStatus(assignment.id);

    try {
      const url = `/api/assignments/${assignment.id}`;
      console.log('🌐 [Assignment Dashboard] PATCH request to:', url);

      const response = await fetch(url, {
        method: 'PATCH',
        credentials: 'include', // Include cookies for Clerk auth
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      console.log('📡 [Assignment Dashboard] Status update response:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [Assignment Dashboard] Status update failed:', {
          status: response.status,
          errorData
        });
        throw new Error(errorData.error || 'Failed to update assignment status');
      }

      console.log('✅ [Assignment Dashboard] Status updated successfully');
      // Refresh assignments
      fetchAssignments();
    } catch (err) {
      console.error('💥 [Assignment Dashboard] Error updating assignment status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update assignment status');
    } finally {
      setUpdatingStatus(null);
    }
  }, [fetchAssignments]);

  // Handle assignment delete
  const handleDelete = useCallback(async (assignment: ResourceAssignment) => {
    console.log('🗑️ [Assignment Dashboard] Attempting to delete assignment:', assignment.id);
    if (!confirm('Are you sure you want to delete this assignment?')) {
      console.log('🚫 [Assignment Dashboard] Delete cancelled by user');
      return;
    }

    try {
      const url = `/api/assignments/${assignment.id}`;
      console.log('🌐 [Assignment Dashboard] DELETE request to:', url);

      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include', // Include cookies for Clerk auth
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 [Assignment Dashboard] Delete response:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [Assignment Dashboard] Delete failed:', {
          status: response.status,
          errorData
        });
        throw new Error(errorData.error || 'Failed to delete assignment');
      }

      console.log('✅ [Assignment Dashboard] Assignment deleted successfully');
      // Refresh assignments
      fetchAssignments();
    } catch (err) {
      console.error('💥 [Assignment Dashboard] Error deleting assignment:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete assignment');
    }
  }, [fetchAssignments]);

  // Handle assignment form success
  const handleAssignmentSuccess = useCallback(() => {
    setCreateDialogOpen(false);
    setEditingAssignment(null);
    fetchAssignments();
  }, [fetchAssignments]);

  console.log('🎯 [Assignment Dashboard] About to render component...');
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with stats */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              <CardTitle className="text-lg">
                {view === "assigned" ? "My Assignments" : "Created by Me"}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchAssignments}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {canCreateAssignments && (
              <Button
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="min-h-[44px]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Assignment
              </Button>
            )}
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{stats.assigned}</div>
              <div className="text-xs text-blue-600">Assigned</div>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-orange-700">{stats.inProgress}</div>
              <div className="text-xs text-orange-600">In Progress</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-700">{stats.completed}</div>
              <div className="text-xs text-green-600">Completed</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-red-700">{stats.overdue}</div>
              <div className="text-xs text-red-600">Overdue</div>
            </div>
            {stats.created !== undefined && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-gray-700">{stats.created}</div>
                <div className="text-xs text-gray-600">Created</div>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Filters and view switcher */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* View switcher (for ADMIN/VOLUNTEER) */}
          {canSwitchViews && (
            <Tabs value={view} onValueChange={(value) => setView(value as "assigned" | "created")}>
              <TabsList>
                <TabsTrigger value="assigned">Assigned to Me</TabsTrigger>
                <TabsTrigger value="created">Created by Me</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assignments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ASSIGNED">Assigned</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Recently Created</SelectItem>
                <SelectItem value="dueDate">Due Date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>

            {filteredAssignments.length !== assignments.length && (
              <Badge variant="secondary" className="px-2 py-1 h-9 flex items-center">
                {filteredAssignments.length} of {assignments.length}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Assignments list */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedAssignments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <UserCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">No assignments found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchTerm || statusFilter !== "all" || priorityFilter !== "all"
                  ? "Try adjusting your search or filters."
                  : view === "assigned"
                  ? "You don't have any task assignments yet."
                  : "You haven't created any task assignments yet."
                }
              </p>
              {canCreateAssignments && (!searchTerm && statusFilter === "all" && priorityFilter === "all") && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Assignment
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          sortedAssignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              onEdit={setEditingAssignment}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              showResource={true}
              className={updatingStatus === assignment.id ? "opacity-50" : ""}
            />
          ))
        )}
      </div>

      {/* Create Assignment Dialog */}
      <AssignmentForm
        mode="create"
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleAssignmentSuccess}
      />

      {/* Edit Assignment Dialog */}
      {editingAssignment && (
        <AssignmentForm
          mode="edit"
          assignment={editingAssignment}
          open={!!editingAssignment}
          onOpenChange={(open) => !open && setEditingAssignment(null)}
          onSuccess={handleAssignmentSuccess}
        />
      )}
    </div>
  );
}