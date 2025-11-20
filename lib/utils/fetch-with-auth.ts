/**
 * Authenticated Fetch Utility
 *
 * This utility wraps the native fetch function to automatically include
 * credentials: 'include' for all requests, ensuring Clerk authentication
 * cookies are sent with each API call.
 *
 * This prevents 401 Unauthorized errors that occur when fetch requests
 * are made without proper authentication credentials.
 */

/**
 * Authenticated fetch that automatically includes credentials
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @returns Promise<Response>
 */
export async function fetchWithAuth(
  url: string | URL,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include', // Always include authentication cookies
  });
}

/**
 * Type-safe authenticated fetch with JSON response parsing
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @returns Promise<T> - Parsed JSON response
 */
export async function fetchWithAuthJSON<T = any>(
  url: string | URL,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchWithAuth(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  return response.json();
}

/**
 * Authenticated GET request
 * @param url - The URL to fetch
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export async function getWithAuth(
  url: string | URL,
  options: Omit<RequestInit, 'method'> = {}
): Promise<Response> {
  return fetchWithAuth(url, {
    ...options,
    method: 'GET',
  });
}

/**
 * Authenticated POST request
 * @param url - The URL to post to
 * @param data - Data to send in request body
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export async function postWithAuth(
  url: string | URL,
  data?: any,
  options: Omit<RequestInit, 'method' | 'body'> = {}
): Promise<Response> {
  return fetchWithAuth(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Authenticated PUT request
 * @param url - The URL to put to
 * @param data - Data to send in request body
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export async function putWithAuth(
  url: string | URL,
  data?: any,
  options: Omit<RequestInit, 'method' | 'body'> = {}
): Promise<Response> {
  return fetchWithAuth(url, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Authenticated DELETE request
 * @param url - The URL to delete
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export async function deleteWithAuth(
  url: string | URL,
  options: Omit<RequestInit, 'method'> = {}
): Promise<Response> {
  return fetchWithAuth(url, {
    ...options,
    method: 'DELETE',
  });
}

// Default export for convenience
export default fetchWithAuth;