import { NoteType, NoteVisibility, ResourceContentType, ResourceStatus } from '@prisma/client'
import { mockStore, type MockContent } from '../setup/mock-store'

export function createTestNote(overrides: Partial<Omit<MockContent, 'id' | 'createdAt' | 'updatedAt'>> = {}): MockContent {
  const defaults = {
    contentType: 'NOTE' as const,
    title: `Test Note ${Date.now()}`,
    content: 'Test note content',
    noteType: NoteType.PERSONAL,
    noteVisibility: NoteVisibility.PRIVATE,
    resourceType: null,
    resourceStatus: null,
    createdById: '', // Must be provided
    familyId: null,
  }

  return mockStore.createContent({ ...defaults, ...overrides })
}

export function createTestResource(overrides: Partial<Omit<MockContent, 'id' | 'createdAt' | 'updatedAt'>> = {}): MockContent {
  const defaults = {
    contentType: 'RESOURCE' as const,
    title: `Test Resource ${Date.now()}`,
    content: 'Test resource content',
    noteType: null,
    noteVisibility: null,
    resourceType: ResourceContentType.ARTICLE,
    resourceStatus: ResourceStatus.PUBLISHED,
    createdById: '', // Must be provided
    familyId: null,
  }

  return mockStore.createContent({ ...defaults, ...overrides })
}

