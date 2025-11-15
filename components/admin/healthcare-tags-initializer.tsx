"use client";

import React, { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Tag,
  Folder,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthcareTagsResult {
  categoriesCount: number;
  tagsCount: number;
  forced?: boolean;
  existing?: boolean;
}

export function HealthcareTagsInitializer() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HealthcareTagsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initializeTags = async (force = false) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch('/api/tags/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ force })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data.data);

    } catch (err) {
      console.error('Failed to initialize healthcare tags:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize healthcare tags');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-blue-600" />
          Healthcare Tags Initialization
        </CardTitle>
        <CardDescription>
          Initialize comprehensive healthcare service tags and categories that are automatically
          available system-wide for organizing notes and resources.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Info about what will be created */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This will create <strong>8 healthcare categories</strong> and <strong>50+ system tags</strong>
            covering medical services, mental health, home care, equipment, basic needs, legal, and educational services.
          </AlertDescription>
        </Alert>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            onClick={() => initializeTags(false)}
            disabled={loading}
            className="min-h-[44px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Tag className="h-4 w-4 mr-2" />
            )}
            Initialize Tags
          </Button>

          <Button
            variant="outline"
            onClick={() => initializeTags(true)}
            disabled={loading}
            className="min-h-[44px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Force Recreate
          </Button>
        </div>

        {/* Error display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success result */}
        {result && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <div className="space-y-2">
                <p className="font-medium">
                  {result.existing
                    ? "Healthcare tags already exist!"
                    : "Healthcare tags initialized successfully!"
                  }
                </p>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Folder className="h-3 w-3" />
                    <span>Categories: {result.categoriesCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    <span>Tags: {result.tagsCount}</span>
                  </div>
                  {result.forced && (
                    <Badge variant="outline" className="text-orange-700 bg-orange-50 border-orange-200">
                      Recreated
                    </Badge>
                  )}
                  {result.existing && (
                    <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">
                      Already Exists
                    </Badge>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Healthcare Categories Preview */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Categories that will be created:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { name: "Medical & Healthcare Services", icon: "🏥", tags: 12 },
              { name: "Mental Health & Supportive Programs", icon: "🧠", tags: 9 },
              { name: "Home & Community-Based Care", icon: "🏠", tags: 5 },
              { name: "Medical Supplies & Equipment", icon: "🔧", tags: 3 },
              { name: "Basic Needs & Daily Living", icon: "🛡️", tags: 3 },
              { name: "Finances & Insurance", icon: "💰", tags: 1 },
              { name: "Legal & Advocacy", icon: "⚖️", tags: 3 },
              { name: "Education & Employment", icon: "📚", tags: 3 },
            ].map((category) => (
              <div
                key={category.name}
                className="flex items-center gap-2 p-2 rounded border bg-gray-50 text-sm"
              >
                <span className="text-lg">{category.icon}</span>
                <span className="font-medium truncate">{category.name}</span>
                <Badge variant="secondary" className="text-xs ml-auto">
                  {category.tags} tags
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}