import {
  BookOpen,
  FileText,
  Video,
  Headphones,
  Image as ImageIcon,
  Link as LinkIcon,
  Wrench,
  Phone,
  Briefcase,
  ScrollText,
} from 'lucide-react';

/**
 * Get the appropriate icon for a resource type
 */
export const getResourceTypeIcon = (type: string, isTemplateResource: boolean = false) => {
  if (isTemplateResource) {
    return ScrollText; // Special icon for templates
  }

  switch (type) {
    case 'DOCUMENT':
      return FileText;
    case 'LINK':
      return LinkIcon;
    case 'VIDEO':
      return Video;
    case 'AUDIO':
      return Headphones;
    case 'IMAGE':
      return ImageIcon;
    case 'TOOL':
      return Wrench;
    case 'CONTACT':
      return Phone;
    case 'SERVICE':
      return Briefcase;
    default:
      return BookOpen;
  }
};

/**
 * Check if a resource is a template
 */
export const isTemplate = (resource: { externalMeta?: any; visibility: string; tags: string[]; status: string }) => {
  return resource.externalMeta?.isTemplate === true ||
    (resource.visibility === 'PUBLIC' &&
     resource.tags.includes('advance-directives') &&
     resource.status === 'APPROVED');
};