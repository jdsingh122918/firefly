/**
 * Privacy and Security Messaging Components
 *
 * Provides HIPAA compliance indicators, privacy badges, and security messaging
 * components for healthcare applications. Builds user trust by transparently
 * communicating data protection measures and access controls.
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Lock,
  Eye,
  Users,
  ShieldCheck,
  Globe,
  UserCheck,
  ExternalLink,
  AlertTriangle,
  FileText,
  Database,
  Key,
  CheckCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * HIPAA Compliance Badge - Shows HIPAA compliance status
 */
interface HIPAABadgeProps {
  variant?: 'default' | 'compact' | 'detailed';
  showDescription?: boolean;
  className?: string;
}

export function HIPAABadge({
  variant = 'default',
  showDescription = false,
  className
}: HIPAABadgeProps) {
  if (variant === 'compact') {
    return (
      <Badge variant="outline" className={cn("border-green-200 text-green-700 bg-green-50", className)}>
        <ShieldCheck className="w-3 h-3 mr-1" />
        HIPAA
      </Badge>
    );
  }

  if (variant === 'detailed') {
    return (
      <Alert className="border-green-200 bg-green-50">
        <ShieldCheck className="h-4 w-4 text-green-600" />
        <AlertDescription>
          <div className="font-medium text-green-900 mb-1">HIPAA Compliant</div>
          <div className="text-sm text-green-700">
            This platform meets Health Insurance Portability and Accountability Act (HIPAA)
            requirements for protecting your health information.
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">
        <ShieldCheck className="w-3 h-3 mr-1" />
        HIPAA Compliant
      </Badge>
      {showDescription && (
        <span className="text-xs text-muted-foreground">
          Your health data is protected
        </span>
      )}
    </div>
  );
}

/**
 * Encryption Badge - Shows data encryption status
 */
interface EncryptionBadgeProps {
  variant?: 'default' | 'compact';
  className?: string;
}

export function EncryptionBadge({ variant = 'default', className }: EncryptionBadgeProps) {
  if (variant === 'compact') {
    return (
      <Badge variant="outline" className={cn("border-blue-200 text-blue-700 bg-blue-50", className)}>
        <Lock className="w-3 h-3 mr-1" />
        Encrypted
      </Badge>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Lock className="w-4 h-4 text-blue-600" />
      <div>
        <div className="text-sm font-medium">256-bit Encryption</div>
        <div className="text-xs text-muted-foreground">
          Your data is encrypted in transit and at rest
        </div>
      </div>
    </div>
  );
}

/**
 * Privacy Level Indicator - Shows who can access the data
 */
interface PrivacyLevelProps {
  level: 'private' | 'family' | 'providers' | 'team' | 'public';
  showDescription?: boolean;
  className?: string;
}

export function PrivacyLevel({ level, showDescription = false, className }: PrivacyLevelProps) {
  const configs = {
    private: {
      icon: Lock,
      label: 'Private',
      description: 'Only you can see this information',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    family: {
      icon: Users,
      label: 'Family',
      description: 'You and your family members can see this',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    providers: {
      icon: UserCheck,
      label: 'Healthcare Providers',
      description: 'You, family, and healthcare providers can see this',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    team: {
      icon: Users,
      label: 'Care Team',
      description: 'Your care team members can see this',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },
    public: {
      icon: Globe,
      label: 'Public',
      description: 'This information may be visible to others',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    }
  };

  // Add error handling for invalid levels
  const config = configs[level];
  if (!config) {
    console.warn(`Invalid privacy level "${level}" provided to PrivacyLevel component. Valid levels are: ${Object.keys(configs).join(', ')}`);
    // Fallback to private level for safety
    const fallbackConfig = configs.private;
    const Icon = fallbackConfig.icon;
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Badge
          variant="outline"
          className={cn("gap-1", fallbackConfig.bgColor, fallbackConfig.borderColor, fallbackConfig.color)}
        >
          <Icon className="w-3 h-3" />
          {fallbackConfig.label}
        </Badge>
        {showDescription && (
          <span className="text-xs text-muted-foreground">
            {fallbackConfig.description}
          </span>
        )}
      </div>
    );
  }

  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge
        variant="outline"
        className={cn("gap-1", config.bgColor, config.borderColor, config.color)}
      >
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
      {showDescription && (
        <span className="text-xs text-muted-foreground">
          {config.description}
        </span>
      )}
    </div>
  );
}

/**
 * Data Access Transparency - Shows who has access to specific data
 */
interface DataAccessProps {
  accessList: Array<{
    type: 'user' | 'role' | 'provider' | 'system';
    name: string;
    description?: string;
  }>;
  title?: string;
  className?: string;
}

export function DataAccessTransparency({
  accessList,
  title = "Who can see this information",
  className
}: DataAccessProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'user': return Eye;
      case 'role': return Users;
      case 'provider': return UserCheck;
      case 'system': return Database;
      default: return Eye;
    }
  };

  return (
    <Card className={cn("border-blue-200 bg-blue-50", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Eye className="w-4 h-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {accessList.map((access, index) => {
          const Icon = getIcon(access.type);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <Icon className="w-4 h-4 text-blue-600" />
              <span className="font-medium">{access.name}</span>
              {access.description && (
                <span className="text-muted-foreground">- {access.description}</span>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/**
 * Security Notice - General security information banner
 */
interface SecurityNoticeProps {
  type?: 'info' | 'warning' | 'success';
  title: string;
  message: string;
  action?: {
    label: string;
    href: string;
  };
  className?: string;
}

export function SecurityNotice({
  type = 'info',
  title,
  message,
  action,
  className
}: SecurityNoticeProps) {
  const variants = {
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-900',
      iconColor: 'text-blue-600'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-900',
      iconColor: 'text-yellow-600'
    },
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      textColor: 'text-green-900',
      iconColor: 'text-green-600'
    }
  };

  const variant = variants[type];
  const Icon = variant.icon;

  return (
    <Alert className={cn(variant.bgColor, className)}>
      <Icon className={cn("h-4 w-4", variant.iconColor)} />
      <AlertDescription>
        <div className={cn("font-medium mb-1", variant.textColor)}>{title}</div>
        <div className={cn("text-sm", variant.textColor)}>{message}</div>
        {action && (
          <Button
            variant="link"
            size="sm"
            className={cn("p-0 h-auto mt-2", variant.textColor)}
            asChild
          >
            <a href={action.href} target="_blank" rel="noopener noreferrer">
              {action.label}
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Healthcare Privacy Header - Comprehensive privacy information for forms
 */
interface HealthcarePrivacyHeaderProps {
  formType?: string;
  accessLevel?: 'private' | 'family' | 'providers' | 'team';
  showFullDetails?: boolean;
  className?: string;
}

export function HealthcarePrivacyHeader({
  formType = "healthcare information",
  accessLevel = 'private',
  showFullDetails = false,
  className
}: HealthcarePrivacyHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Main privacy banner */}
      <Alert className="border-green-200 bg-green-50">
        <Shield className="h-4 w-4 text-green-600" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-green-900">
                Your {formType} is private and secure
              </div>
              <div className="text-sm text-green-700 mt-1">
                We use enterprise-grade security to protect your sensitive health information.
              </div>
            </div>
            <div className="flex gap-2">
              <HIPAABadge variant="compact" />
              <EncryptionBadge variant="compact" />
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Privacy level and access information */}
      <div className="flex items-center justify-between">
        <PrivacyLevel level={accessLevel} showDescription />

        {showFullDetails && (
          <Button variant="outline" size="sm" className="text-xs">
            <Key className="w-3 h-3 mr-1" />
            Privacy Settings
          </Button>
        )}
      </div>

      {/* Detailed security features */}
      {showFullDetails && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Security Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600" />
                <span>End-to-end encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <span>HIPAA compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-600" />
                <span>Secure cloud storage</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-600" />
                <span>Audit trail maintained</span>
              </div>
            </div>

            <Separator />

            <div className="text-xs text-muted-foreground">
              <p className="mb-2">
                <strong>Data Location:</strong> Your information is stored in HIPAA-compliant
                data centers in the United States.
              </p>
              <p>
                <strong>Access Control:</strong> Only authorized individuals on your care team
                can access your information, and all access is logged.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Form Privacy Footer - Minimal privacy reminders for form footers
 */
export function FormPrivacyFooter({ className }: { className?: string }) {
  return (
    <div className={cn("text-center text-xs text-muted-foreground space-y-2", className)}>
      <div className="flex items-center justify-center gap-4">
        <HIPAABadge variant="compact" />
        <EncryptionBadge variant="compact" />
      </div>
      <p>
        Your information is protected by enterprise-grade security and HIPAA compliance.{' '}
        <a href="/privacy" className="text-primary hover:underline">
          Privacy Policy
        </a>
        {' • '}
        <a href="/security" className="text-primary hover:underline">
          Security Details
        </a>
      </p>
    </div>
  );
}

/**
 * QR Code Privacy Warning - For healthcare QR codes
 */
interface QRPrivacyWarningProps {
  purpose: string;
  className?: string;
}

export function QRPrivacyWarning({ purpose, className }: QRPrivacyWarningProps) {
  return (
    <Alert className={cn("border-yellow-200 bg-yellow-50", className)}>
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription>
        <div className="font-medium text-yellow-900 mb-1">
          Share QR Code Responsibly
        </div>
        <div className="text-sm text-yellow-700">
          This QR code provides access to your {purpose}. Only share it with trusted
          healthcare providers when needed for your care.
        </div>
      </AlertDescription>
    </Alert>
  );
}

export default {
  HIPAABadge,
  EncryptionBadge,
  PrivacyLevel,
  DataAccessTransparency,
  SecurityNotice,
  HealthcarePrivacyHeader,
  FormPrivacyFooter,
  QRPrivacyWarning
};