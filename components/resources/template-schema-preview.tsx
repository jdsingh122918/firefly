"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Circle,
  AlignLeft,
  FileText,
  Asterisk,
  LayoutList,
  FormInput,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface FormField {
  id: string;
  type: "checkbox" | "radio" | "textarea" | "text";
  label: string;
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

interface FormSchema {
  sections: Record<string, FormSection>;
}

interface TemplateSchemaPreviewProps {
  formSchema: FormSchema;
  className?: string;
}

const getFieldTypeIcon = (type: string) => {
  switch (type) {
    case "checkbox":
      return CheckSquare;
    case "radio":
      return Circle;
    case "textarea":
      return AlignLeft;
    case "text":
    default:
      return FormInput;
  }
};

const getFieldTypeLabel = (type: string) => {
  switch (type) {
    case "checkbox":
      return "Multiple choice";
    case "radio":
      return "Single choice";
    case "textarea":
      return "Long text";
    case "text":
    default:
      return "Short text";
  }
};

function FieldPreview({ field }: { field: FormField }) {
  const [showOptions, setShowOptions] = useState(false);
  const TypeIcon = getFieldTypeIcon(field.type);
  const hasOptions = field.options && field.options.length > 0;

  return (
    <div className="py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
      <div className="flex items-start gap-2">
        <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{field.label}</span>
            {field.required && (
              <Badge variant="outline" className="h-5 text-[10px] px-1.5 border-red-200 text-red-600 bg-red-50">
                <Asterisk className="h-2.5 w-2.5 mr-0.5" />
                Required
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
              {getFieldTypeLabel(field.type)}
            </Badge>
            {hasOptions && (
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                {showOptions ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {field.options!.length} options
              </button>
            )}
          </div>
          {showOptions && hasOptions && (
            <ul className="mt-2 space-y-1 pl-1">
              {field.options!.map((option, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                  {field.type === "checkbox" ? (
                    <CheckSquare className="h-3 w-3 mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="h-3 w-3 mt-0.5 shrink-0" />
                  )}
                  <span className="break-words">{option}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionPreview({
  section,
  defaultOpen = false,
}: {
  section: FormSection;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const requiredCount = section.fields.filter((f) => f.required).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">{section.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {section.fields.length} field{section.fields.length !== 1 ? "s" : ""}
            </Badge>
            {requiredCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-red-200 text-red-600 bg-red-50">
                {requiredCount} required
              </Badge>
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2 pl-6">
          {section.description && (
            <p className="text-xs text-muted-foreground mb-3">{section.description}</p>
          )}
          {section.fields.map((field) => (
            <FieldPreview key={field.id} field={field} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TemplateSchemaPreview({
  formSchema,
  className,
}: TemplateSchemaPreviewProps) {
  const sections = Object.values(formSchema.sections);
  const totalFields = sections.reduce((acc, s) => acc + s.fields.length, 0);
  const totalRequired = sections.reduce(
    (acc, s) => acc + s.fields.filter((f) => f.required).length,
    0
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="flex items-center gap-1">
          <LayoutList className="h-3 w-3" />
          {sections.length} section{sections.length !== 1 ? "s" : ""}
        </Badge>
        <Badge variant="secondary" className="flex items-center gap-1">
          <FormInput className="h-3 w-3" />
          {totalFields} field{totalFields !== 1 ? "s" : ""}
        </Badge>
        {totalRequired > 0 && (
          <Badge variant="outline" className="flex items-center gap-1 border-red-200 text-red-600 bg-red-50">
            <Asterisk className="h-3 w-3" />
            {totalRequired} required
          </Badge>
        )}
      </div>

      {/* Section previews */}
      <div className="space-y-2">
        {sections.map((section, idx) => (
          <SectionPreview
            key={section.id}
            section={section}
            defaultOpen={idx === 0}
          />
        ))}
      </div>

      {/* Footer hint */}
      <p className="text-xs text-muted-foreground text-center pt-2 border-t">
        Click &quot;Start Working&quot; to begin filling out this template
      </p>
    </div>
  );
}
