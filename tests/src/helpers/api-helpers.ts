import { mockStore } from '../setup/mock-store'
import { getMockAuthHeaders } from '../setup/auth'
import { UserRole } from '@prisma/client'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

export async function apiRequest(
  method: string,
  path: string,
  data?: any,
  role: UserRole = UserRole.ADMIN
): Promise<Response> {
  const headers = getMockAuthHeaders(role)
  headers['Content-Type'] = 'application/json'

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`
  
  const options: RequestInit = {
    method,
    headers,
  }

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(data)
  }

  return fetch(url, options)
}

export async function createMockEntity(type: string, data: any): Promise<any> {
  switch (type) {
    case 'user':
      return mockStore.createUser(data)
    case 'family':
      return mockStore.createFamily(data)
    case 'content':
      return mockStore.createContent(data)
    case 'forum':
      return mockStore.createForum(data)
    case 'post':
      return mockStore.createPost(data)
    case 'conversation':
      return mockStore.createConversation(data)
    case 'message':
      return mockStore.createMessage(data)
    case 'assignment':
      return mockStore.createAssignment(data)
    case 'notification':
      return mockStore.createNotification(data)
    default:
      throw new Error(`Unknown entity type: ${type}`)
  }
}

export async function deleteMockEntity(type: string, id: string): Promise<boolean> {
  switch (type) {
    case 'user':
      return mockStore.deleteUser(id)
    case 'family':
      return mockStore.deleteFamily(id)
    case 'content':
      return mockStore.deleteContent(id)
    default:
      throw new Error(`Unknown entity type: ${type}`)
  }
}

export async function getMockEntity(type: string, id: string): Promise<any> {
  switch (type) {
    case 'user':
      return mockStore.getUser(id)
    case 'family':
      return mockStore.getFamily(id)
    case 'content':
      return mockStore.getContent(id)
    case 'forum':
      return mockStore.getForum(id)
    case 'post':
      return mockStore.getPost(id)
    case 'conversation':
      return mockStore.getConversation(id)
    case 'message':
      return mockStore.getMessage(id)
    case 'assignment':
      return mockStore.getAssignment(id)
    case 'notification':
      return mockStore.getNotification(id)
    default:
      throw new Error(`Unknown entity type: ${type}`)
  }
}

