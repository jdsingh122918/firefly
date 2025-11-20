'use client';

/**
 * Assignment Completion Client Component
 *
 * Handles the interactive form completion for advance directive templates
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  CheckCircle,
  Save,
  AlertTriangle,
  Play,
  Eye,
  Clock
} from 'lucide-react';
import { UserRole } from '@prisma/client';
import { AdvanceDirectiveForm, FormResponseData, FormSectionData } from '@/components/forms/advance-directive-forms';
import { useRouter } from 'next/navigation';
import { HealthcarePrivacyHeader } from '@/components/shared/privacy-security';

interface AssignmentData {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  createdAt: string;
  dueAt?: string;
  tags: string[];
  assignedBy?: {
    firstName: string;
    lastName: string;
  };
  notes?: string;
  existingResponse?: {
    id: string;
    responseData: any;
    completedAt?: string;
    lastSaved?: string;
  };
}

interface TemplateData {
  id: string;
  title: string;
  description?: string;
  body?: string;
  tags: string[];
  formSchema?: any;
  viewCount: number;
  createdBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface AssignmentCompletionClientProps {
  assignment: AssignmentData | null;
  template: TemplateData;
  userId: string;
  userRole: UserRole;
  isPreviewMode: boolean;
}

export function AssignmentCompletionClient({
  assignment,
  template,
  userId,
  userRole,
  isPreviewMode
}: AssignmentCompletionClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Initialize form data from existing response or empty
  const [formData, setFormData] = useState<FormResponseData>(() => {
    if (assignment?.existingResponse?.responseData) {
      return assignment.existingResponse.responseData;
    }

    // Create default form structure based on template schema
    const sections: Record<string, FormSectionData> = {};

    if (template.formSchema?.sections && Array.isArray(template.formSchema.sections)) {
      template.formSchema.sections.forEach((section: any) => {
        sections[section.id] = {
          id: section.id,
          title: section.title,
          description: section.description,
          fields: section.fields.map((field: any) => ({
            ...field,
            value: field.type === 'checkbox' ? (field.options ? [] : false) : ''
          })),
          completed: false
        };
      });
    }

    return {
      contentId: template.id,
      userId: userId,
      sections
    };
  });

  // Handle form data changes
  const handleFormChange = useCallback((newData: FormResponseData) => {
    setFormData(newData);
  }, []);

  // Save form data to API
  const handleSave = useCallback(async (data: FormResponseData, isCompleted: boolean = false) => {
    if (isPreviewMode) return; // Don't save in preview mode

    try {
      setSaveStatus('saving');

      const response = await fetch(`/api/resources/${template.id}/form-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          responseData: data,
          isCompleted,
          assignmentId: assignment?.id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save form response');
      }

      setSaveStatus('saved');

      if (isCompleted) {
        // Show success message and redirect
        setTimeout(() => {
          router.push(`/${userRole.toLowerCase()}/assignments?message=assignment-completed`);
        }, 1500);
      } else {
        // Auto-hide save status after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
      }

    } catch (error) {
      console.error('Error saving form:', error);
      setSaveStatus('error');
      setError('Failed to save form. Please try again.');

      // Auto-hide error after 5 seconds
      setTimeout(() => {
        setSaveStatus('idle');
        setError(null);
      }, 5000);
    }
  }, [template.id, assignment?.id, isPreviewMode, userRole, router]);

  // Handle starting work from preview mode
  const handleStartWorking = useCallback(async () => {
    if (!isPreviewMode) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/resources/${template.id}/start-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to start template workflow');
      }

      const result = await response.json();

      if (result.success && result.data.assignment) {
        // Navigate to the actual assignment completion page
        router.push(`/${userRole.toLowerCase()}/assignments/${result.data.assignment.id}/complete`);
      } else {
        throw new Error('Invalid response from server');
      }

    } catch (error) {
      console.error('Error starting template:', error);
      setError('Failed to start template. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isPreviewMode, template.id, userRole, router]);

  // Check if form is completed
  const isFormCompleted = Object.values(formData.sections).every(section => section.completed);
  const hasFormData = Object.values(formData.sections).some(section =>
    section.fields.some(field =>
      field.type === 'checkbox'
        ? (Array.isArray(field.value) ? field.value.length > 0 : field.value)
        : field.value && field.value.toString().trim() !== ''
    )
  );

  return (
    <div className="space-y-6">
      {/* Privacy Header */}
      <HealthcarePrivacyHeader
        formType="advance directive"
        accessLevel={isPreviewMode ? "providers" : "private"}
      />

      {/* Preview Mode Banner */}
      {isPreviewMode && (
        <Alert className="bg-blue-50 border-blue-200">
          <Eye className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong>Preview Mode:</strong> You're viewing the template structure.
                No data will be saved in this mode.
              </div>
              <Button
                onClick={handleStartWorking}
                disabled={isLoading}
                className="ml-4"
              >
                {isLoading ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Working
                  </>
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Assignment Status (only in non-preview mode) */}
      {!isPreviewMode && assignment && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {assignment.status === 'COMPLETED' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-500" />
                  )}
                  <span className="font-medium">
                    Assignment Status: {assignment.status.replace('_', ' ')}
                  </span>
                </div>

                {assignment.existingResponse && (
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    Previously Saved
                  </Badge>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {/* Save Status Indicator */}
                {saveStatus === 'saving' && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </div>
                )}
                {saveStatus === 'saved' && (
                  <div className="flex items-center text-sm text-green-600">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Saved
                  </div>
                )}
                {saveStatus === 'error' && (
                  <div className="flex items-center text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Error saving
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            {template.title}
            {isPreviewMode && (
              <Badge variant="outline" className="ml-2">
                Preview
              </Badge>
            )}
          </CardTitle>
          {template.description && (
            <p className="text-sm text-gray-600 mt-2">
              {template.description}
            </p>
          )}
        </CardHeader>

        <CardContent>
          {template.formSchema ? (
            <AdvanceDirectiveForm
              contentId={template.id}
              userId={userId}
              initialData={formData}
              onSave={handleSave}
              readOnly={isPreviewMode}
            />
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Form Available
              </h3>
              <p className="text-gray-600">
                This template doesn't have an interactive form configured.
              </p>
              {template.body && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
                  <h4 className="font-medium text-gray-900 mb-2">Template Content:</h4>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: template.body }}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons (only in non-preview mode) */}
      {!isPreviewMode && assignment && template.formSchema && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {hasFormData ? (
                  isFormCompleted ? (
                    <span className="text-green-600 font-medium">
                      ✓ All sections completed
                    </span>
                  ) : (
                    <span>Form in progress - save to continue later</span>
                  )
                ) : (
                  <span>Start filling out the form to save your progress</span>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={() => handleSave(formData, false)}
                  disabled={!hasFormData || saveStatus === 'saving'}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Progress
                </Button>

                <Button
                  onClick={() => handleSave(formData, true)}
                  disabled={!isFormCompleted || saveStatus === 'saving'}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Assignment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}