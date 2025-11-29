"use client";

import { useState, useEffect } from "react";
import { UserRole } from "@prisma/client";
import {
  BookOpen,
  ArrowLeft,
  Star,
  ExternalLink,
  Calendar,
  User,
  Tag,
  Edit,
  Trash2,
  Download,
  FileText,
  Video,
  Image as ImageIcon,
  Headphones,
  Link as LinkIcon,
  Wrench,
  Phone,
  Briefcase,
  AlertTriangle,
  ScrollText,
  Play,
  ChevronDown,
  ChevronRight,
  LayoutList,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { getResourceTypeIcon, isTemplate } from "@/lib/utils/resource-utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TemplateSchemaPreview } from "@/components/resources/template-schema-preview";
import { AssignTemplateModal } from "@/components/resources/assign-template-modal";

interface Resource {
  id: string;
  title: string;
  description: string;
  content: string;
  type: string;
  visibility: string;
  status: string;
  familyId?: string;
  family?: {
    id: string;
    name: string;
  };
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  };
  tags: string[];
  externalUrl?: string;
  attachments: string[];
  metadata: Record<string, any>;
  externalMeta?: any; // For template metadata
  isFeatured: boolean;
  isApproved: boolean;
  approvedAt?: string;
  rejectionReason?: string;
  isDeleted: boolean;
  averageRating: number;
  totalRatings: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  creator?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    role: string;
  };
  approvedBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  userRating?: number;
  documents: any[];
}

interface ResourceDetailPageProps {
  resourceId: string;
  userRole: UserRole;
  userId: string;
}



const getStatusColor = (status: string, isFeatured: boolean) => {
  if (isFeatured) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  switch (status) {
    case 'APPROVED':
      return "bg-green-100 text-green-800 border-green-200";
    case 'PENDING':
      return "bg-orange-100 text-orange-800 border-orange-200";
    case 'DRAFT':
      return "bg-gray-100 text-gray-800 border-gray-200";
    case 'REJECTED':
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

interface TemplateAssignment {
  id: string;
  status: 'pending' | 'started' | 'completed';
  startedAt?: string;
  completedAt?: string;
}

export function ResourceDetailPage({ resourceId, userRole, userId }: ResourceDetailPageProps) {
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [startWorkingLoading, setStartWorkingLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true); // Expanded by default
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignment, setAssignment] = useState<TemplateAssignment | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const fetchResource = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/resources/${resourceId}?includeRatings=true&includeDocuments=true&trackView=true`, {
          credentials: 'include'
        });
        if (!response.ok) {
          if (response.status === 404) {
            setError("Resource not found");
          } else if (response.status === 403) {
            setError("Access denied");
          } else {
            setError("Failed to load resource");
          }
          return;
        }

        const data = await response.json();
        setResource(data.data);
      } catch (error) {
        console.error("Error fetching resource:", error);
        setError("Failed to load resource");
      } finally {
        setLoading(false);
      }
    };

    fetchResource();
  }, [resourceId]);

  // Fetch assignment status for members viewing templates
  useEffect(() => {
    const fetchAssignment = async () => {
      if (!resource || userRole !== UserRole.MEMBER) return;

      // Only check assignment for system templates
      const isSystemTemplate = resource.externalMeta?.systemGenerated;
      if (!isSystemTemplate) return;

      try {
        setAssignmentLoading(true);
        const response = await fetch(`/api/resources/${resourceId}/start-template`, {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.hasAssignment && data.assignment) {
            setAssignment(data.assignment);
          }
        }
      } catch (error) {
        console.error("Error fetching assignment status:", error);
      } finally {
        setAssignmentLoading(false);
      }
    };

    fetchAssignment();
  }, [resource, resourceId, userRole]);


  const handleDelete = async () => {
    if (!resource) return;

    try {
      setDeleteLoading(true);
      const response = await fetch(`/api/resources/${resourceId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete resource');
      }

      router.push(`/${userRole.toLowerCase()}/resources`);
    } catch (error) {
      console.error('Error deleting resource:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStartWorking = async () => {
    if (!resource) return;

    try {
      setStartWorkingLoading(true);
      const response = await fetch(`/api/resources/${resourceId}/start-template`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start template workflow');
      }

      const data = await response.json();
      console.log('Template workflow started:', data);

      // Navigate to the form completion page
      router.push(`/${userRole.toLowerCase()}/resources/${resourceId}/complete`);
    } catch (error) {
      console.error('Error starting template workflow:', error);
      alert(error instanceof Error ? error.message : 'Failed to start template workflow');
    } finally {
      setStartWorkingLoading(false);
    }
  };

  // Handle viewing/editing completed form
  const handleViewForm = () => {
    router.push(`/${userRole.toLowerCase()}/resources/${resourceId}/complete`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-6 bg-muted rounded w-48 animate-pulse" />
        </div>
        <Card className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded" />
              <div className="h-3 bg-muted rounded w-5/6" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href={`/${userRole.toLowerCase()}/resources`}>
            <Button variant="default" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Resources
            </Button>
          </Link>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error || "Resource not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isTemplateResource = isTemplate(resource);
  const isSystemTemplate = isTemplateResource && resource.externalMeta?.systemGenerated;
  const TypeIcon = getResourceTypeIcon(resource.type, isTemplateResource);
  const statusColor = getStatusColor(resource.status, resource.isFeatured);
  const canEdit = !isSystemTemplate && (userRole === UserRole.ADMIN || (resource.creator?.id === userId));
  const canDelete = !isSystemTemplate && (userRole === UserRole.ADMIN || (resource.creator?.id === userId));
  const canAssign = isSystemTemplate && (userRole === UserRole.ADMIN || userRole === UserRole.VOLUNTEER);
  const hasSidebarContent = !!resource.family;

  return (
    <div className="space-y-4">
      {/* Header - Action buttons (only shown when there are actions) */}
      {(canEdit || canDelete || canAssign || (isSystemTemplate && userRole === UserRole.MEMBER)) && (
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
          {isSystemTemplate && userRole === UserRole.MEMBER && (
            assignmentLoading ? (
              <Button disabled size="sm" className="min-h-[44px]">
                <span className="animate-pulse">Loading...</span>
              </Button>
            ) : assignment ? (
              // User has an assignment - show appropriate button based on status
              assignment.status === 'completed' ? (
                <Button
                  onClick={handleViewForm}
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View My Response
                </Button>
              ) : (
                <Button
                  onClick={handleStartWorking}
                  disabled={startWorkingLoading}
                  variant="default"
                  size="sm"
                  className="min-h-[44px]"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {startWorkingLoading ? "Starting..." : assignment.status === 'started' ? "Continue Form" : "Start Working"}
                </Button>
              )
            ) : (
              // No assignment - show message
              <Badge variant="secondary" className="min-h-[44px] flex items-center px-4">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Not assigned to you
              </Badge>
            )
          )}
          {canAssign && (
            <Button
              onClick={() => setShowAssignModal(true)}
              variant="default"
              size="sm"
              className="min-h-[44px]"
            >
              <Send className="h-4 w-4 mr-2" />
              Assign
            </Button>
          )}
          {canEdit && (
            <Link href={`/${userRole.toLowerCase()}/resources/${resourceId}/edit`}>
              <Button variant="outline" size="sm" className="min-h-[44px]">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="min-h-[44px] text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Resource</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{resource.title}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="bg-destructive text-destructive-foreground"
                  >
                    {deleteLoading ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`grid gap-4 ${hasSidebarContent ? 'lg:grid-cols-3' : 'max-w-4xl mx-auto'}`}>
        <div className={`${hasSidebarContent ? 'lg:col-span-2' : ''} space-y-4`}>
          {/* Back to Resources - centered */}
          <div className="flex justify-center">
            <Link href={`/${userRole.toLowerCase()}/resources`}>
              <Button variant="default" size="sm" className="min-h-[44px]">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Resources
              </Button>
            </Link>
          </div>

          {/* Resource Info */}
          <Card className="p-4">
            <CardHeader className="space-y-3">
              <div className="flex items-start gap-3">
                <TypeIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-semibold break-words">{resource.title}</h1>
                  {resource.description && (
                    <p className="text-muted-foreground mt-1">{resource.description}</p>
                  )}
                </div>
              </div>

              {/* Status and Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {isTemplateResource && (
                  <Badge className="bg-[hsl(var(--ppcc-purple)/0.1)] text-[hsl(var(--ppcc-purple))] border-[hsl(var(--ppcc-purple)/0.3)]">
                    <ScrollText className="h-3 w-3 mr-1" />
                    Advance Directive Template
                  </Badge>
                )}
                {resource.isFeatured && (
                  <Badge className={statusColor}>
                    <Star className="h-3 w-3 mr-1" />
                    Featured
                  </Badge>
                )}
                {!resource.isFeatured && resource.status !== 'APPROVED' && (
                  <Badge variant="secondary" className={statusColor}>
                    {resource.status}
                  </Badge>
                )}
                {resource.category && (
                  <Badge variant="outline">
                    {resource.category.name}
                  </Badge>
                )}
                <Badge variant="outline">
                  {resource.type}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* External Link */}
              {resource.externalUrl && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <ExternalLink className="h-4 w-4" />
                  <a
                    href={resource.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    {resource.externalUrl}
                  </a>
                </div>
              )}

              {/* Content */}
              {resource.content && (
                <div className="prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: resource.content.replace(/\n/g, '<br>') }} />
                </div>
              )}

              {/* Tags */}
              {resource.tags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-4 w-4" />
                    <span className="font-medium text-sm">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {resource.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Template Form Preview */}
              {isTemplateResource && resource.externalMeta?.formSchema && (
                <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-[hsl(var(--ppcc-purple)/0.05)] hover:bg-[hsl(var(--ppcc-purple)/0.1)] transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        {previewOpen ? (
                          <ChevronDown className="h-4 w-4 text-[hsl(var(--ppcc-purple))]" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-[hsl(var(--ppcc-purple))]" />
                        )}
                        <LayoutList className="h-4 w-4 text-[hsl(var(--ppcc-purple))]" />
                        <span className="font-medium text-sm text-[hsl(var(--ppcc-purple))]">Form Structure Preview</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-[hsl(var(--ppcc-purple)/0.3)] text-[hsl(var(--ppcc-purple))] bg-[hsl(var(--ppcc-purple)/0.1)]">
                        {Object.keys(resource.externalMeta.formSchema.sections || {}).length} sections
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 p-4 rounded-lg border bg-card">
                      <TemplateSchemaPreview formSchema={resource.externalMeta.formSchema} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Documents/Attachments */}
              {resource.documents && resource.documents.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium text-sm">Attachments</span>
                  </div>
                  <div className="space-y-2">
                    {resource.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 border rounded-lg">
                        <FileText className="h-4 w-4" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.title || doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.fileSize && `${(doc.fileSize / 1024 / 1024).toFixed(1)} MB`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Download ${doc.title || doc.fileName}`}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        {hasSidebarContent && (
          <div className="space-y-4">
            {/* Family Context */}
            {resource.family && (
              <Card className="p-3">
                <CardHeader>
                  <h3 className="font-medium text-sm">Family Context</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{resource.family.name}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Assign Template Modal */}
      {canAssign && (
        <AssignTemplateModal
          open={showAssignModal}
          onOpenChange={setShowAssignModal}
          resourceId={resourceId}
          resourceTitle={resource.title}
          resourceDescription={resource.description}
        />
      )}
    </div>
  );
}