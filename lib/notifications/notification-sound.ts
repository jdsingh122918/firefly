/**
 * Notification Sound Utility
 *
 * Handles playing notification sounds based on user preferences.
 * Uses the Web Audio API for reliable cross-browser sound playback.
 */

import { NotificationType } from "@/lib/types";

// Sound configuration per notification type
const NOTIFICATION_SOUNDS: Record<NotificationType, string | null> = {
  [NotificationType.MESSAGE]: "/sounds/notification-message.mp3",
  [NotificationType.CARE_UPDATE]: "/sounds/notification-care.mp3",
  [NotificationType.FAMILY_ACTIVITY]: "/sounds/notification-family.mp3",
  [NotificationType.SYSTEM_ANNOUNCEMENT]: "/sounds/notification-announcement.mp3",
  [NotificationType.EMERGENCY_ALERT]: "/sounds/notification-emergency.mp3",
};

// Default sound for when no specific sound is configured
const DEFAULT_SOUND = "/sounds/notification-default.mp3";

// Fallback audio data URI for a simple notification sound (sine wave beep)
// This is used when sound files are not available
const FALLBACK_BEEP_DURATION = 150; // ms
const FALLBACK_BEEP_FREQUENCY = 800; // Hz

interface SoundPreferences {
  enabled: boolean;
  volume: number; // 0.0 to 1.0
}

class NotificationSoundManager {
  private audioContext: AudioContext | null = null;
  private loadedSounds: Map<string, AudioBuffer> = new Map();
  private preferences: SoundPreferences = {
    enabled: true,
    volume: 0.5,
  };

  /**
   * Initialize the audio context (must be called after user interaction)
   */
  async initialize(): Promise<void> {
    if (this.audioContext) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Resume context if it's in suspended state
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
    } catch (error) {
      console.warn("🔊 Failed to initialize AudioContext:", error);
    }
  }

  /**
   * Update sound preferences
   */
  setPreferences(preferences: Partial<SoundPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
  }

  /**
   * Get current preferences
   */
  getPreferences(): SoundPreferences {
    return { ...this.preferences };
  }

  /**
   * Load a sound file into memory for faster playback
   */
  async preloadSound(url: string): Promise<void> {
    if (this.loadedSounds.has(url) || !this.audioContext) return;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch sound: ${url}`);

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.loadedSounds.set(url, audioBuffer);
    } catch (error) {
      console.warn(`🔊 Failed to preload sound ${url}:`, error);
    }
  }

  /**
   * Play a notification sound
   */
  async playSound(type: NotificationType): Promise<void> {
    if (!this.preferences.enabled) return;

    // Try to play the specific sound for this notification type
    const soundUrl = NOTIFICATION_SOUNDS[type] || DEFAULT_SOUND;

    try {
      // Try using preloaded sound first
      if (this.audioContext && this.loadedSounds.has(soundUrl)) {
        await this.playPreloadedSound(soundUrl);
        return;
      }

      // Fall back to HTML5 Audio
      await this.playHtmlAudio(soundUrl);
    } catch (error) {
      console.warn(`🔊 Failed to play sound for ${type}:`, error);
      // Fall back to generated beep
      this.playFallbackBeep();
    }
  }

  /**
   * Play a preloaded sound using Web Audio API
   */
  private async playPreloadedSound(url: string): Promise<void> {
    if (!this.audioContext) return;

    const buffer = this.loadedSounds.get(url);
    if (!buffer) return;

    // Resume context if suspended
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    source.buffer = buffer;
    gainNode.gain.value = this.preferences.volume;

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    source.start(0);
  }

  /**
   * Play sound using HTML5 Audio element
   */
  private async playHtmlAudio(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.volume = this.preferences.volume;

      audio.onended = () => resolve();
      audio.onerror = (e) => reject(e);

      audio.play().catch(reject);
    });
  }

  /**
   * Play a generated fallback beep sound
   */
  private playFallbackBeep(): void {
    if (!this.audioContext) {
      this.initialize().then(() => this.playFallbackBeep());
      return;
    }

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = FALLBACK_BEEP_FREQUENCY;

      gainNode.gain.value = this.preferences.volume * 0.3; // Lower volume for beep

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Fade out the beep
      const duration = FALLBACK_BEEP_DURATION / 1000;
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        this.audioContext.currentTime + duration
      );

      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn("🔊 Failed to play fallback beep:", error);
    }
  }

  /**
   * Play a test sound
   */
  async playTestSound(): Promise<void> {
    await this.initialize();
    this.playFallbackBeep();
  }

  /**
   * Check if sound is available in this browser
   */
  isSoundAvailable(): boolean {
    return typeof window !== "undefined" &&
      (typeof AudioContext !== "undefined" || typeof (window as any).webkitAudioContext !== "undefined");
  }
}

// Export singleton instance
export const notificationSound = new NotificationSoundManager();

// Helper hook for React components
export function useNotificationSound() {
  const initializeSound = async () => {
    await notificationSound.initialize();
  };

  const playSound = async (type: NotificationType) => {
    await notificationSound.playSound(type);
  };

  const setPreferences = (preferences: Partial<SoundPreferences>) => {
    notificationSound.setPreferences(preferences);
  };

  const playTestSound = async () => {
    await notificationSound.playTestSound();
  };

  return {
    initializeSound,
    playSound,
    setPreferences,
    playTestSound,
    isSoundAvailable: notificationSound.isSoundAvailable(),
    getPreferences: () => notificationSound.getPreferences(),
  };
}
