"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

export interface GracefulFetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isDatabaseError: boolean;
  retryCount: number;
  isUsingFallback: boolean;
  lastUpdated?: Date;
}

export interface GracefulFetchOptions<T> {
  fallbackData?: T;
  maxRetries?: number;
  retryDelayMs?: number;
  enableCache?: boolean;
  cacheKey?: string;
  onError?: (error: Error, isDatabaseError: boolean) => void;
  onFallback?: (data: T) => void;
}

/**
 * Hook for graceful data fetching with database failure handling
 */
export function useGracefulFetch<T>(
  fetcher: () => Promise<T>,
  options: GracefulFetchOptions<T> = {}
) {
  const { getToken } = useAuth();
  const {
    fallbackData,
    maxRetries = 3,
    retryDelayMs = 5000,
    enableCache = false,
    cacheKey,
    onError,
    onFallback
  } = options;

  const [state, setState] = useState<GracefulFetchState<T>>({
    data: fallbackData || null,
    loading: true,
    error: null,
    isDatabaseError: false,
    retryCount: 0,
    isUsingFallback: !!fallbackData,
  });

  // Check if error is database related
  const isDatabaseError = useCallback((error: unknown): boolean => {
    if (!error) return false;
    const errorString = error instanceof Error ? error.message : String(error);

    return [
      'Server selection timeout',
      'No available servers',
      'Connection refused',
      'ENOTFOUND',
      'ECONNREFUSED',
      'MongoServerSelectionError',
      'MongoNetworkError',
      'MongoTimeoutError',
      'InternalError',
      'Can\'t reach database server',
      'Connection timeout',
      'Database connection error',
      'PrismaClientKnownRequestError'
    ].some(pattern => errorString.includes(pattern));
  }, []);

  // Load from cache
  const loadFromCache = useCallback((): T | null => {
    if (!enableCache || !cacheKey || typeof window === 'undefined') {
      return null;
    }

    try {
      const cached = localStorage.getItem(`firefly_cache_${cacheKey}`);
      if (!cached) return null;

      const parsedCache = JSON.parse(cached);

      // Check if cache is still fresh (10 minutes)
      const cacheTime = new Date(parsedCache._timestamp);
      const now = new Date();
      const tenMinutes = 10 * 60 * 1000;

      if (now.getTime() - cacheTime.getTime() > tenMinutes) {
        localStorage.removeItem(`firefly_cache_${cacheKey}`);
        return null;
      }

      return parsedCache.data;
    } catch {
      return null;
    }
  }, [enableCache, cacheKey]);

  // Save to cache
  const saveToCache = useCallback((data: T): void => {
    if (!enableCache || !cacheKey || typeof window === 'undefined') {
      return;
    }

    try {
      const cacheData = {
        data,
        _timestamp: new Date().toISOString(),
      };
      localStorage.setItem(`firefly_cache_${cacheKey}`, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save to cache:', error);
    }
  }, [enableCache, cacheKey]);

  // Perform fetch with error handling
  const performFetch = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Check auth token availability
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Execute the fetcher
      const data = await fetcher();

      // Success: update state and cache
      setState(prev => ({
        ...prev,
        data,
        loading: false,
        error: null,
        isDatabaseError: false,
        isUsingFallback: false,
        lastUpdated: new Date(),
        retryCount: 0, // Reset retry count on success
      }));

      // Save to cache if enabled
      saveToCache(data);

      return data;

    } catch (error) {
      console.error('Fetch error:', error);

      const isDbError = isDatabaseError(error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Call error callback
      onError?.(error instanceof Error ? error : new Error(errorMessage), isDbError);

      // For database errors, try to use cached or fallback data
      if (isDbError) {
        const cachedData = loadFromCache();
        const fallback = cachedData || fallbackData;

        if (fallback) {
          console.warn('Using fallback data due to database error');
          onFallback?.(fallback);

          setState(prev => ({
            ...prev,
            data: fallback,
            loading: false,
            error: `Database unavailable: ${errorMessage}`,
            isDatabaseError: true,
            isUsingFallback: true,
            lastUpdated: cachedData ? new Date() : undefined,
          }));

          return fallback;
        }
      }

      // Set error state
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        isDatabaseError: isDbError,
        retryCount: prev.retryCount + 1,
      }));

      throw error;
    }
  }, [fetcher, getToken, isDatabaseError, loadFromCache, saveToCache, fallbackData, onError, onFallback]);

  // Retry function
  const retry = useCallback(() => {
    setState(prev => {
      if (prev.retryCount >= maxRetries) {
        console.warn(`Max retries (${maxRetries}) reached`);
        return prev;
      }
      return { ...prev, retryCount: prev.retryCount + 1 };
    });

    performFetch().catch(() => {
      // Error already handled in performFetch
    });
  }, [performFetch, maxRetries]);

  // Auto-retry for database errors
  useEffect(() => {
    if (state.isDatabaseError && state.retryCount < maxRetries) {
      const timeoutId = setTimeout(() => {
        retry();
      }, retryDelayMs);

      return () => clearTimeout(timeoutId);
    }
  }, [state.isDatabaseError, state.retryCount, maxRetries, retryDelayMs, retry]);

  // Initial fetch
  useEffect(() => {
    performFetch().catch(() => {
      // Error already handled in performFetch
    });
  }, []); // Only run once on mount

  return {
    ...state,
    retry,
    refetch: performFetch,
  };
}

/**
 * Hook for graceful API calls with authentication
 */
export function useGracefulApi<T>(
  endpoint: string,
  options: GracefulFetchOptions<T> & {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
  } = {}
) {
  const { getToken } = useAuth();
  const {
    method = 'GET',
    body,
    headers = {},
    ...fetchOptions
  } = options;

  const fetcher = useCallback(async (): Promise<T> => {
    const token = await getToken();
    if (!token) {
      throw new Error('Authentication token not available');
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }, [endpoint, method, body, headers, getToken]);

  return useGracefulFetch(fetcher, {
    ...fetchOptions,
    cacheKey: fetchOptions.cacheKey || `api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`,
  });
}