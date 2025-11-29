/**
 * Save Status Indicator Component
 *
 * Provides visual feedback about auto-save status including:
 * - Save in progress
 * - Successfully saved with timestamp
 * - Save errors with retry options
 * - Conflict resolution prompts
 * - Recovery from LocalStorage backup
 */

import React from 'react';
import { CheckCircle, AlertCircle, Loader2, Clock, RotateCcw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AutoSaveStatus } from '@/lib/utils/auto-save';
import { cn } from '@/lib/utils';

interface SaveStatusIndicatorProps {
  status: AutoSaveStatus;
  onRetry?: () => void;
  onRecoverFromBackup?: () => void;
  hasBackup?: boolean;
  className?: string;
  compact?: boolean;
}

export function SaveStatusIndicator({
  status,
  onRetry,
  onRecoverFromBackup,
  hasBackup = false,
  className,
  compact = false
}: SaveStatusIndicatorProps) {
  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hour${Math.floor(diffMinutes / 60) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <SaveStatusIcon status={status.status} />
        <SaveStatusText status={status} compact />
      </div>
    );
  }

  // Full status indicator with alerts and actions
  return (
    <div className={cn("space-y-2", className)}>
      {/* Main status bar */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2">
          <SaveStatusIcon status={status.status} />
          <SaveStatusText status={status} />
        </div>

        {status.status === 'error' && onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Retry
          </Button>
        )}
      </div>

      {/* Error alert */}
      {status.status === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {status.error || 'Unable to save your changes.'}
            {onRetry && (
              <span className="block mt-2">
                Your work is backed up locally. You can{' '}
                <Button variant="link" size="sm" className="p-0 h-auto" onClick={onRetry}>
                  try saving again
                </Button>
                {' '}or continue working - we&apos;ll keep trying to save automatically.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Conflict resolution alert */}
      {status.status === 'conflict' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            We found more recent changes on your device. How would you like to proceed?
            <div className="flex gap-2 mt-2">
              {onRecoverFromBackup && (
                <Button variant="outline" size="sm" onClick={onRecoverFromBackup}>
                  Use Recent Changes
                </Button>
              )}
              <Button variant="default" size="sm" onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Backup recovery prompt */}
      {hasBackup && status.status === 'idle' && onRecoverFromBackup && (
        <Alert className="border-blue-200 bg-blue-50">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            We found unsaved changes from a previous session.{' '}
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto text-blue-600"
              onClick={onRecoverFromBackup}
            >
              Recover your work
            </Button>
            {' '}or continue with the current version.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function SaveStatusIcon({ status }: { status: AutoSaveStatus['status'] }) {
  const iconProps = { className: "w-4 h-4" };

  switch (status) {
    case 'saving':
      return <Loader2 className={cn(iconProps.className, "animate-spin text-blue-600")} />;
    case 'saved':
      return <CheckCircle className={cn(iconProps.className, "text-green-600")} />;
    case 'error':
      return <AlertCircle className={cn(iconProps.className, "text-red-600")} />;
    case 'conflict':
      return <AlertCircle className={cn(iconProps.className, "text-orange-600")} />;
    default:
      return <Clock className={cn(iconProps.className, "text-gray-400")} />;
  }
}

function SaveStatusText({ status, compact = false }: { status: AutoSaveStatus; compact?: boolean }) {
  const baseClasses = "text-sm font-medium";

  switch (status.status) {
    case 'saving':
      return (
        <span className={cn(baseClasses, "text-blue-600")}>
          {compact ? 'Saving...' : 'Saving your changes...'}
        </span>
      );
    case 'saved':
      return (
        <span className={cn(baseClasses, "text-green-600")}>
          {compact ? 'Saved' : 'All changes saved'}
          {status.lastSaved && (
            <span className="text-gray-500 font-normal ml-1">
              {compact ? '' : 'at '}
              {compact
                ? formatLastSaved(status.lastSaved).replace(' ago', '')
                : formatLastSaved(status.lastSaved)
              }
            </span>
          )}
        </span>
      );
    case 'error':
      return (
        <span className={cn(baseClasses, "text-red-600")}>
          {compact ? 'Save failed' : 'Unable to save changes'}
        </span>
      );
    case 'conflict':
      return (
        <span className={cn(baseClasses, "text-orange-600")}>
          {compact ? 'Conflict' : 'Conflicting changes detected'}
        </span>
      );
    default:
      return (
        <span className={cn(baseClasses, "text-gray-600")}>
          {compact ? 'Not saved' : 'Ready to save'}
        </span>
      );
  }

  function formatLastSaved(date: Date): string {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hour${Math.floor(diffMinutes / 60) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }
}

/**
 * Compact floating save status indicator for forms
 */
export function FloatingSaveStatus({
  status,
  onRetry,
  className
}: {
  status: AutoSaveStatus;
  onRetry?: () => void;
  className?: string;
}) {
  if (status.status === 'idle' || status.status === 'saved') {
    return null; // Don't show when idle or recently saved
  }

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 p-3 bg-background border rounded-lg shadow-lg",
      "flex items-center gap-2 min-w-[200px]",
      className
    )}>
      <SaveStatusIndicator status={status} onRetry={onRetry} compact />
    </div>
  );
}

/**
 * Sticky save status bar for long forms
 */
export function StickySaveStatus({
  status,
  onRetry,
  onRecoverFromBackup,
  hasBackup,
  className
}: SaveStatusIndicatorProps) {
  return (
    <div className={cn(
      "sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b p-4",
      className
    )}>
      <SaveStatusIndicator
        status={status}
        onRetry={onRetry}
        onRecoverFromBackup={onRecoverFromBackup}
        hasBackup={hasBackup}
      />
    </div>
  );
}

/**
 * Save status badge for minimal display
 */
export function SaveStatusBadge({
  status,
  className
}: {
  status: AutoSaveStatus;
  className?: string;
}) {
  const getVariant = () => {
    switch (status.status) {
      case 'saving': return 'secondary';
      case 'saved': return 'default';
      case 'error': return 'destructive';
      case 'conflict': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Badge variant={getVariant()} className={cn("gap-1", className)}>
      <SaveStatusIcon status={status.status} />
      <SaveStatusText status={status} compact />
    </Badge>
  );
}