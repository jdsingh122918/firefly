"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

export interface UploadConfig {
  maxFileSize: number;
  maxFileSizeMB: number;
  allowedMimeTypes: string[];
  categories: string[];
  supportedExtensions: string[];
}

export interface UploadedFile {
  fileId: string;
  fileName: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  category: string;
}

export interface UploadProgress {
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  result?: UploadedFile;
}

interface UseFileUploadState {
  isLoading: boolean;
  uploads: UploadProgress[];
  config: UploadConfig | null;
  error: string | null;
}

export function useFileUpload() {
  const { isSignedIn, getToken } = useAuth();
  const [state, setState] = useState<UseFileUploadState>({
    isLoading: false,
    uploads: [],
    config: null,
    error: null,
  });

  // Fetch upload configuration
  const fetchConfig = useCallback(async () => {
    if (!isSignedIn) return null;

    try {
      const token = await getToken();
      const response = await fetch("/api/files/upload", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setState((prev) => ({ ...prev, config: data.config }));
        return data.config;
      } else {
        throw new Error(data.error || "Failed to fetch config");
      }
    } catch (error) {
      console.error("❌ Failed to fetch upload config:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Failed to fetch config",
      }));
      return null;
    }
  }, [isSignedIn, getToken]);

  // Validate file before upload
  const validateFile = useCallback(
    (
      file: File,
      config?: UploadConfig,
    ): { isValid: boolean; error?: string } => {
      const uploadConfig = config || state.config;

      if (!uploadConfig) {
        return { isValid: false, error: "Upload configuration not loaded" };
      }

      // Check file size
      if (file.size > uploadConfig.maxFileSize) {
        return {
          isValid: false,
          error: `File size exceeds limit of ${uploadConfig.maxFileSizeMB}MB`,
        };
      }

      // Check MIME type
      if (!uploadConfig.allowedMimeTypes.includes(file.type)) {
        return {
          isValid: false,
          error: `File type '${file.type}' is not allowed`,
        };
      }

      // Check file name
      if (!file.name || file.name.length > 255) {
        return {
          isValid: false,
          error: "Invalid file name",
        };
      }

      return { isValid: true };
    },
    [state.config],
  );

  // Upload single file
  const uploadFile = useCallback(
    async (
      file: File,
      options?: {
        category?: string;
        description?: string;
        onProgress?: (progress: number) => void;
      },
    ): Promise<UploadedFile | null> => {
      if (!isSignedIn) {
        throw new Error("User not authenticated");
      }

      // Validate file
      const validation = validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      try {
        const formData = new FormData();
        formData.append("files", file);

        if (options?.category) {
          formData.append("category", options.category);
        }
        if (options?.description) {
          formData.append("description", options.description);
        }

        // Create progress entry
        setState((prev) => ({
          ...prev,
          uploads: [
            ...prev.uploads,
            {
              file,
              progress: 0,
              status: "uploading",
            },
          ],
        }));

        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          // Try to get error details from response body
          let errorMessage = response.statusText || `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // If response body is not JSON, use status text
          }
          throw new Error(`Upload failed: ${errorMessage}`);
        }

        const data = await response.json();

        if (data.success && data.files && data.files.length > 0) {
          const uploadedFile = data.files[0];

          // Update upload progress
          setState((prev) => ({
            ...prev,
            uploads: prev.uploads.map((upload) =>
              upload.file === file
                ? {
                    ...upload,
                    progress: 100,
                    status: "success",
                    result: uploadedFile,
                  }
                : upload,
            ),
          }));

          console.log("✅ File uploaded:", uploadedFile);
          return uploadedFile;
        } else {
          console.error("❌ Upload API response indicates failure:", {
            success: data.success,
            error: data.error,
            errors: data.errors,
            details: data.details,
            filesCount: data.files?.length || 0,
          });
          throw new Error(data.error || data.errors?.join(', ') || "Upload failed");
        }
      } catch (error) {
        console.error("❌ File upload error:", error);

        // Update upload status to error
        setState((prev) => ({
          ...prev,
          uploads: prev.uploads.map((upload) =>
            upload.file === file
              ? {
                  ...upload,
                  status: "error",
                  error:
                    error instanceof Error ? error.message : "Upload failed",
                }
              : upload,
          ),
        }));

        throw error;
      }
    },
    [isSignedIn, getToken, validateFile],
  );

  // Upload multiple files
  const uploadFiles = useCallback(
    async (
      files: File[],
      options?: {
        category?: string;
        description?: string;
        onProgress?: (fileIndex: number, progress: number) => void;
      },
    ): Promise<{
      successful: UploadedFile[];
      failed: Array<{ file: File; error: string }>;
    }> => {
      const successful: UploadedFile[] = [];
      const failed: Array<{ file: File; error: string }> = [];

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];

          try {
            const result = await uploadFile(file, {
              category: options?.category,
              description: options?.description,
              onProgress: (progress) => options?.onProgress?.(i, progress),
            });

            if (result) {
              successful.push(result);
            }
          } catch (error) {
            failed.push({
              file,
              error: error instanceof Error ? error.message : "Upload failed",
            });
          }
        }

        console.log("📁 Batch upload complete:", {
          successful: successful.length,
          failed: failed.length,
        });

        return { successful, failed };
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [uploadFile],
  );

  // Clear upload history
  const clearUploads = useCallback(() => {
    setState((prev) => ({ ...prev, uploads: [] }));
  }, []);

  // Remove specific upload from history
  const removeUpload = useCallback((file: File) => {
    setState((prev) => ({
      ...prev,
      uploads: prev.uploads.filter((upload) => upload.file !== file),
    }));
  }, []);

  // Get file URL (supports both filesystem and database storage)
  const getFileUrl = useCallback(
    (
      categoryOrId: string,
      filename?: string,
      options?: { download?: boolean; inline?: boolean; storageMethod?: "filesystem" | "database" },
    ) => {
      const params = new URLSearchParams();
      if (options?.download) params.set("download", "true");
      if (options?.inline) params.set("inline", "true");

      const queryString = params.toString();

      // If no filename provided, assume it's a database document ID
      if (!filename || options?.storageMethod === "database") {
        return `/api/files/db/${categoryOrId}${queryString ? `?${queryString}` : ""}`;
      }

      // Traditional filesystem path
      return `/api/files/${categoryOrId}/${filename}${queryString ? `?${queryString}` : ""}`;
    },
    [],
  );

  // Helper function to get file URL from upload result
  const getFileUrlFromResult = useCallback(
    (uploadResult: UploadedFile, options?: { download?: boolean; inline?: boolean }) => {
      // New upload results include storageMethod
      const result = uploadResult as UploadedFile & { storageMethod?: string };

      if (result.storageMethod === "database" || result.url.includes("/api/files/db/")) {
        // Extract document ID from database URL
        const documentId = result.url.split("/api/files/db/")[1];
        return getFileUrl(documentId, undefined, { ...options, storageMethod: "database" });
      }

      // Traditional filesystem storage
      const urlParts = result.url.split("/api/files/")[1];
      const [category, fileName] = urlParts.split("/");
      return getFileUrl(category, fileName, { ...options, storageMethod: "filesystem" });
    },
    [getFileUrl],
  );

  // Delete file (supports both filesystem and database storage)
  const deleteFile = useCallback(
    async (categoryOrId: string, filename?: string): Promise<boolean> => {
      if (!isSignedIn) {
        throw new Error("User not authenticated");
      }

      try {
        const token = await getToken();
        let deleteUrl: string;

        // Determine if this is a database document ID or filesystem path
        if (!filename || categoryOrId.length === 24) {
          // Database storage - document ID
          deleteUrl = `/api/files/db/${categoryOrId}`;
        } else {
          // Filesystem storage - category/filename
          deleteUrl = `/api/files/${categoryOrId}/${filename}`;
        }

        const response = await fetch(deleteUrl, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Delete failed: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
          console.log("🗑️ File deleted:", { categoryOrId, filename, deleteUrl });
          return true;
        } else {
          throw new Error(data.error || "Delete failed");
        }
      } catch (error) {
        console.error("❌ File deletion error:", error);
        throw error;
      }
    },
    [isSignedIn, getToken],
  );

  // Auto-fetch configuration when user signs in
  useEffect(() => {
    if (isSignedIn && !state.config && !state.isLoading) {
      console.log("📁 Auto-fetching upload configuration...");
      fetchConfig();
    }
  }, [isSignedIn, state.config, state.isLoading, fetchConfig]);

  return {
    // State
    isLoading: state.isLoading,
    uploads: state.uploads,
    config: state.config,
    error: state.error,

    // Actions
    fetchConfig,
    uploadFile,
    uploadFiles,
    deleteFile,
    validateFile,

    // Utilities
    clearUploads,
    removeUpload,
    getFileUrl,
    getFileUrlFromResult,

    // Derived state
    hasUploads: state.uploads.length > 0,
    hasActiveUploads: state.uploads.some(
      (upload) => upload.status === "uploading" || upload.status === "pending",
    ),
    hasFailedUploads: state.uploads.some((upload) => upload.status === "error"),
    successfulUploads: state.uploads.filter(
      (upload) => upload.status === "success",
    ),
    failedUploads: state.uploads.filter((upload) => upload.status === "error"),
  };
}
