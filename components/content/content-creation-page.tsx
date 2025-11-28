'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, FileText, Star } from 'lucide-react';
import ContentForm, { ContentFormData } from './content-form';
import { ResourceType, UserRole, ResourceVisibility } from '@prisma/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Content Creation Page Component
 *
 * Dedicated page for creating new content (Notes or Resources):
 * - Professional inline form interface
 * - Role-based feature configuration
 * - Streamlined workflow with proper navigation
 * - Follows the professional UI design standards
 */

export interface ContentCreationPageProps {
  userRole: UserRole;
  userId: string;
  availableFamilies: Array<{ id: string; name: string }>;
  availableCategories: Array<{ id: string; name: string; color?: string }>;
  enableTypeSelection?: boolean;
  defaultResourceType?: ResourceType;
  showAdvancedFeatures?: boolean;
  canManageCuration?: boolean;
  backUrl: string;
}

const ContentCreationPage: React.FC<ContentCreationPageProps> = ({
  userRole,
  userId,
  availableFamilies,
  availableCategories,
  enableTypeSelection = true,
  defaultResourceType,
  showAdvancedFeatures = false,
  canManageCuration = false,
  backUrl
}) => {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Form state management (lifted from ContentForm)
  const initialFormData: ContentFormData = {
    title: '',
    description: '',
    body: '',
    resourceType: defaultResourceType || ResourceType.DOCUMENT,
    visibility: ResourceVisibility.PRIVATE,
    familyId: 'none',
    categoryId: 'none',
    tags: [],
    url: '',
    targetAudience: [],
    isPinned: false,
    allowComments: false,
    allowEditing: false,
    hasCuration: userRole !== 'ADMIN',
    hasRatings: true, // All resources can have ratings
    hasSharing: false,
    externalMeta: undefined,
    documentIds: []
  };

  const [formData, setFormData] = useState<ContentFormData>(initialFormData);
  const [uploadedAttachments, setUploadedAttachments] = useState<any[]>([]);

  // localStorage persistence for draft recovery
  const DRAFT_KEY = 'content-form-draft';

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft);
        // Only restore if there's meaningful content
        if (parsedDraft.title || parsedDraft.body || parsedDraft.description) {
          setFormData(parsedDraft);
          toast({
            title: 'Draft Restored',
            description: 'Your previous draft has been restored.',
          });
        }
      }
    } catch (error) {
      console.warn('Failed to restore draft from localStorage:', error);
      // Clear invalid data
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []); // Fixed: Only run on mount, not when toast function changes

  // Auto-save to localStorage when form data changes
  useEffect(() => {
    if (formData.title || formData.body || formData.description) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
      } catch (error) {
        console.warn('Failed to save draft to localStorage:', error);
      }
    }
  }, [formData]);

  // Clear draft after successful submission
  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      console.warn('Failed to clear draft from localStorage:', error);
    }
  };

  const handleFormSubmit = async (submittedFormData: ContentFormData) => {
    setIsLoading(true);

    try {
      console.log('📝 Starting content creation with data:', submittedFormData);

      const requestData = {
        // Basic fields
        title: submittedFormData.title,
        description: submittedFormData.description || submittedFormData.body, // Use description or fall back to body
        body: submittedFormData.body, // Include body field for API compatibility
        // Type field
        resourceType: submittedFormData.resourceType,
        visibility: submittedFormData.visibility || 'PRIVATE',

        // Organization fields - convert "none" values to null for ObjectId compatibility
        familyId: submittedFormData.familyId === 'none' ? null : submittedFormData.familyId,
        categoryId: submittedFormData.categoryId === 'none' ? null : submittedFormData.categoryId,
        tags: submittedFormData.tags || [],

        // Resource-specific fields
        url: submittedFormData.url,
        targetAudience: submittedFormData.targetAudience || [],

        // Feature flags
        isPinned: submittedFormData.isPinned || false,
        allowComments: submittedFormData.allowComments || false,
        allowEditing: submittedFormData.allowEditing || false,
        hasCuration: canManageCuration ? submittedFormData.hasCuration : true,
        hasRatings: submittedFormData.hasRatings || false,
        hasSharing: submittedFormData.hasSharing || false,

        // Additional fields
        externalMeta: submittedFormData.externalMeta,
        documentIds: submittedFormData.documentIds || []
      };

      console.log('📝 Sending request to /api/resources with data:', requestData);

      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        console.error('❌ Content creation failed:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });

        let errorMessage = 'Failed to create content';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          console.error('❌ Error details:', errorData);
        } catch (parseError) {
          // If response is not JSON, get text
          try {
            const errorText = await response.text();
            console.error('❌ Non-JSON error response:', errorText);
            errorMessage = `Server error (${response.status}): ${response.statusText}`;
          } catch (textError) {
            console.error('❌ Could not parse error response:', textError);
          }
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Clear draft after successful submission
      clearDraft();

      toast({
        title: 'Content Created',
        description: `Resource "${submittedFormData.title}" has been created successfully.`,
      });

      // Navigate back to content list
      router.push(backUrl);
    } catch (error) {
      console.error('Content creation error:', error);
      toast({
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred while creating the content.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Check if there's unsaved content
    const hasUnsavedChanges = formData.title || formData.body || formData.description;

    if (hasUnsavedChanges) {
      const confirmLeave = confirm(
        'You have unsaved changes. Are you sure you want to leave? Your progress will be saved as a draft.'
      );
      if (!confirmLeave) {
        return;
      }
    }

    router.push(backUrl);
  };

  const getPageTitle = () => {
    return 'Create New Content';
  };

  const getPageDescription = () => {
    return 'Create new content to organize and share information.';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="mt-1"
          disabled={isLoading}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">{getPageTitle()}</h1>
          </div>
          <p className="text-sm text-gray-600">
            {getPageDescription()}
          </p>
        </div>
      </div>

      {/* Content Creation Form */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">Content Details</CardTitle>
          </div>
        </CardHeader>

        <CardContent>
          <ContentForm
            mode="create"
            resourceType={defaultResourceType}
            enableTypeSelection={false}
            availableFamilies={availableFamilies}
            availableCategories={availableCategories}
            userRole={userRole}
            userId={userId}
            formData={formData}
            setFormData={setFormData}
            uploadedAttachments={uploadedAttachments}
            setUploadedAttachments={setUploadedAttachments}
            onSubmit={handleFormSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ContentCreationPage;