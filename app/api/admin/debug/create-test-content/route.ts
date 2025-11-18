import { NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { createResponse } from "@/lib/utils/api-response";
import { ContentRepository } from "@/lib/db/repositories/content.repository";
import { DocumentRepository } from "@/lib/db/repositories/document.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { ContentType, NoteVisibility } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return createResponse(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the current user
    const userRepository = new UserRepository();
    const user = await userRepository.getUserByClerkId(userId);

    if (!user || user.role !== "ADMIN") {
      return createResponse(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    console.log("🔧 Creating test content with attachments...");

    const contentRepository = new ContentRepository(prisma);
    const documentRepository = new DocumentRepository();

    // Create sample documents first
    const sampleDocuments = [
      {
        title: "Sample PDF Document",
        fileName: "sample.pdf",
        mimeType: "application/pdf",
        fileData: Buffer.from("PDF-like content for testing"),
        fileSize: 1024
      },
      {
        title: "Sample Image",
        fileName: "sample.jpg",
        mimeType: "image/jpeg",
        fileData: Buffer.from("JPEG-like content for testing"),
        fileSize: 2048
      },
      {
        title: "Sample Text Document",
        fileName: "sample.txt",
        mimeType: "text/plain",
        fileData: Buffer.from("This is a sample text document for testing attachment functionality."),
        fileSize: 512
      }
    ];

    const createdDocuments = [];
    for (const docData of sampleDocuments) {
      const document = await documentRepository.createDocument({
        title: docData.title,
        fileName: docData.fileName,
        filePath: `test/${docData.fileName}`, // Legacy field
        fileSize: docData.fileSize,
        mimeType: docData.mimeType,
        uploadedBy: user.id
      });
      createdDocuments.push(document);
    }

    // Create sample content items with attachments
    const sampleContent = [
      {
        title: "Test Content with PDF Attachment",
        description: "This is a test content item that has a PDF attachment to verify the attachment display functionality.",
        content: "This content demonstrates how attachments are displayed in the content management system.",
        type: ContentType.NOTE,
        visibility: NoteVisibility.PUBLIC,
        documents: [createdDocuments[0].id] // PDF
      },
      {
        title: "Test Content with Multiple Attachments",
        description: "This content has multiple attachments of different types.",
        content: "This content shows how multiple attachments are rendered in the UI.",
        type: ContentType.RESOURCE,
        visibility: NoteVisibility.PUBLIC,
        documents: [createdDocuments[1].id, createdDocuments[2].id] // Image + Text
      },
      {
        title: "Test Content with Image Attachment",
        description: "This content demonstrates image attachment display.",
        content: "This shows how image attachments are handled in the system.",
        type: ContentType.NOTE,
        visibility: NoteVisibility.PRIVATE,
        documents: [createdDocuments[1].id] // Image only
      }
    ];

    const createdContent = [];
    for (const contentData of sampleContent) {
      const { documents: documentIds, type, content, ...otherFields } = contentData;

      const contentItem = await contentRepository.create({
        ...otherFields,
        contentType: type, // Map 'type' to 'contentType'
        body: content, // Map 'content' to 'body'
        familyId: user.familyId || undefined,
        tags: ['test-data', 'attachment-test'],
        categoryId: undefined
      }, user.id, user.role);

      // Link documents to content
      if (documentIds && documentIds.length > 0) {
        for (let i = 0; i < documentIds.length; i++) {
          await contentRepository.attachDocument(
            contentItem.id,
            documentIds[i],
            user.id, // attachedBy
            i, // order
            i === 0 // isMain - first document is main
          );
        }
      }

      createdContent.push(contentItem);
    }

    console.log("✅ Test content created successfully:", {
      documentsCreated: createdDocuments.length,
      contentItemsCreated: createdContent.length
    });

    return createResponse({
      success: true,
      message: "Test content with attachments created successfully",
      data: {
        documents: createdDocuments.map(doc => ({
          id: doc.id,
          title: doc.title,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize
        })),
        content: createdContent.map(content => ({
          id: content.id,
          title: content.title,
          type: content.contentType,
          visibility: content.visibility
        }))
      }
    });

  } catch (error) {
    console.error("❌ Failed to create test content:", error);
    return createResponse(
      { error: "Failed to create test content" },
      { status: 500 }
    );
  }
}