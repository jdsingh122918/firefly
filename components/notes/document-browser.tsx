"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Search,
  FileIcon,
  FileText,
  Image,
  Video,
  FileAudio,
  Download,
  Plus,
  Check,
  Loader2,
  AlertCircle,
  FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatFileSize, formatTimeAgo } from "@/components/shared/format-utils";
import { cn } from "@/lib/utils";

interface Document {
  id: string;
  title: string;
  filename?: string;
  description?: string;
  contentType?: string;
  size?: number;
  url?: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    imageUrl?: string;
  };
  tags?: string[];
  category?: string;
  isPublic: boolean;
}

interface DocumentBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (documents: Document[]) => void;
  selectedDocuments?: string[]; // IDs of already selected documents
  multiSelect?: boolean;
  title?: string;
  className?: string;
}

// Get appropriate icon for file type
function getFileIcon(contentType?: string) {
  if (!contentType) return FileIcon;

  if (contentType.startsWith('image/')) return Image;
  if (contentType.startsWith('video/')) return Video;
  if (contentType.startsWith('audio/')) return FileAudio;
  if (contentType.includes('pdf') || contentType.includes('document')) return FileText;

  return FileIcon;
}

interface DocumentsResponse {
  documents: Document[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function DocumentBrowser({
  open,
  onOpenChange,
  onSelect,
  selectedDocuments = [],
  multiSelect = false,
  title = "Select Documents",
  className = ""
}: DocumentBrowserProps) {
  const { getToken } = useAuth();

  // Data state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("updatedAt");

  // Selection state
  const [localSelection, setLocalSelection] = useState<string[]>(selectedDocuments);

  // Filter documents client-side for quick filtering
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = searchTerm === "" ||
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Sort filtered documents
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    switch (sortBy) {
      case "title":
        return a.title.localeCompare(b.title);
      case "createdAt":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "size":
        return (b.size || 0) - (a.size || 0);
      case "updatedAt":
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const params = new URLSearchParams({
        page: "1",
        limit: "50",
        sortBy,
        sortOrder: "desc",
        includePublic: "true" // Include public documents for selection
      });

      const response = await fetch(`/api/documents?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch documents: ${response.status} ${errorText}`);
      }

      const data: DocumentsResponse = await response.json();
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load documents';
      setError(errorMessage);
      console.error('Failed to fetch documents:', err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, sortBy]);

  // Load documents when dialog opens
  useEffect(() => {
    if (open) {
      fetchDocuments();
      setLocalSelection(selectedDocuments);
    }
  }, [open, fetchDocuments, selectedDocuments]);

  // Handle document selection
  const handleDocumentSelect = (documentId: string) => {
    if (multiSelect) {
      setLocalSelection(prev => {
        if (prev.includes(documentId)) {
          return prev.filter(id => id !== documentId);
        } else {
          return [...prev, documentId];
        }
      });
    } else {
      setLocalSelection([documentId]);
    }
  };

  // Handle selection confirmation
  const handleConfirm = () => {
    const selectedDocs = documents.filter(doc => localSelection.includes(doc.id));
    onSelect(selectedDocs);
    onOpenChange(false);
  };

  // Handle cancel
  const handleCancel = () => {
    setLocalSelection(selectedDocuments);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-4xl max-h-[90vh] overflow-hidden ${className}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Search and filters */}
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          {/* Filters row */}
          <div className="flex gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="medical">Medical</SelectItem>
                <SelectItem value="legal">Legal</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updatedAt">Recently Updated</SelectItem>
                <SelectItem value="createdAt">Recently Added</SelectItem>
                <SelectItem value="title">Name (A-Z)</SelectItem>
                <SelectItem value="size">File Size</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />

            {/* Selection info */}
            {localSelection.length > 0 && (
              <Badge variant="secondary" className="px-2 py-1">
                {localSelection.length} selected
              </Badge>
            )}
          </div>
        </div>

        {/* Documents grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sortedDocuments.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">No documents found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchTerm || categoryFilter !== "all"
                  ? "Try adjusting your search or filters."
                  : "No documents are available for selection."
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedDocuments.map((document) => {
                const FileIcon = getFileIcon(document.contentType);
                const isSelected = localSelection.includes(document.id);
                const isAlreadyAttached = selectedDocuments.includes(document.id);

                return (
                  <Card
                    key={document.id}
                    className={cn(
                      "cursor-pointer transition-all duration-200 hover:shadow-md",
                      isSelected && "ring-2 ring-primary bg-primary/5",
                      isAlreadyAttached && !isSelected && "opacity-50"
                    )}
                    onClick={() => !isAlreadyAttached && handleDocumentSelect(document.id)}
                  >
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        {/* Header with icon and selection */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium text-sm line-clamp-1">
                                {document.title}
                              </h4>
                              {document.filename && document.filename !== document.title && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {document.filename}
                                </p>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="rounded-full bg-primary text-primary-foreground p-1">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                          {isAlreadyAttached && (
                            <Badge variant="secondary" className="text-xs">
                              Attached
                            </Badge>
                          )}
                        </div>

                        {/* Description */}
                        {document.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {document.description}
                          </p>
                        )}

                        {/* Metadata */}
                        <div className="space-y-1">
                          {/* File info */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {document.size && (
                              <span>{formatFileSize(document.size)}</span>
                            )}
                            {document.category && (
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                {document.category}
                              </Badge>
                            )}
                          </div>

                          {/* Date and creator */}
                          <div className="text-xs text-muted-foreground">
                            {formatTimeAgo(document.updatedAt)} • {document.creator.firstName || document.creator.email}
                          </div>
                        </div>

                        {/* Tags */}
                        {document.tags && document.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {document.tags.slice(0, 2).map((tag, index) => (
                              <Badge key={index} variant="secondary" className="text-xs px-1 py-0">
                                {tag}
                              </Badge>
                            ))}
                            {document.tags.length > 2 && (
                              <Badge variant="secondary" className="text-xs px-1 py-0">
                                +{document.tags.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col md:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="min-h-[44px] order-2 md:order-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={localSelection.length === 0}
            className="min-h-[44px] order-1 md:order-2"
          >
            {multiSelect ? `Select ${localSelection.length} Documents` : "Select Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}