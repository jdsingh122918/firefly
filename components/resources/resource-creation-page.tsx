"use client";

import { useState, useEffect } from "react";
import { UserRole } from "@prisma/client";
import { useRouter } from "next/navigation";
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
import { DocumentAttachmentManager } from "@/components/notes/document-attachment-manager";

interface ResourceCreationPageProps {
  userRole: UserRole;
  userId: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
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
    categoryId: "none",
    tags: [] as string[],
    externalUrl: "",
    attachments: [] as string[],
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Document[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesResponse, familiesResponse] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/families'),
        ]);

        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          setCategories(categoriesData.categories || []);
        }

        if (familiesResponse.ok) {
          const familiesData = await familiesResponse.json();
          setFamilies(familiesData.families || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!formData.tags.includes(newTag)) {
        handleInputChange('tags', [...formData.tags, newTag]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (isDraft = false) => {
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

      const payload = {
        ...formData,
        categoryId: formData.categoryId === "none" ? "" : formData.categoryId,
        attachments: selectedDocuments.map(doc => doc.id),
        // Set visibility based on draft status
        visibility: isDraft ? "PRIVATE" : formData.visibility,
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
            onClick={() => handleSubmit(true)}
            disabled={loading}
            variant="outline"
            className="min-h-[44px]"
          >
            Save Draft
          </Button>
          <Button
            onClick={() => handleSubmit(false)}
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

                {/* Tags */}
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="space-y-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder="Type a tag and press Enter"
                      className="min-h-[44px]"
                    />
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {formData.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="cursor-pointer">
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-1 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Document Attachments */}
                <div className="space-y-2">
                  <Label>Attachments</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground">Document attachments will be available in the next update</p>
                    <p className="text-xs text-muted-foreground mt-1">For now, you can include links in the content or external URL field</p>
                  </div>
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
              {selectedVisibility && (
                <p className="text-xs text-muted-foreground">{selectedVisibility.description}</p>
              )}
            </CardContent>
          </Card>

          {/* Category */}
          <Card className="p-3">
            <CardHeader>
              <h3 className="font-medium text-sm">Category</h3>
            </CardHeader>
            <CardContent>
              <Select value={formData.categoryId} onValueChange={(value) => handleInputChange('categoryId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Category</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
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