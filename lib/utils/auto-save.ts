/**
 * Auto-Save Utility with LocalStorage Backup
 *
 * Provides automatic saving of form data with fallback to LocalStorage
 * for data persistence and recovery in case of network failures.
 *
 * Features:
 * - Automatic save every 30 seconds
 * - LocalStorage backup for offline recovery
 * - Conflict resolution for concurrent edits
 * - Save status tracking and visual feedback
 */

export interface AutoSaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
  lastSaved?: Date;
  error?: string;
}

export interface AutoSaveData {
  contentId: string;
  userId: string;
  formData: any;
  timestamp: number;
  version: number;
}

export interface AutoSaveConfig {
  interval?: number; // milliseconds, default 30000 (30 seconds)
  storageKey?: string;
  onSave: (data: any) => Promise<void>;
  onError?: (error: Error) => void;
  onConflict?: (localData: AutoSaveData, serverData: any) => Promise<AutoSaveData>;
}

export class AutoSaveManager {
  private intervalId: NodeJS.Timeout | null = null;
  private hasUnsavedChanges = false;
  private currentData: any = null;
  private lastSavedData: any = null;
  private config: Required<AutoSaveConfig>;
  private status: AutoSaveStatus = { status: 'idle' };
  private statusCallbacks: Set<(status: AutoSaveStatus) => void> = new Set();
  private version = 1;

  constructor(config: AutoSaveConfig) {
    this.config = {
      interval: 30000, // 30 seconds
      storageKey: 'auto-save-data',
      onError: () => {},
      onConflict: this.defaultConflictResolver,
      ...config
    };
  }

  /**
   * Initialize auto-save with initial data
   */
  initialize(initialData: any): void {
    this.currentData = initialData;
    this.lastSavedData = JSON.parse(JSON.stringify(initialData));
    this.loadFromLocalStorage();
    this.startAutoSave();
  }

  /**
   * Update form data and mark as having unsaved changes
   */
  updateData(data: any): void {
    this.currentData = data;
    this.hasUnsavedChanges = !this.isDataEqual(data, this.lastSavedData);

    // Save to localStorage immediately for backup
    this.saveToLocalStorage(data);

    // Update status if we have changes
    if (this.hasUnsavedChanges && this.status.status === 'idle') {
      this.updateStatus({ status: 'idle' });
    }
  }

  /**
   * Manually trigger save
   */
  async save(): Promise<void> {
    if (!this.hasUnsavedChanges) return;

    this.updateStatus({ status: 'saving' });

    try {
      await this.config.onSave(this.currentData);
      this.lastSavedData = JSON.parse(JSON.stringify(this.currentData));
      this.hasUnsavedChanges = false;
      this.version++;

      this.updateStatus({
        status: 'saved',
        lastSaved: new Date()
      });

      // Clear localStorage after successful save
      this.clearLocalStorage();

    } catch (error) {
      this.updateStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Save failed'
      });
      this.config.onError(error instanceof Error ? error : new Error('Save failed'));
    }
  }

  /**
   * Start automatic saving
   */
  private startAutoSave(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(async () => {
      if (this.hasUnsavedChanges) {
        await this.save();
      }
    }, this.config.interval);
  }

  /**
   * Stop automatic saving
   */
  stopAutoSave(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: AutoSaveStatus) => void): () => void {
    this.statusCallbacks.add(callback);
    // Send current status immediately
    callback(this.status);

    // Return unsubscribe function
    return () => {
      this.statusCallbacks.delete(callback);
    };
  }

  /**
   * Get current status
   */
  getStatus(): AutoSaveStatus {
    return { ...this.status };
  }

  /**
   * Check if there are unsaved changes
   */
  getHasUnsavedChanges(): boolean {
    return this.hasUnsavedChanges;
  }

  /**
   * Check if there's data in localStorage (recovery available)
   */
  hasLocalStorageBackup(): boolean {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      return stored !== null && stored !== 'null';
    } catch {
      return false;
    }
  }

  /**
   * Get data from localStorage for recovery
   */
  getLocalStorageData(): AutoSaveData | null {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Clear localStorage backup
   */
  clearLocalStorage(): void {
    try {
      localStorage.removeItem(this.config.storageKey);
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Save data to localStorage as backup
   */
  private saveToLocalStorage(data: any): void {
    try {
      const autoSaveData: AutoSaveData = {
        contentId: this.getContentId(data),
        userId: this.getUserId(data),
        formData: data,
        timestamp: Date.now(),
        version: this.version
      };
      localStorage.setItem(this.config.storageKey, JSON.stringify(autoSaveData));
    } catch {
      // Ignore localStorage errors (storage might be full or disabled)
    }
  }

  /**
   * Load data from localStorage and check for conflicts
   */
  private loadFromLocalStorage(): void {
    const stored = this.getLocalStorageData();
    if (!stored) return;

    // Check if stored data is newer than current data
    const storedTime = new Date(stored.timestamp);
    const now = new Date();
    const ageMinutes = (now.getTime() - storedTime.getTime()) / (1000 * 60);

    // If data is less than 1 hour old and different from current, potential recovery
    if (ageMinutes < 60 && !this.isDataEqual(stored.formData, this.currentData)) {
      // Trigger conflict resolution
      this.handlePotentialConflict(stored);
    }
  }

  /**
   * Handle potential data conflicts
   */
  private async handlePotentialConflict(localData: AutoSaveData): Promise<void> {
    try {
      this.updateStatus({ status: 'conflict' });
      const resolvedData = await this.config.onConflict(localData, this.currentData);

      if (resolvedData && !this.isDataEqual(resolvedData.formData, this.currentData)) {
        this.currentData = resolvedData.formData;
        this.hasUnsavedChanges = true;
        this.updateStatus({ status: 'idle' });
      } else {
        this.updateStatus({ status: 'idle' });
      }
    } catch (error) {
      this.config.onError(error instanceof Error ? error : new Error('Conflict resolution failed'));
      this.updateStatus({ status: 'idle' });
    }
  }

  /**
   * Default conflict resolver - prefer local storage (user's latest work)
   */
  private defaultConflictResolver = async (localData: AutoSaveData, serverData: any): Promise<AutoSaveData> => {
    // Simple strategy: prefer local storage data as it represents user's latest work
    return localData;
  };

  /**
   * Update status and notify subscribers
   */
  private updateStatus(newStatus: Partial<AutoSaveStatus>): void {
    this.status = { ...this.status, ...newStatus };
    this.statusCallbacks.forEach(callback => callback(this.status));
  }

  /**
   * Deep equality check for data comparison
   */
  private isDataEqual(data1: any, data2: any): boolean {
    return JSON.stringify(data1) === JSON.stringify(data2);
  }

  /**
   * Extract content ID from data (fallback to empty string)
   */
  private getContentId(data: any): string {
    return data?.contentId || data?.id || '';
  }

  /**
   * Extract user ID from data (fallback to empty string)
   */
  private getUserId(data: any): string {
    return data?.userId || '';
  }

  /**
   * Cleanup when component unmounts
   */
  destroy(): void {
    this.stopAutoSave();
    this.statusCallbacks.clear();
  }
}

/**
 * React hook for using auto-save functionality
 */
export function useAutoSave(config: AutoSaveConfig) {
  const [manager] = useState(() => new AutoSaveManager(config));
  const [status, setStatus] = useState<AutoSaveStatus>({ status: 'idle' });

  useEffect(() => {
    const unsubscribe = manager.onStatusChange(setStatus);
    return () => {
      unsubscribe();
      manager.destroy();
    };
  }, [manager]);

  return {
    initialize: manager.initialize.bind(manager),
    updateData: manager.updateData.bind(manager),
    save: manager.save.bind(manager),
    status,
    hasUnsavedChanges: manager.getHasUnsavedChanges(),
    hasBackup: manager.hasLocalStorageBackup(),
    getBackupData: manager.getLocalStorageData.bind(manager),
    clearBackup: manager.clearLocalStorage.bind(manager)
  };
}

// React import for the hook (will be added when we modify the form component)
import { useState, useEffect } from 'react';