'use client';

/**
 * Video Wishes Component
 * Handles QR code generation and video link integration for advance directives
 * Based on the Sally Brown PDF video wishes section
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  QrCode,
  Play,
  Upload,
  Link as LinkIcon,
  CheckCircle,
  ExternalLink,
  Camera,
  Download,
  Copy,
  Plus
} from 'lucide-react';
import QRCode from 'qrcode';
import { QRPrivacyWarning } from '@/components/shared/privacy-security';

// Types
interface VideoWish {
  id: string;
  title: string;
  description?: string;
  videoUrl?: string;
  qrCodeData?: string;
  createdAt: Date;
  isExternal: boolean;
}

interface VideoWishesProps {
  contentId: string;
  userId: string;
  existingWishes?: VideoWish[];
  onWishAdded?: (wish: VideoWish) => void;
  readOnly?: boolean;
}

// QR Code Generator Component
const QRCodeGenerator: React.FC<{
  url: string;
  title: string;
  onGenerated?: (qrCodeData: string) => void;
}> = ({ url, title, onGenerated }) => {
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const generateQR = async () => {
      if (!url) return;

      setGenerating(true);
      try {
        const qrData = await QRCode.toDataURL(url, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeData(qrData);
        onGenerated?.(qrData);
      } catch (error) {
        console.error('QR code generation failed:', error);
      } finally {
        setGenerating(false);
      }
    };

    generateQR();
  }, [url, onGenerated]);

  const downloadQR = () => {
    if (!qrCodeData) return;

    const link = document.createElement('a');
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_QR.png`;
    link.href = qrCodeData;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  if (generating) {
    return (
      <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Generating QR code...</p>
        </div>
      </div>
    );
  }

  if (!qrCodeData) {
    return (
      <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
        <p className="text-sm text-muted-foreground">No QR code generated</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          Scannable QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <div className="flex justify-center">
          <img
            src={qrCodeData}
            alt={`QR code for ${title}`}
            className="border rounded-lg shadow-sm"
          />
        </div>

        <p className="text-sm text-muted-foreground">
          Scan this QR code with a phone camera to access the video
        </p>

        <QRPrivacyWarning
          purpose="personal video messages"
          className="text-left"
        />

        <div className="flex justify-center gap-2">
          <Button onClick={downloadQR} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
          <Button onClick={copyToClipboard} variant="outline" size="sm">
            <Copy className="w-4 h-4 mr-1" />
            Copy Link
          </Button>
        </div>

        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
          <strong>Link:</strong><br />
          <span className="break-all">{url}</span>
        </div>
      </CardContent>
    </Card>
  );
};

// Video Upload Component
const VideoUploadForm: React.FC<{
  onVideoAdded: (wish: Partial<VideoWish>) => void;
  readOnly?: boolean;
}> = ({ onVideoAdded, readOnly }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    videoUrl: '',
    isExternal: true
  });
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.videoUrl) return;

    setUploading(true);
    try {
      const newWish: Partial<VideoWish> = {
        title: formData.title,
        description: formData.description,
        videoUrl: formData.videoUrl,
        isExternal: formData.isExternal,
        createdAt: new Date()
      };

      onVideoAdded(newWish);
      setFormData({ title: '', description: '', videoUrl: '', isExternal: true });
    } catch (error) {
      console.error('Failed to add video wish:', error);
    } finally {
      setUploading(false);
    }
  };

  const validateVideoUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  if (readOnly) {
    return (
      <Alert>
        <AlertDescription>
          Video wishes can only be added by the content creator or assignor.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Add Video Wishes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Video Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Personal Message from Sally"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the video content"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoUrl">Video URL</Label>
            <Input
              id="videoUrl"
              type="url"
              value={formData.videoUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, videoUrl: e.target.value }))}
              placeholder="https://example.com/video-link"
              required
            />
            <p className="text-xs text-muted-foreground">
              Enter a URL to an external video service (YouTube, Vimeo, etc.) or a direct video file link
            </p>
          </div>

          <Button
            type="submit"
            disabled={uploading || !formData.title || !validateVideoUrl(formData.videoUrl)}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            {uploading ? 'Adding Video...' : 'Add Video Wishes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

// Video Wishes Display Component
const VideoWishDisplay: React.FC<{
  wish: VideoWish;
  showQRCode?: boolean;
  onRemove?: (wishId: string) => void;
  readOnly?: boolean;
}> = ({ wish, showQRCode = true, onRemove, readOnly }) => {
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false);

  const handleVideoClick = () => {
    if (wish.videoUrl) {
      window.open(wish.videoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium flex items-center gap-2">
            <Play className="w-4 h-4" />
            {wish.title}
          </h4>
          {wish.description && (
            <p className="text-sm text-muted-foreground mt-1">{wish.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={wish.isExternal ? "outline" : "default"}>
              {wish.isExternal ? "External Video" : "Uploaded Video"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {wish.createdAt.toLocaleDateString()}
            </span>
          </div>
        </div>

        {!readOnly && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(wish.id)}
            className="text-red-500 hover:text-red-700"
          >
            Remove
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleVideoClick} variant="outline" size="sm">
          <ExternalLink className="w-4 h-4 mr-1" />
          Watch Video
        </Button>
        {wish.videoUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(wish.videoUrl!)}
          >
            <Copy className="w-4 h-4 mr-1" />
            Copy Link
          </Button>
        )}
      </div>

      {showQRCode && wish.videoUrl && (
        <div className="pt-4 border-t">
          <QRCodeGenerator
            url={wish.videoUrl}
            title={wish.title}
            onGenerated={() => setQrCodeGenerated(true)}
          />
        </div>
      )}
    </div>
  );
};

// Main Video Wishes Component
export const VideoWishesComponent: React.FC<VideoWishesProps> = ({
  contentId,
  userId,
  existingWishes = [],
  onWishAdded,
  readOnly = false
}) => {
  const [wishes, setWishes] = useState<VideoWish[]>(existingWishes);
  const [showForm, setShowForm] = useState(false);

  const handleAddWish = (newWish: Partial<VideoWish>) => {
    const wish: VideoWish = {
      ...newWish as VideoWish,
      id: Date.now().toString(), // In real implementation, this would come from the API
    };

    setWishes(prev => [...prev, wish]);
    onWishAdded?.(wish);
    setShowForm(false);
  };

  const handleRemoveWish = (wishId: string) => {
    setWishes(prev => prev.filter(w => w.id !== wishId));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Video Wishes</h3>
          <p className="text-muted-foreground">
            Record personal video messages to share with family and healthcare providers
          </p>
        </div>

        {!readOnly && !showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Video
          </Button>
        )}
      </div>

      {wishes.length === 0 && !showForm && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-lg font-medium mb-2">No Video Wishes Yet</h4>
              <p className="text-muted-foreground mb-4">
                Video wishes allow you to share personal messages about your values,
                wishes, and important thoughts with your loved ones.
              </p>
              {!readOnly && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Video
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <div className="space-y-4">
          <VideoUploadForm
            onVideoAdded={handleAddWish}
            readOnly={readOnly}
          />
          <Button
            variant="outline"
            onClick={() => setShowForm(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {wishes.map(wish => (
          <VideoWishDisplay
            key={wish.id}
            wish={wish}
            onRemove={handleRemoveWish}
            readOnly={readOnly}
          />
        ))}
      </div>

      {wishes.length > 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Your video wishes have been saved. Family members and healthcare providers
            can access these videos using the QR codes or direct links provided.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default VideoWishesComponent;