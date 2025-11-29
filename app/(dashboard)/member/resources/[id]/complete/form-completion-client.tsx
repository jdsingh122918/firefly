'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, AlertCircle, FileText, Clock } from 'lucide-react';
import { AdvanceDirectiveForm, FormResponseData, FormSectionData } from '@/components/forms/advance-directive-forms';

interface FormCompletionClientProps {
  resourceId: string;
  resourceTitle: string;
  resourceDescription: string;
  formSchema: { sections: Record<string, any> };
  userId: string;
  existingFormData?: Record<string, any>;
  assignmentStatus: string;
}

export function FormCompletionClient({
  resourceId,
  resourceTitle,
  resourceDescription,
  formSchema,
  userId,
  existingFormData,
  assignmentStatus,
}: FormCompletionClientProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Convert formSchema sections to FormSectionData format
  const convertToFormSections = useCallback((
    schema: { sections: Record<string, any> },
    existingData?: Record<string, any>
  ): Record<string, FormSectionData> => {
    const sections: Record<string, FormSectionData> = {};

    Object.entries(schema.sections).forEach(([sectionId, sectionDef]) => {
      const existingSectionData = existingData?.[sectionId];

      sections[sectionId] = {
        id: sectionDef.id || sectionId,
        title: sectionDef.title,
        description: sectionDef.description,
        completed: existingSectionData?.completed || false,
        fields: sectionDef.fields.map((field: any) => ({
          id: field.id,
          type: field.type,
          label: field.label,
          required: field.required || false,
          options: field.options,
          placeholder: field.placeholder,
          // Restore existing values
          value: existingSectionData?.fields?.find((f: any) => f.id === field.id)?.value || field.value,
        })),
      };
    });

    return sections;
  }, []);

  // Build initial form data
  const initialFormData: FormResponseData = {
    contentId: resourceId,
    userId: userId,
    sections: convertToFormSections(formSchema, existingFormData),
    lastSaved: undefined,
  };

  // Handle form save (called by AdvanceDirectiveForm auto-save)
  const handleSave = useCallback(async (data: FormResponseData) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/resources/${resourceId}/form-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formData: data.sections,
          isComplete: data.completedAt ? true : false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save form');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving form:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save form');
      throw error; // Re-throw for auto-save to handle
    } finally {
      setIsSaving(false);
    }
  }, [resourceId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/member/resources/${resourceId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Resource
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={assignmentStatus === 'completed' ? 'default' : 'secondary'}>
            {assignmentStatus === 'completed' ? (
              <>
                <CheckCircle className="h-3 w-3 mr-1" />
                Completed
              </>
            ) : assignmentStatus === 'started' ? (
              <>
                <Clock className="h-3 w-3 mr-1" />
                In Progress
              </>
            ) : (
              <>
                <FileText className="h-3 w-3 mr-1" />
                Pending
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* Title Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {resourceTitle}
          </CardTitle>
          {resourceDescription && (
            <CardDescription>{resourceDescription}</CardDescription>
          )}
        </CardHeader>
      </Card>

      {/* Error Message */}
      {saveError && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{saveError}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <AdvanceDirectiveForm
        contentId={resourceId}
        userId={userId}
        initialData={initialFormData}
        onSave={handleSave}
      />
    </div>
  );
}
