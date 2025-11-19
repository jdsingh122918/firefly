'use client';

/**
 * Interactive Form Components for Advance Directive Content
 * Provides rich form elements that can be embedded in content templates
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Save, Check, AlertCircle } from 'lucide-react';

// Types for form data structure
export interface FormFieldData {
  id: string;
  type: 'checkbox' | 'radio' | 'text' | 'textarea' | 'contact' | 'medical';
  label: string;
  value?: string | string[] | boolean;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface FormSectionData {
  id: string;
  title: string;
  description?: string;
  fields: FormFieldData[];
  completed?: boolean;
}

export interface FormResponseData {
  contentId: string;
  userId: string;
  sections: Record<string, FormSectionData>;
  completedAt?: Date;
  lastSaved?: Date;
}

interface AdvanceDirectiveFormProps {
  contentId: string;
  userId: string;
  initialData?: FormResponseData;
  onSave: (data: FormResponseData) => Promise<void>;
  readOnly?: boolean;
}

// Individual form field components
const CheckboxField: React.FC<{
  field: FormFieldData;
  value?: boolean | string[];
  onChange: (value: boolean | string[]) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly }) => {
  const isArray = Array.isArray(value);
  const checkboxValue = isArray ? value : (value as boolean);

  if (field.options && isArray) {
    // Multiple checkbox options
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{field.label}</Label>
        <div className="space-y-2">
          {field.options.map((option) => (
            <div key={option} className="flex items-center space-x-2">
              <Checkbox
                id={`${field.id}-${option}`}
                checked={value.includes(option)}
                onCheckedChange={(checked) => {
                  if (readOnly) return;
                  const currentValue = value as string[];
                  if (checked) {
                    onChange([...currentValue, option]);
                  } else {
                    onChange(currentValue.filter(v => v !== option));
                  }
                }}
                disabled={readOnly}
              />
              <Label htmlFor={`${field.id}-${option}`} className="text-sm">
                {option}
              </Label>
            </div>
          ))}
        </div>
      </div>
    );
  } else {
    // Single checkbox
    return (
      <div className="flex items-center space-x-2">
        <Checkbox
          id={field.id}
          checked={checkboxValue as boolean}
          onCheckedChange={(checked) => {
            if (!readOnly) onChange(checked as boolean);
          }}
          disabled={readOnly}
        />
        <Label htmlFor={field.id} className="text-sm font-medium">
          {field.label}
        </Label>
      </div>
    );
  }
};

const RadioField: React.FC<{
  field: FormFieldData;
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly }) => {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{field.label}</Label>
      <RadioGroup
        value={value || ''}
        onValueChange={readOnly ? undefined : onChange}
        disabled={readOnly}
      >
        {field.options?.map((option) => (
          <div key={option} className="flex items-center space-x-2">
            <RadioGroupItem value={option} id={`${field.id}-${option}`} />
            <Label htmlFor={`${field.id}-${option}`} className="text-sm">
              {option}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
};

const TextField: React.FC<{
  field: FormFieldData;
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Input
        id={field.id}
        value={value || ''}
        onChange={(e) => !readOnly && onChange(e.target.value)}
        placeholder={field.placeholder}
        readOnly={readOnly}
        className={readOnly ? 'bg-gray-50' : ''}
      />
    </div>
  );
};

const TextareaField: React.FC<{
  field: FormFieldData;
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}> = ({ field, value, onChange, readOnly }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <Textarea
        id={field.id}
        value={value || ''}
        onChange={(e) => !readOnly && onChange(e.target.value)}
        placeholder={field.placeholder}
        readOnly={readOnly}
        className={`min-h-[100px] ${readOnly ? 'bg-gray-50' : ''}`}
      />
    </div>
  );
};

// Contact information form block
const ContactFormBlock: React.FC<{
  data?: any;
  onChange: (data: any) => void;
  readOnly?: boolean;
  title?: string;
}> = ({ data = {}, onChange, readOnly, title = "Contact Information" }) => {
  const updateField = useCallback((field: string, value: string) => {
    if (!readOnly) {
      onChange({ ...data, [field]: value });
    }
  }, [data, onChange, readOnly]);

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField
            field={{
              id: 'name',
              type: 'text',
              label: 'Full Name',
              required: true,
              placeholder: 'Enter full name'
            }}
            value={data.name}
            onChange={(value) => updateField('name', value)}
            readOnly={readOnly}
          />
          <TextField
            field={{
              id: 'relationship',
              type: 'text',
              label: 'Relationship',
              placeholder: 'e.g., Father, Doctor, Friend'
            }}
            value={data.relationship}
            onChange={(value) => updateField('relationship', value)}
            readOnly={readOnly}
          />
          <TextField
            field={{
              id: 'phone',
              type: 'text',
              label: 'Phone Number',
              placeholder: '(555) 555-5555'
            }}
            value={data.phone}
            onChange={(value) => updateField('phone', value)}
            readOnly={readOnly}
          />
          <TextField
            field={{
              id: 'email',
              type: 'text',
              label: 'Email',
              placeholder: 'email@example.com'
            }}
            value={data.email}
            onChange={(value) => updateField('email', value)}
            readOnly={readOnly}
          />
        </div>
        <TextField
          field={{
            id: 'address',
            type: 'text',
            label: 'Address',
            placeholder: 'Street Address, City, State, ZIP'
          }}
          value={data.address}
          onChange={(value) => updateField('address', value)}
          readOnly={readOnly}
        />
      </CardContent>
    </Card>
  );
};

// Medical provider form block
const MedicalProviderBlock: React.FC<{
  data?: any;
  onChange: (data: any) => void;
  readOnly?: boolean;
  title?: string;
}> = ({ data = {}, onChange, readOnly, title = "Healthcare Provider" }) => {
  const updateField = useCallback((field: string, value: string) => {
    if (!readOnly) {
      onChange({ ...data, [field]: value });
    }
  }, [data, onChange, readOnly]);

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextField
            field={{
              id: 'name',
              type: 'text',
              label: 'Provider Name',
              required: true,
              placeholder: 'Dr. Smith'
            }}
            value={data.name}
            onChange={(value) => updateField('name', value)}
            readOnly={readOnly}
          />
          <TextField
            field={{
              id: 'specialty',
              type: 'text',
              label: 'Specialty',
              placeholder: 'Primary Care, Cardiology, etc.'
            }}
            value={data.specialty}
            onChange={(value) => updateField('specialty', value)}
            readOnly={readOnly}
          />
          <TextField
            field={{
              id: 'practice',
              type: 'text',
              label: 'Practice/Hospital',
              placeholder: 'Medical Center Name'
            }}
            value={data.practice}
            onChange={(value) => updateField('practice', value)}
            readOnly={readOnly}
          />
          <TextField
            field={{
              id: 'phone',
              type: 'text',
              label: 'Phone',
              placeholder: '(555) 555-5555'
            }}
            value={data.phone}
            onChange={(value) => updateField('phone', value)}
            readOnly={readOnly}
          />
        </div>
      </CardContent>
    </Card>
  );
};

// Form section component
const FormSection: React.FC<{
  section: FormSectionData;
  onUpdate: (section: FormSectionData) => void;
  readOnly?: boolean;
}> = ({ section, onUpdate, readOnly }) => {
  const updateField = useCallback((fieldId: string, value: any) => {
    if (readOnly) return;

    const updatedFields = section.fields.map(field =>
      field.id === fieldId ? { ...field, value } : field
    );

    const updatedSection = {
      ...section,
      fields: updatedFields,
      completed: updatedFields.every(field =>
        field.required ? Boolean(field.value) : true
      )
    };

    onUpdate(updatedSection);
  }, [section, onUpdate, readOnly]);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {section.title}
            {section.completed && (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <Check className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            )}
          </CardTitle>
        </div>
        {section.description && (
          <p className="text-sm text-muted-foreground">{section.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {section.fields.map((field) => {
          const fieldValue = field.value;

          switch (field.type) {
            case 'checkbox':
              return (
                <CheckboxField
                  key={field.id}
                  field={field}
                  value={Array.isArray(fieldValue) ? fieldValue : typeof fieldValue === 'boolean' ? fieldValue : undefined}
                  onChange={(value) => updateField(field.id, value)}
                  readOnly={readOnly}
                />
              );
            case 'radio':
              return (
                <RadioField
                  key={field.id}
                  field={field}
                  value={fieldValue as string}
                  onChange={(value) => updateField(field.id, value)}
                  readOnly={readOnly}
                />
              );
            case 'text':
              return (
                <TextField
                  key={field.id}
                  field={field}
                  value={fieldValue as string}
                  onChange={(value) => updateField(field.id, value)}
                  readOnly={readOnly}
                />
              );
            case 'textarea':
              return (
                <TextareaField
                  key={field.id}
                  field={field}
                  value={fieldValue as string}
                  onChange={(value) => updateField(field.id, value)}
                  readOnly={readOnly}
                />
              );
            default:
              return null;
          }
        })}
      </CardContent>
    </Card>
  );
};

// Main advance directive form component
export const AdvanceDirectiveForm: React.FC<AdvanceDirectiveFormProps> = ({
  contentId,
  userId,
  initialData,
  onSave,
  readOnly = false
}) => {
  const [formData, setFormData] = useState<FormResponseData>(
    initialData || {
      contentId,
      userId,
      sections: {},
      lastSaved: undefined
    }
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateSection = useCallback((sectionId: string, section: FormSectionData) => {
    setFormData(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionId]: section
      }
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (readOnly) return;

    setSaving(true);
    setSaveError(null);

    try {
      const dataToSave = {
        ...formData,
        lastSaved: new Date(),
        completedAt: Object.values(formData.sections).every(s => s.completed)
          ? new Date()
          : undefined
      };

      await onSave(dataToSave);
      setFormData(dataToSave);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save form data');
      console.error('Form save error:', error);
    } finally {
      setSaving(false);
    }
  }, [formData, onSave, readOnly]);

  const sectionEntries = Object.entries(formData.sections);
  const completedSections = sectionEntries.filter(([, section]) => section.completed).length;
  const totalSections = sectionEntries.length;
  const progressPercentage = totalSections > 0 ? (completedSections / totalSections) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress indicator */}
      {totalSections > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Progress</h3>
              <span className="text-sm text-muted-foreground">
                {completedSections}/{totalSections} sections complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form sections */}
      {sectionEntries.map(([sectionId, section]) => (
        <FormSection
          key={sectionId}
          section={section}
          onUpdate={(updatedSection) => updateSection(sectionId, updatedSection)}
          readOnly={readOnly}
        />
      ))}

      {/* Save button and status */}
      {!readOnly && (
        <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center gap-2">
            {formData.lastSaved && (
              <span className="text-sm text-muted-foreground">
                Last saved: {formData.lastSaved.toLocaleString()}
              </span>
            )}
            {saveError && (
              <span className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {saveError}
              </span>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Progress'}
          </Button>
        </div>
      )}

      {/* Completion indicator */}
      {formData.completedAt && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-800">
              <Check className="w-5 h-5" />
              <span className="font-medium">
                Form completed on {formData.completedAt.toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Specialized components for common form blocks
export { ContactFormBlock, MedicalProviderBlock };

// Helper function to create form sections from template data
export const createFormSection = (
  id: string,
  title: string,
  description: string,
  fields: FormFieldData[]
): FormSectionData => ({
  id,
  title,
  description,
  fields,
  completed: false
});

// Example form field definitions for advance directives
export const ADVANCE_DIRECTIVE_FORM_FIELDS = {
  qualityOfLife: [
    {
      id: 'meaningful_activities',
      type: 'checkbox' as const,
      label: 'What activities bring meaning to your life?',
      options: [
        'Being able to recognize loved ones and engage in meaningful conversation',
        'Being able to independently meet my own physical needs',
        'Being able to walk or move around',
        'Being able to go to work/school',
        'Being able to participate in sports or recreational activities',
        'Being able to spend quality time with friends and family',
        'Being able to participate in religious and cultural practices',
        'Being able to enjoy food and drink by mouth',
        'Being able to live in my own home',
        'Being continent of bowel and bladder',
        'Being with my pets',
        'Being able to engage in hobbies that give my life meaning'
      ],
      value: []
    },
    {
      id: 'communication_preference',
      type: 'radio' as const,
      label: 'How would you like medical conversations to be handled?',
      options: [
        'I want to be included in all medical discussions using appropriate language',
        'I want private discussions with my healthcare proxy who will share details with me',
        'I am unable to contribute to healthcare decisions; I trust my proxy to make the best choices'
      ],
      value: ''
    }
  ],
  comfortMeasures: [
    {
      id: 'comfort_activities',
      type: 'checkbox' as const,
      label: 'What brings you comfort during difficult times?',
      options: [
        'Visits with specific loved ones',
        'Prayer or spiritual practices',
        'Spending time outside',
        'Listening to favorite music or shows',
        'Special scents like candles or essential oils',
        'Eating favorite foods',
        'Reading or being read to',
        'Gentle touch or massage'
      ],
      value: []
    },
    {
      id: 'favorite_music',
      type: 'text' as const,
      label: 'Favorite music or artist',
      placeholder: 'Taylor Swift, Classical, etc.',
      value: ''
    },
    {
      id: 'comfort_instructions',
      type: 'textarea' as const,
      label: 'Special instructions for comfort care',
      placeholder: 'Describe what helps you feel calm and comfortable...',
      value: ''
    }
  ]
};

export default AdvanceDirectiveForm;