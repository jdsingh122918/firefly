/**
 * Accessibility Controls Component
 *
 * Provides user controls for accessibility features including:
 * - Font size adjustment (small, medium, large)
 * - High contrast mode toggle
 * - Persistent user preferences via localStorage
 * - Keyboard navigation support
 * - WCAG 2.1 AA compliance features
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Type,
  Eye,
  Monitor,
  Minus,
  Plus,
  RotateCcw,
  Settings,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Accessibility preference types
export interface AccessibilityPreferences {
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  reducedMotion: boolean;
  largeButtons: boolean;
}

// Default preferences
const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  fontSize: 'medium',
  highContrast: false,
  reducedMotion: false,
  largeButtons: false
};

// Storage key for preferences
const STORAGE_KEY = 'accessibility-preferences';

// Font size mappings
const FONT_SIZE_CONFIG = {
  small: {
    label: 'Small',
    description: 'Default text size',
    scale: '0.875', // 14px base
    cssClass: 'text-sm'
  },
  medium: {
    label: 'Medium',
    description: 'Slightly larger text',
    scale: '1', // 16px base
    cssClass: 'text-base'
  },
  large: {
    label: 'Large',
    description: 'Larger text for better readability',
    scale: '1.125', // 18px base
    cssClass: 'text-lg'
  }
} as const;

/**
 * Hook for managing accessibility preferences
 */
export function useAccessibilityPreferences() {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      }
    } catch (error) {
      console.warn('Failed to load accessibility preferences:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Apply preferences to document
  useEffect(() => {
    if (!isLoaded) return;

    const root = document.documentElement;

    // Apply font size
    root.style.setProperty('--font-size-scale', FONT_SIZE_CONFIG[preferences.fontSize].scale);
    root.setAttribute('data-font-size', preferences.fontSize);

    // Apply high contrast
    if (preferences.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Apply reduced motion
    if (preferences.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    // Apply large buttons
    if (preferences.largeButtons) {
      root.classList.add('large-buttons');
    } else {
      root.classList.remove('large-buttons');
    }

  }, [preferences, isLoaded]);

  // Save preferences to localStorage
  const savePreferences = useCallback((newPreferences: AccessibilityPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
      setPreferences(newPreferences);
    } catch (error) {
      console.warn('Failed to save accessibility preferences:', error);
    }
  }, []);

  // Update specific preference
  const updatePreference = useCallback(<K extends keyof AccessibilityPreferences>(
    key: K,
    value: AccessibilityPreferences[K]
  ) => {
    savePreferences({ ...preferences, [key]: value });
  }, [preferences, savePreferences]);

  // Reset to defaults
  const resetPreferences = useCallback(() => {
    savePreferences(DEFAULT_PREFERENCES);
  }, [savePreferences]);

  return {
    preferences,
    updatePreference,
    resetPreferences,
    isLoaded
  };
}

/**
 * Compact accessibility widget for page headers
 */
interface AccessibilityWidgetProps {
  className?: string;
  showLabels?: boolean;
}

export function AccessibilityWidget({ className, showLabels = false }: AccessibilityWidgetProps) {
  const { preferences, updatePreference, isLoaded } = useAccessibilityPreferences();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isLoaded) return null;

  return (
    <div className={cn("relative", className)}>
      {/* Toggle button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 min-h-[44px]"
        aria-label="Open accessibility controls"
        aria-expanded={isExpanded}
      >
        <Settings className="w-4 h-4" />
        {showLabels && <span>Accessibility</span>}
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {/* Active indicators */}
        {(preferences.highContrast || preferences.fontSize !== 'medium') && (
          <Badge variant="secondary" className="text-xs px-1">
            {preferences.highContrast && preferences.fontSize !== 'medium' ? '2' : '1'}
          </Badge>
        )}
      </Button>

      {/* Expanded controls */}
      {isExpanded && (
        <Card className="absolute top-full right-0 mt-2 w-80 z-50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Accessibility Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AccessibilityControls compact />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Full accessibility controls panel
 */
interface AccessibilityControlsProps {
  compact?: boolean;
  className?: string;
}

export function AccessibilityControls({ compact = false, className }: AccessibilityControlsProps) {
  const { preferences, updatePreference, resetPreferences, isLoaded } = useAccessibilityPreferences();

  if (!isLoaded) {
    return <div className="animate-pulse bg-gray-200 h-32 rounded" />;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Font Size Controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4" />
          <Label className="text-sm font-medium">Text Size</Label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(FONT_SIZE_CONFIG) as Array<keyof typeof FONT_SIZE_CONFIG>).map((size) => {
            const config = FONT_SIZE_CONFIG[size];
            const isActive = preferences.fontSize === size;

            return (
              <Button
                key={size}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => updatePreference('fontSize', size)}
                className={cn(
                  "flex flex-col items-center gap-1 min-h-[60px] relative",
                  compact ? "text-xs" : "text-sm"
                )}
                aria-pressed={isActive}
              >
                {isActive && <Check className="absolute top-1 right-1 w-3 h-3" />}
                <span className={cn("font-medium", config.cssClass)}>
                  A
                </span>
                <span className="text-xs">{config.label}</span>
                {!compact && (
                  <span className="text-xs text-muted-foreground text-center leading-tight">
                    {config.description}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {!compact && <Separator />}

      {/* High Contrast Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monitor className="w-4 h-4" />
          <div>
            <Label className="text-sm font-medium">High Contrast</Label>
            {!compact && (
              <p className="text-xs text-muted-foreground">
                Increases color contrast for better visibility
              </p>
            )}
          </div>
        </div>
        <Switch
          checked={preferences.highContrast}
          onCheckedChange={(checked) => updatePreference('highContrast', checked)}
          aria-label="Toggle high contrast mode"
        />
      </div>

      {!compact && (
        <>
          <Separator />

          {/* Reduced Motion Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-4 h-4" />
              <div>
                <Label className="text-sm font-medium">Reduce Motion</Label>
                <p className="text-xs text-muted-foreground">
                  Minimizes animations and transitions
                </p>
              </div>
            </div>
            <Switch
              checked={preferences.reducedMotion}
              onCheckedChange={(checked) => updatePreference('reducedMotion', checked)}
              aria-label="Toggle reduced motion"
            />
          </div>

          <Separator />

          {/* Large Buttons Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Plus className="w-4 h-4" />
              <div>
                <Label className="text-sm font-medium">Large Touch Targets</Label>
                <p className="text-xs text-muted-foreground">
                  Makes buttons and links larger for easier interaction
                </p>
              </div>
            </div>
            <Switch
              checked={preferences.largeButtons}
              onCheckedChange={(checked) => updatePreference('largeButtons', checked)}
              aria-label="Toggle large touch targets"
            />
          </div>

          <Separator />

          {/* Reset Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={resetPreferences}
            className="w-full flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * Accessibility floating action button for quick access
 */
export function AccessibilityFAB() {
  const { preferences } = useAccessibilityPreferences();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating action button */}
      <div className="fixed bottom-4 left-4 z-50">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "rounded-full w-14 h-14 shadow-lg",
            "transition-all duration-200",
            isOpen && "bg-primary-600"
          )}
          aria-label="Accessibility options"
        >
          <Eye className="w-5 h-5" />
          {(preferences.highContrast || preferences.fontSize !== 'medium') && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {preferences.highContrast && preferences.fontSize !== 'medium' ? '2' : '1'}
            </Badge>
          )}
        </Button>
      </div>

      {/* Floating panel */}
      {isOpen && (
        <div className="fixed bottom-20 left-4 z-40">
          <Card className="w-80 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Accessibility</CardTitle>
            </CardHeader>
            <CardContent>
              <AccessibilityControls />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="w-full mt-4"
              >
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Accessibility page component for settings
 */
export function AccessibilitySettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Accessibility Settings</h1>
        <p className="text-muted-foreground mt-1">
          Customize your experience for better accessibility and usability.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Visual Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AccessibilityControls />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">
              These settings are saved to your device and will persist across sessions.
            </p>
            <p>
              Need additional accessibility support?
              <a href="mailto:support@firefly.com" className="text-primary hover:underline ml-1">
                Contact our support team
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AccessibilityControls;