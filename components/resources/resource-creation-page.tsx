"use client";

import { useState, useEffect } from "react";
import { UserRole } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  ArrowLeft,
  Save,
  Eye,
  FileText,
  Video,
  Image as ImageIcon,
  Headphones,
  Link as LinkIcon,
  Wrench,
  Phone,
  Briefcase,
  Upload,
  Tag,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileUploadPreview } from "@/components/shared/file-upload-preview";
import { useFileUpload, UploadedFile } from "@/hooks/use-file-upload";
import { ALL_HEALTHCARE_TAGS } from "@/lib/data/healthcare-tags";
import PopularTagsQuickSelect from "@/components/content/popular-tags-quick-select";

interface ResourceCreationPageProps {
  userRole: UserRole;
  userId: string;
}

interface Family {
  id: string;
  name: string;
}

interface Document {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  type: string;
}

const RESOURCE_TYPES = [
  { value: "DOCUMENT", label: "Document", icon: FileText },
  { value: "LINK", label: "Link/Website", icon: LinkIcon },
  { value: "VIDEO", label: "Video", icon: Video },
  { value: "AUDIO", label: "Audio/Podcast", icon: Headphones },
  { value: "IMAGE", label: "Image/Photo", icon: ImageIcon },
  { value: "TOOL", label: "Tool/App", icon: Wrench },
  { value: "CONTACT", label: "Contact Info", icon: Phone },
  { value: "SERVICE", label: "Service", icon: Briefcase },
];

const VISIBILITY_OPTIONS = [
  { value: "PRIVATE", label: "Private", description: "Only visible to you" },
  { value: "FAMILY", label: "Family", description: "Visible to family members" },
  { value: "SHARED", label: "Shared", description: "Visible to your organization" },
  { value: "PUBLIC", label: "Public", description: "Visible to everyone" },
];

export function ResourceCreationPage({ userRole, userId }: ResourceCreationPageProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    type: "DOCUMENT",
    visibility: "PRIVATE",
    familyId: "",
    tags: [] as string[],
    externalUrl: "",
    attachments: [] as string[],
  });

  const [families, setFamilies] = useState<Family[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Document[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<UploadedFile[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  // File upload functionality
  const {
    uploadFiles,
    clearUploads,
    uploads,
    isLoading: isUploading,
    error: uploadError,
  } = useFileUpload();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const familiesResponse = await fetch('/api/families');

        if (familiesResponse.ok) {
          const familiesData = await familiesResponse.json();
          setFamilies(familiesData.families || []);
        }
      } catch (error) {
        console.error('Error fetching families:', error);
      }
    };

    fetchData();
  }, []);

  // Listen for tags from URL parameters (when returning from tag selection page)
  useEffect(() => {
    const selectedTagsParam = searchParams.get('selectedTags');
    if (selectedTagsParam) {
      const tagsFromUrl = decodeURIComponent(selectedTagsParam).split(',').filter(Boolean);
      if (tagsFromUrl.length > 0) {
        setFormData(prev => ({
          ...prev,
          tags: tagsFromUrl
        }));
        // Clean up URL parameter
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('selectedTags');
        router.replace(newUrl.pathname + newUrl.search);
      }
    }
  }, [searchParams, router]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddTag = (tagValue: string) => {
    const newTag = tagValue.trim();
    if (newTag && !formData.tags.includes(newTag)) {
      handleInputChange('tags', [...formData.tags, newTag]);
      setTagInput("");
    }
  };

  const handleTagRemove = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagToggle = (tagName: string) => {
    if (formData.tags.includes(tagName)) {
      handleTagRemove(tagName);
    } else {
      handleAddTag(tagName);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    try {
      const { successful, failed } = await uploadFiles(Array.from(files));

      // Add successful uploads to attachments
      if (successful.length > 0) {
        setUploadedAttachments(prev => [...prev, ...successful]);
      }

      // Show error for failed uploads
      if (failed.length > 0) {
        const failedFileNames = failed.map(f => f.file.name).join(', ');
        setError(`Failed to upload: ${failedFileNames}`);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      setError('Failed to upload files');
    }
  };

  const handleRemoveAttachment = (id: string | File) => {
    const fileId = typeof id === 'string' ? id : (id as any).fileId || id.name;
    setUploadedAttachments(prev => prev.filter(file => file.fileId !== fileId));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate required fields
      if (!formData.title.trim()) {
        setError("Title is required");
        return;
      }

      if (!formData.description.trim()) {
        setError("Description is required");
        return;
      }

      if (!formData.content.trim()) {
        setError("Content is required");
        return;
      }

      if (formData.type === "LINK" && !formData.externalUrl) {
        setError("External URL is required for link resources");
        return;
      }

      const { type, ...formDataWithoutType } = formData;
      const payload = {
        ...formDataWithoutType,
        resourceType: type, // Map 'type' to 'resourceType' for API
        documentIds: uploadedAttachments.map(file => file.fileId),
        visibility: formData.visibility,
      };

      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create resource');
      }

      const data = await response.json();
      router.push(`/${userRole.toLowerCase()}/resources/${data.resource.id}`);
    } catch (error) {
      console.error('Error creating resource:', error);
      setError(error instanceof Error ? error.message : 'Failed to create resource');
    } finally {
      setLoading(false);
    }
  };

  const selectedType = RESOURCE_TYPES.find(type => type.value === formData.type);
  const selectedVisibility = VISIBILITY_OPTIONS.find(vis => vis.value === formData.visibility);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/${userRole.toLowerCase()}/resources`}>
            <Button variant="ghost" size="sm" className="min-h-[44px]">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Resources
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Create Resource</h1>
            <p className="text-sm text-muted-foreground">
              Share valuable resources with the community
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPreview(!preview)}
            className="min-h-[44px]"
          >
            <Eye className="h-4 w-4 mr-2" />
            {preview ? "Edit" : "Preview"}
          </Button>
          <Button
            onClick={() => handleSubmit()}
            disabled={loading}
            className="min-h-[44px]"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Creating..." : "Create Resource"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!preview ? (
            <Card className="p-4">
              <CardContent className="space-y-4">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter resource title"
                    className="min-h-[44px]"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Brief description of the resource"
                    rows={3}
                    className="min-h-[88px]"
                  />
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <Label htmlFor="content">Content *</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => handleInputChange('content', e.target.value)}
                    placeholder="Detailed content of the resource"
                    rows={8}
                    className="min-h-[200px]"
                  />
                </div>

                {/* External URL (for links) */}
                {formData.type === "LINK" && (
                  <div className="space-y-2">
                    <Label htmlFor="externalUrl">External URL *</Label>
                    <Input
                      id="externalUrl"
                      type="url"
                      value={formData.externalUrl}
                      onChange={(e) => handleInputChange('externalUrl', e.target.value)}
                      placeholder="https://example.com"
                      className="min-h-[44px]"
                    />
                  </div>
                )}

                {/* Unified Tags and Categories Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Tags & Categories</Label>
                    <span className="text-xs text-gray-500">Organize your resource for easy discovery</span>
                  </div>

                  {/* Healthcare Tags - Navigate to Selection Page */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-700">Healthcare Tags:</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => {
                          const currentPath = window.location.pathname;
                          const currentUrl = encodeURIComponent(currentPath);
                          const currentTags = encodeURIComponent(formData.tags.join(','));

                          // For now, use a unified tag selection approach
                          // TODO: Create dedicated resource tag pages if needed
                          let tagsPagePath = `/${userRole.toLowerCase()}/resources/tags`;

                          // Fallback: if dedicated resource tag pages don't exist,
                          // we could redirect to a tag selection modal or component

                          const url = `${tagsPagePath}?returnUrl=${currentUrl}&selectedTags=${currentTags}`;
                          router.push(url);
                        }}
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        Browse Tags
                      </Button>
                    </div>
                  </div>

                  {/* Popular Tags Quick Select */}
                  <PopularTagsQuickSelect
                    selectedTags={formData.tags}
                    onTagToggle={handleTagToggle}
                    className="mb-4"
                  />

                  {/* Selected Tags */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">Selected Tags:</p>
                    <div className="flex flex-wrap gap-2 min-h-[2rem] p-2 border rounded-lg bg-gray-50">
                      {formData.tags.length > 0 ? (
                        formData.tags.map((tag) => {
                          const healthcareTag = ALL_HEALTHCARE_TAGS.find(ht => ht.name === tag);
                          return (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="flex items-center gap-1 pr-1"
                              style={healthcareTag ? { backgroundColor: `${healthcareTag.color}20`, color: healthcareTag.color, borderColor: healthcareTag.color } : {}}
                            >
                              {tag}
                              <button
                                type="button"
                                className="ml-1 p-1 rounded hover:bg-red-100 hover:text-red-600 transition-colors"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleTagRemove(tag);
                                }}
                                aria-label={`Remove ${tag} tag`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })
                      ) : (
                        <span className="text-sm text-gray-500">No tags selected</span>
                      )}
                    </div>
                  </div>

                  {/* Custom Tag Input */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">Add Custom Tags:</p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter custom tag..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag(tagInput);
                          }
                        }}
                        className="flex-1 min-h-[44px]"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddTag(tagInput)}
                        disabled={!tagInput.trim()}
                        className="min-h-[44px]"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Document Attachments */}
                <div className="space-y-2">
                  <Label>Attachments</Label>
                  <FileUploadPreview
                    attachments={uploadedAttachments}
                    uploads={uploads}
                    onRemoveAttachment={handleRemoveAttachment}
                    showUploadButton={true}
                    onUploadClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.accept = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.zip';
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        handleFileUpload(files);
                      };
                      input.click();
                    }}
                    uploadButtonText="Add Files"
                    uploadButtonIcon={<Upload className="h-4 w-4" />}
                    disabled={isUploading}
                    layout="list"
                    showFileTypes={true}
                    showSizes={true}
                    emptyStateText="No files attached. Click 'Add Files' to upload documents, images, or other files."
                    className="min-h-[100px]"
                  />
                  {uploadError && (
                    <p className="text-sm text-destructive">{uploadError}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-4">
              <CardHeader className="space-y-3">
                <div className="flex items-start gap-3">
                  {selectedType && <selectedType.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-semibold">{formData.title || "Untitled Resource"}</h1>
                    {formData.description && (
                      <p className="text-muted-foreground mt-1">{formData.description}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.content && (
                  <div className="prose prose-sm max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: formData.content.replace(/\n/g, '<br>') }} />
                  </div>
                )}
                {formData.externalUrl && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <LinkIcon className="h-4 w-4" />
                    <a href={formData.externalUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                      {formData.externalUrl}
                    </a>
                  </div>
                )}
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Settings Sidebar */}
        <div className="space-y-4">
          {/* Resource Type */}
          <Card className="p-3">
            <CardHeader>
              <h3 className="font-medium text-sm">Resource Type</h3>
            </CardHeader>
            <CardContent>
              <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Visibility */}
          <Card className="p-3">
            <CardHeader>
              <h3 className="font-medium text-sm">Visibility</h3>
            </CardHeader>
            <CardContent className="space-y-2">
              <Select value={formData.visibility} onValueChange={(value) => handleInputChange('visibility', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>


          {/* Family Context */}
          {formData.visibility === "FAMILY" && families.length > 0 && (
            <Card className="p-3">
              <CardHeader>
                <h3 className="font-medium text-sm">Family</h3>
              </CardHeader>
              <CardContent>
                <Select value={formData.familyId} onValueChange={(value) => handleInputChange('familyId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select family" />
                  </SelectTrigger>
                  <SelectContent>
                    {families.map((family) => (
                      <SelectItem key={family.id} value={family.id}>
                        {family.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}