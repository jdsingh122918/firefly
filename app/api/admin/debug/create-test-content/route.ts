import { NextRequest } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { createResponse } from "@/lib/utils/api-response";
import { ResourceRepository } from "@/lib/db/repositories/resource.repository";
import { DocumentRepository } from "@/lib/db/repositories/document.repository";
import { UserRepository } from "@/lib/db/repositories/user.repository";
import { ResourceType, ResourceVisibility } from "@prisma/client";
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

    console.log("🔧 Creating test resources with attachments...");

    const resourceRepository = new ResourceRepository(prisma);
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

    // Create sample resource items with attachments
    const sampleResources = [
      {
        title: "Test Resource with PDF Attachment",
        description: "This is a test resource item that has a PDF attachment to verify the attachment display functionality.",
        body: "This resource demonstrates how attachments are displayed in the resource management system.",
        resourceType: ResourceType.DOCUMENT,
        visibility: ResourceVisibility.PUBLIC,
        documents: [createdDocuments[0].id] // PDF
      },
      {
        title: "Test Resource with Multiple Attachments",
        description: "This resource has multiple attachments of different types.",
        body: "This resource shows how multiple attachments are rendered in the UI.",
        resourceType: ResourceType.DOCUMENT,
        visibility: ResourceVisibility.PUBLIC,
        documents: [createdDocuments[1].id, createdDocuments[2].id] // Image + Text
      },
      {
        title: "Test Resource with Image Attachment",
        description: "This resource demonstrates image attachment display.",
        body: "This shows how image attachments are handled in the system.",
        resourceType: ResourceType.IMAGE,
        visibility: ResourceVisibility.PRIVATE,
        documents: [createdDocuments[1].id] // Image only
      }
    ];

    const createdResources = [];
    for (const resourceData of sampleResources) {
      const { documents: documentIds, ...otherFields } = resourceData;

      const resourceItem = await resourceRepository.create({
        ...otherFields,
        familyId: user.familyId || undefined,
        tags: ['test-data', 'attachment-test'],
        categoryId: undefined,
        createdBy: user.id
      }, user.id, user.role);

      // Link documents to resource
      if (documentIds && documentIds.length > 0) {
        for (let i = 0; i < documentIds.length; i++) {
          await resourceRepository.attachDocument(
            resourceItem.id,
            documentIds[i],
            user.id, // attachedBy
            i, // order
            i === 0 // isMain - first document is main
          );
        }
      }

      createdResources.push(resourceItem);
    }

    console.log("✅ Test resources created successfully:", {
      documentsCreated: createdDocuments.length,
      resourcesCreated: createdResources.length
    });

    return createResponse({
      success: true,
      message: "Test resources with attachments created successfully",
      data: {
        documents: createdDocuments.map(doc => ({
          id: doc.id,
          title: doc.title,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize
        })),
        resources: createdResources.map(resource => ({
          id: resource.id,
          title: resource.title,
          resourceType: resource.resourceType,
          visibility: resource.visibility
        }))
      }
    });

  } catch (error) {
    console.error("❌ Failed to create test resources:", error);
    return createResponse(
      { error: "Failed to create test resources" },
      { status: 500 }
    );
  }
}