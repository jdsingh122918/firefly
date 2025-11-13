import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { DocumentType } from "@/lib/types";
import { DocumentRepository } from "@/lib/db/repositories/document.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { v4 as uuidv4 } from "uuid";
import type { DocumentMetadata } from "@/lib/types/api";

const documentRepository = new DocumentRepository();
const userRepository = new UserRepository();

// File upload limits
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ALLOWED_VIDEO_TYPES = ['.mp4', '.webm', '.mov', '.avi'];
const ALLOWED_AUDIO_TYPES = ['.mp3', '.wav', '.ogg', '.m4a'];
const ALLOWED_DOCUMENT_TYPES = ['.pdf', '.doc', '.docx', '.txt', '.md'];

// Validation schema for document upload
const uploadDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  familyId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Validation schema for creating a document (existing functionality)
const createDocumentSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  description: z
    .string()
    .max(1000, "Description must be less than 1000 characters")
    .optional(),
  filePath: z.string().min(1, "File path is required"),
  fileName: z.string().min(1, "File name is required"),
  originalFileName: z.string().optional(),
  fileSize: z.number().positive().optional(),
  mimeType: z.string().optional(),
  type: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]).optional(),
  familyId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.custom<DocumentMetadata>().optional(),
  visibility: z.enum(["PRIVATE", "FAMILY", "SHARED", "PUBLIC"]).default("PRIVATE"),
  expiresAt: z.string().datetime().optional(),
});

// GET /api/documents - Get documents with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("📄 GET /api/documents - User:", {
      role: user.role,
      email: user.email,
    });

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const uploadedBy = searchParams.get("uploadedBy");
    const familyId = searchParams.get("familyId");
    const type = searchParams.get("type") as DocumentType | null;
    // Note: Document model doesn't have visibility or categoryId fields
    const search = searchParams.get("search");
    const tags = searchParams.get("tags")?.split(",").filter(Boolean);
    const mimeType = searchParams.get("mimeType");
    const minSize = searchParams.get("minSize") ? parseInt(searchParams.get("minSize")!) : undefined;
    const maxSize = searchParams.get("maxSize") ? parseInt(searchParams.get("maxSize")!) : undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sortBy = searchParams.get("sortBy") as "createdAt" | "updatedAt" | "title" | "fileSize" || "createdAt";
    const sortOrder = searchParams.get("sortOrder") as "asc" | "desc" || "desc";

    // Build filters object
    const filters = {
      ...(uploadedBy && { uploadedBy }),
      ...(familyId && { familyId }),
      ...(type && { type }),
      ...(search && { search }),
      ...(tags && { tags }),
      ...(mimeType && { mimeType }),
      ...(minSize !== undefined && { minSize }),
      ...(maxSize !== undefined && { maxSize }),
      isDeleted: false,
    };

    console.log("🔍 Document filters applied:", filters);

    // Get documents with access control and pagination
    const result = await documentRepository.getDocuments(filters, {
      page,
      limit,
      sortBy,
      sortOrder,
    });

    console.log("✅ Documents retrieved:", {
      total: result.total,
      page: result.page,
      filters
    });

    // Format response
    const formattedDocuments = result.items.map(document => ({
      id: document.id,
      title: document.title,
      description: document.description,
      fileName: document.fileName,
      originalFileName: document.originalFileName,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      type: document.type,
      status: document.status,
      filePath: document.filePath,
      thumbnailPath: document.thumbnailPath,
      duration: document.duration,
      width: document.width,
      height: document.height,
      familyId: document.familyId,
      family: document.family ? {
        id: document.family.id,
        name: document.family.name,
      } : null,
      tags: document.tags,
      metadata: document.metadata,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      uploader: document.uploadedByUser ? {
        id: document.uploadedByUser.id,
        name: document.uploadedByUser.firstName
          ? `${document.uploadedByUser.firstName} ${document.uploadedByUser.lastName || ""}`.trim()
          : document.uploadedByUser.email,
        email: document.uploadedByUser.email,
      } : null,
    }));

    return NextResponse.json({
      documents: formattedDocuments,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
      filters: {
        uploadedBy: uploadedBy || null,
        familyId: familyId || null,
        type: type || null,
        search: search || null,
        tags: tags || null,
        mimeType: mimeType || null,
        minSize,
        maxSize,
      },
    });
  } catch (error) {
    console.error("❌ GET /api/documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 },
    );
  }
}

// POST /api/documents - Upload a document
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database to check role
    const user = await userRepository.getUserByClerkId(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if it's a file upload or metadata creation
    const contentType = request.headers.get("content-type");

    if (contentType?.includes("multipart/form-data")) {
      // Handle file upload
      return await handleFileUpload(request, user);
    } else {
      // Handle metadata-only document creation (existing functionality)
      return await handleDocumentCreation(request, user);
    }
  } catch (error) {
    console.error("❌ Error in POST /api/documents:", error);
    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 },
    );
  }
}

// Handle file upload
async function handleFileUpload(request: NextRequest, user: any) {
  // Parse FormData
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
      { status: 400 }
    );
  }

  // Validate file type
  const fileExtension = extname(file.name).toLowerCase();
  const isValidType = [
    ...ALLOWED_IMAGE_TYPES,
    ...ALLOWED_VIDEO_TYPES,
    ...ALLOWED_AUDIO_TYPES,
    ...ALLOWED_DOCUMENT_TYPES,
  ].includes(fileExtension);

  if (!isValidType) {
    return NextResponse.json(
      { error: "File type not supported" },
      { status: 400 }
    );
  }

  // Determine document type
  let documentType: DocumentType = DocumentType.OTHER;
  if (ALLOWED_IMAGE_TYPES.includes(fileExtension)) {
    documentType = DocumentType.PHOTO;
  } else if (ALLOWED_VIDEO_TYPES.includes(fileExtension)) {
    documentType = DocumentType.VIDEO;
  } else if (ALLOWED_AUDIO_TYPES.includes(fileExtension)) {
    documentType = DocumentType.OTHER; // No specific AUDIO type, use OTHER
  }

  // Parse metadata from form data
  const metadataStr = formData.get("metadata") as string;
  let validatedData = {};

  if (metadataStr) {
    try {
      const metadata = JSON.parse(metadataStr);
      validatedData = uploadDocumentSchema.parse(metadata);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid metadata format" },
        { status: 400 }
      );
    }
  } else {
    validatedData = uploadDocumentSchema.parse({});
  }

  console.log("📄 Uploading document:", {
    fileName: file.name,
    fileSize: file.size,
    type: documentType,
    uploadedBy: user.email,
  });

  // Create upload directory if it doesn't exist
  const uploadDir = join(process.cwd(), "public", "uploads", "documents");
  await mkdir(uploadDir, { recursive: true });

  // Generate unique filename
  const fileId = uuidv4();
  const fileName = `${fileId}${fileExtension}`;
  const filePath = join(uploadDir, fileName);
  const relativeFilePath = `/uploads/documents/${fileName}`;

  // Save file to disk
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await writeFile(filePath, buffer);

  // Extract media metadata if applicable
  let mediaMetadata = {};

  // For images, we could extract dimensions here
  // For videos/audio, we could extract duration here
  // This would typically use libraries like sharp, ffprobe, etc.
  // For now, we'll set basic metadata

  if (documentType === DocumentType.PHOTO) {
    // TODO: Extract image dimensions using sharp
    mediaMetadata = { width: null, height: null };
  } else if (documentType === DocumentType.VIDEO) {
    // TODO: Extract duration using ffprobe
    mediaMetadata = { duration: null };
  }

  // Create document record
  const document = await documentRepository.createDocument({
    title: (validatedData as any).title || file.name,
    description: (validatedData as any).description,
    fileName: fileName,
    originalFileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    type: documentType,
    filePath: relativeFilePath,
    thumbnailPath: undefined, // TODO: Generate thumbnail
    uploadedBy: user.id,
    familyId: (validatedData as any).familyId,
    tags: (validatedData as any).tags || [],
    metadata: {
      ...((validatedData as any).metadata || {}),
      ...mediaMetadata,
      originalMimeType: file.type,
      uploadSource: "web",
    },
    ...mediaMetadata,
  });

  console.log("✅ Document uploaded successfully:", {
    documentId: document.id,
    fileName: document.fileName,
    fileSize: document.fileSize,
    type: document.type,
  });

  return NextResponse.json(
    {
      success: true,
      document: {
        id: document.id,
        title: document.title,
        description: document.description,
        fileName: document.fileName,
        originalFileName: document.originalFileName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        type: document.type,
        status: document.status,
        filePath: document.filePath,
        thumbnailPath: document.thumbnailPath,
        duration: document.duration,
        width: document.width,
        height: document.height,
        familyId: document.familyId,
        family: document.family ? {
          id: document.family.id,
          name: document.family.name,
        } : null,
        tags: document.tags,
        metadata: document.metadata,
        createdAt: document.createdAt,
        uploader: document.uploadedByUser ? {
          id: document.uploadedByUser.id,
          name: document.uploadedByUser.firstName
            ? `${document.uploadedByUser.firstName} ${document.uploadedByUser.lastName || ""}`.trim()
            : document.uploadedByUser.email,
          email: document.uploadedByUser.email,
        } : null,
      },
    },
    { status: 201 },
  );
}

// Handle metadata-only document creation (existing functionality)
async function handleDocumentCreation(request: NextRequest, user: any) {
  console.log("📄 Creating document metadata:", {
    createdBy: user.email,
  });

  // Parse and validate request body
  const body = await request.json();
  const validatedData = createDocumentSchema.parse(body);

  // Validate family access if familyId is provided
  if (validatedData.familyId && user.familyId && validatedData.familyId !== user.familyId) {
    if (user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        {
          error: "Access denied: Cannot create documents for other families",
        },
        { status: 403 },
      );
    }
  }

  // Create document record
  const document = await documentRepository.createDocument({
    title: validatedData.title,
    description: validatedData.description,
    fileName: validatedData.fileName,
    originalFileName: validatedData.originalFileName,
    fileSize: validatedData.fileSize,
    mimeType: validatedData.mimeType,
    type: validatedData.type as DocumentType,
    filePath: validatedData.filePath,
    thumbnailPath: undefined,
    uploadedBy: user.id,
    familyId: validatedData.familyId,
    tags: validatedData.tags || [],
    metadata: validatedData.metadata || {},
    duration: undefined,
    width: undefined,
    height: undefined,
  });

  return NextResponse.json(
    {
      success: true,
      document: {
        id: document.id,
        title: document.title,
        description: document.description,
        fileName: document.fileName,
        originalFileName: document.originalFileName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        type: document.type,
        status: document.status,
        filePath: document.filePath,
        familyId: document.familyId,
        tags: document.tags,
        metadata: document.metadata,
        createdAt: document.createdAt,
        uploader: document.uploadedByUser ? {
          id: document.uploadedByUser.id,
          name: document.uploadedByUser.firstName
            ? `${document.uploadedByUser.firstName} ${document.uploadedByUser.lastName || ""}`.trim()
            : document.uploadedByUser.email,
          email: document.uploadedByUser.email,
        } : null,
      },
      message: "Document created successfully",
    },
    { status: 201 },
  );
}
