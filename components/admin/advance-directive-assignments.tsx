'use client';

/**
 * Admin Assignment Interface for Advance Directive Content
 * Allows admins and volunteers to assign system-generated advance directive templates
 * to family members through the existing assignment workflow
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Plus,
  Calendar,
  Clock,
  Users,
  AlertCircle,
  CheckCircle,
  Send,
  Filter,
  Search
} from 'lucide-react';

// Types
interface AdvanceDirectiveTemplate {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  tags: string[];
  hasAssignments: boolean;
}

interface FamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  familyId: string;
  familyName: string;
}

interface AssignmentRequest {
  contentId: string;
  assignedTo: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: Date;
  estimatedMinutes?: number;
  tags: string[];
}

interface BulkAssignmentRequest {
  templates: string[];
  members: string[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: Date;
  spacing: number; // Days between assignments
  customInstructions?: string;
}

// Props
interface AdvanceDirectiveAssignmentsProps {
  userRole: 'ADMIN' | 'VOLUNTEER';
  userId: string;
  onAssignmentCreated?: (assignments: any[]) => void;
}

// Mock data - replace with actual API calls
const MOCK_TEMPLATES: AdvanceDirectiveTemplate[] = [
  {
    id: '1',
    title: 'Advance Directive Overview & Importance',
    description: 'Understanding advance care planning and its significance for end-of-life decisions',
    estimatedMinutes: 15,
    tags: ['Legal Aid', 'Medical Decision-Making'],
    hasAssignments: true
  },
  {
    id: '2',
    title: 'Healthcare Values & Quality of Life Assessment',
    description: 'Interactive assessment to identify what brings meaning and quality to your life',
    estimatedMinutes: 30,
    tags: ['Legal Aid', 'Medical Decision-Making', 'Palliative & Hospice Care'],
    hasAssignments: true
  },
  {
    id: '3',
    title: 'Medical Team & Contact Information',
    description: 'Comprehensive template for recording healthcare providers and emergency contacts',
    estimatedMinutes: 20,
    tags: ['Legal Aid', 'Medical Decision-Making'],
    hasAssignments: true
  }
];

const MOCK_FAMILY_MEMBERS: FamilyMember[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    familyId: 'family1',
    familyName: 'Doe Family'
  },
  {
    id: '2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    familyId: 'family2',
    familyName: 'Smith Family'
  }
];

// Individual assignment form component
const SingleAssignmentForm: React.FC<{
  templates: AdvanceDirectiveTemplate[];
  members: FamilyMember[];
  onSubmit: (assignment: AssignmentRequest) => Promise<void>;
}> = ({ templates, members, onSubmit }) => {
  const [formData, setFormData] = useState<Partial<AssignmentRequest>>({
    priority: 'MEDIUM',
    tags: []
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contentId || !formData.assignedTo || !formData.title) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData as AssignmentRequest);
      setFormData({ priority: 'MEDIUM', tags: [] });
    } catch (error) {
      console.error('Assignment creation failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === formData.contentId);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Template</Label>
          <Select
            value={formData.contentId || ''}
            onValueChange={(value) => {
              const template = templates.find(t => t.id === value);
              setFormData(prev => ({
                ...prev,
                contentId: value,
                title: template ? `Complete: ${template.title}` : '',
                description: template?.description || '',
                estimatedMinutes: template?.estimatedMinutes,
                tags: template?.tags || []
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map(template => (
                <SelectItem key={template.id} value={template.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{template.title}</span>
                    <span className="text-sm text-muted-foreground">
                      ~{template.estimatedMinutes} min
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Assign to</Label>
          <Select
            value={formData.assignedTo || ''}
            onValueChange={(value) => setFormData(prev => ({ ...prev, assignedTo: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select member" />
            </SelectTrigger>
            <SelectContent>
              {members.map(member => (
                <SelectItem key={member.id} value={member.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{member.firstName} {member.lastName}</span>
                    <span className="text-sm text-muted-foreground">{member.familyName}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Assignment Title</Label>
        <Input
          value={formData.title || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Enter assignment title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Instructions</Label>
        <Textarea
          value={formData.description || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Additional instructions for the member"
          className="min-h-[80px]"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={formData.priority || 'MEDIUM'}
            onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Due Date (Optional)</Label>
          <Input
            type="date"
            value={formData.dueDate ? formData.dueDate.toISOString().split('T')[0] : ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              dueDate: e.target.value ? new Date(e.target.value) : undefined
            }))}
          />
        </div>

        <div className="space-y-2">
          <Label>Estimated Time</Label>
          <Input
            type="number"
            value={formData.estimatedMinutes || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              estimatedMinutes: parseInt(e.target.value) || undefined
            }))}
            placeholder="Minutes"
          />
        </div>
      </div>

      {selectedTemplate && (
        <div className="p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Template Preview</h4>
          <p className="text-sm text-muted-foreground mb-3">{selectedTemplate.description}</p>
          <div className="flex flex-wrap gap-1">
            {selectedTemplate.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" disabled={submitting} className="w-full">
        <Send className="w-4 h-4 mr-2" />
        {submitting ? 'Creating Assignment...' : 'Create Assignment'}
      </Button>
    </form>
  );
};

// Bulk assignment form component
const BulkAssignmentForm: React.FC<{
  templates: AdvanceDirectiveTemplate[];
  members: FamilyMember[];
  onSubmit: (request: BulkAssignmentRequest) => Promise<void>;
}> = ({ templates, members, onSubmit }) => {
  const [formData, setFormData] = useState<Partial<BulkAssignmentRequest>>({
    templates: [],
    members: [],
    priority: 'MEDIUM',
    spacing: 7
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.templates?.length || !formData.members?.length) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData as BulkAssignmentRequest);
      setFormData({
        templates: [],
        members: [],
        priority: 'MEDIUM',
        spacing: 7
      });
    } catch (error) {
      console.error('Bulk assignment creation failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const totalAssignments = (formData.templates?.length || 0) * (formData.members?.length || 0);
  const estimatedTotalTime = formData.templates?.reduce((total, templateId) => {
    const template = templates.find(t => t.id === templateId);
    return total + (template?.estimatedMinutes || 0);
  }, 0) || 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Template Selection */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Select Templates</Label>
        <div className="grid grid-cols-1 gap-3">
          {templates.map(template => (
            <div key={template.id} className="flex items-start space-x-3 p-3 border rounded-lg">
              <Checkbox
                id={`template-${template.id}`}
                checked={formData.templates?.includes(template.id) || false}
                onCheckedChange={(checked) => {
                  setFormData(prev => ({
                    ...prev,
                    templates: checked
                      ? [...(prev.templates || []), template.id]
                      : prev.templates?.filter(id => id !== template.id) || []
                  }));
                }}
              />
              <div className="flex-1">
                <label htmlFor={`template-${template.id}`} className="cursor-pointer">
                  <h4 className="font-medium">{template.title}</h4>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~{template.estimatedMinutes} min
                    </span>
                    <div className="flex gap-1">
                      {template.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Select the advance directive templates to assign. They will be assigned in order.
        </p>
      </div>

      {/* Member Selection */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Select Family Members</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {members.map(member => (
            <div key={member.id} className="flex items-center space-x-3 p-3 border rounded-lg">
              <Checkbox
                id={`member-${member.id}`}
                checked={formData.members?.includes(member.id) || false}
                onCheckedChange={(checked) => {
                  setFormData(prev => ({
                    ...prev,
                    members: checked
                      ? [...(prev.members || []), member.id]
                      : prev.members?.filter(id => id !== member.id) || []
                  }));
                }}
              />
              <div className="flex-1">
                <label htmlFor={`member-${member.id}`} className="cursor-pointer">
                  <h4 className="font-medium">{member.firstName} {member.lastName}</h4>
                  <p className="text-sm text-muted-foreground">{member.familyName}</p>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assignment Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={formData.priority || 'MEDIUM'}
            onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>First Due Date (Optional)</Label>
          <Input
            type="date"
            value={formData.dueDate ? formData.dueDate.toISOString().split('T')[0] : ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              dueDate: e.target.value ? new Date(e.target.value) : undefined
            }))}
          />
        </div>

        <div className="space-y-2">
          <Label>Days Between Assignments</Label>
          <Input
            type="number"
            min="1"
            max="30"
            value={formData.spacing || 7}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              spacing: parseInt(e.target.value) || 7
            }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Custom Instructions (Optional)</Label>
        <Textarea
          value={formData.customInstructions || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, customInstructions: e.target.value }))}
          placeholder="Additional instructions that will be added to all assignments"
          className="min-h-[80px]"
        />
      </div>

      {/* Summary */}
      {totalAssignments > 0 && (
        <div className="p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-3">Assignment Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Assignments:</span>
              <p className="font-medium">{totalAssignments}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Total Time:</span>
              <p className="font-medium">~{estimatedTotalTime} min</p>
            </div>
            <div>
              <span className="text-muted-foreground">Templates:</span>
              <p className="font-medium">{formData.templates?.length || 0}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Members:</span>
              <p className="font-medium">{formData.members?.length || 0}</p>
            </div>
          </div>
        </div>
      )}

      <Button
        type="submit"
        disabled={submitting || totalAssignments === 0}
        className="w-full"
        size="lg"
      >
        <Send className="w-4 h-4 mr-2" />
        {submitting ? 'Creating Assignments...' : `Create ${totalAssignments} Assignments`}
      </Button>
    </form>
  );
};

// Main component
export const AdvanceDirectiveAssignments: React.FC<AdvanceDirectiveAssignmentsProps> = ({
  userRole,
  userId,
  onAssignmentCreated
}) => {
  const [templates, setTemplates] = useState<AdvanceDirectiveTemplate[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // TODO: Replace with actual API calls
        setTemplates(MOCK_TEMPLATES);
        setMembers(MOCK_FAMILY_MEMBERS);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userRole, userId]);

  const handleSingleAssignment = useCallback(async (assignment: AssignmentRequest) => {
    try {
      // TODO: Replace with actual API call
      console.log('Creating assignment:', assignment);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      onAssignmentCreated?.([assignment]);
    } catch (error) {
      console.error('Failed to create assignment:', error);
      throw error;
    }
  }, [onAssignmentCreated]);

  const handleBulkAssignment = useCallback(async (request: BulkAssignmentRequest) => {
    try {
      // TODO: Replace with actual API call
      console.log('Creating bulk assignments:', request);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      const assignments = request.templates.flatMap(templateId =>
        request.members.map(memberId => ({
          contentId: templateId,
          assignedTo: memberId,
          title: `Complete: ${templates.find(t => t.id === templateId)?.title}`,
          description: request.customInstructions || '',
          priority: request.priority,
          dueDate: request.dueDate,
          tags: templates.find(t => t.id === templateId)?.tags || []
        }))
      );

      onAssignmentCreated?.(assignments);
    } catch (error) {
      console.error('Failed to create bulk assignments:', error);
      throw error;
    }
  }, [templates, onAssignmentCreated]);

  const filteredTemplates = templates.filter(template =>
    template.title.toLowerCase().includes(filter.toLowerCase()) ||
    template.description.toLowerCase().includes(filter.toLowerCase()) ||
    template.tags.some(tag => tag.toLowerCase().includes(filter.toLowerCase()))
  );

  const filteredMembers = members.filter(member =>
    `${member.firstName} ${member.lastName}`.toLowerCase().includes(filter.toLowerCase()) ||
    member.email.toLowerCase().includes(filter.toLowerCase()) ||
    member.familyName.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading advance directive templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advance Directive Assignments</h2>
          <p className="text-muted-foreground">
            Assign system-generated advance directive templates to family members
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {templates.length} Templates
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {members.length} Members
          </Badge>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Filter templates or members..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'single' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('single')}
        >
          Single Assignment
        </Button>
        <Button
          variant={activeTab === 'bulk' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('bulk')}
        >
          Bulk Assignment
        </Button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignment Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {activeTab === 'single' ? 'Create Single Assignment' : 'Create Bulk Assignments'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeTab === 'single' ? (
                <SingleAssignmentForm
                  templates={filteredTemplates}
                  members={filteredMembers}
                  onSubmit={handleSingleAssignment}
                />
              ) : (
                <BulkAssignmentForm
                  templates={filteredTemplates}
                  members={filteredMembers}
                  onSubmit={handleBulkAssignment}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Information Panel */}
        <div className="space-y-6">
          {/* Available Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {filteredTemplates.map(template => (
                    <div key={template.id} className="p-3 border rounded-lg">
                      <h4 className="font-medium text-sm mb-1">{template.title}</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        {template.description.slice(0, 80)}...
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {template.estimatedMinutes}min
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {template.tags[0]}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Assignment Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Assignment Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <h4 className="font-medium mb-1">Recommended Sequence</h4>
                <p className="text-muted-foreground">
                  Start with the overview, then proceed to values assessment, contact information,
                  preferences, healthcare instructions, and finally legal documentation.
                </p>
              </div>
              <Separator />
              <div className="text-sm">
                <h4 className="font-medium mb-1">Timing</h4>
                <p className="text-muted-foreground">
                  Allow 7-14 days between assignments to give members time to complete each section thoughtfully.
                </p>
              </div>
              <Separator />
              <div className="text-sm">
                <h4 className="font-medium mb-1">Support</h4>
                <p className="text-muted-foreground">
                  Consider scheduling follow-up conversations to discuss completed sections and answer questions.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdvanceDirectiveAssignments;