'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, FileText, Star } from 'lucide-react';
import ContentForm, { ContentFormData } from './content-form';
import { ContentType, UserRole } from '@prisma/client';
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
  defaultContentType?: ContentType;
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
  defaultContentType,
  showAdvancedFeatures = false,
  canManageCuration = false,
  backUrl
}) => {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleFormSubmit = async (formData: ContentFormData) => {
    setIsLoading(true);

    try {
      console.log('📝 Starting content creation with data:', formData);

      const requestData = {
        // Basic fields
        title: formData.title,
        description: formData.description || formData.body, // Use description or fall back to body
        body: formData.body, // Include body field for API compatibility
        contentType: formData.contentType,

        // Type-specific fields
        noteType: formData.noteType,
        resourceType: formData.resourceType,
        visibility: formData.visibility || 'PRIVATE',

        // Organization fields - convert "none" values to null for ObjectId compatibility
        familyId: formData.familyId === 'none' ? null : formData.familyId,
        categoryId: formData.categoryId === 'none' ? null : formData.categoryId,
        tags: formData.tags || [],

        // Resource-specific fields
        url: formData.url,
        targetAudience: formData.targetAudience || [],

        // Feature flags
        isPinned: formData.isPinned || false,
        allowComments: formData.allowComments || false,
        allowEditing: formData.allowEditing || false,
        hasAssignments: formData.contentType === ContentType.NOTE ? (formData.hasAssignments || false) : false,
        hasCuration: formData.contentType === ContentType.RESOURCE ? (canManageCuration ? formData.hasCuration : true) : false,
        hasRatings: formData.contentType === ContentType.RESOURCE ? (formData.hasRatings || false) : false,
        hasSharing: formData.hasSharing || false,

        // Additional fields
        externalMeta: formData.externalMeta,
        documentIds: formData.documentIds || []
      };

      console.log('📝 Sending request to /api/content with data:', requestData);

      const response = await fetch('/api/content', {
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

      toast({
        title: 'Content Created',
        description: `${formData.contentType === ContentType.NOTE ? 'Note' : 'Resource'} "${formData.title}" has been created successfully.`,
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
            contentType={defaultContentType}
            enableTypeSelection={false}
            availableFamilies={availableFamilies}
            availableCategories={availableCategories}
            userRole={userRole}
            userId={userId}
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