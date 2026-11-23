import { getSoundAssetUrl, type SoundSettings } from "../api/sounds";

type SoundInboxItemPayload = {
  category?: "ALERT" | "DEVICE_FEED";
  type?: string;
};

type SoundQueueItem = {
  soundId: string;
  volume: number;
  reason: string;
  requestedAt: number;
};

export type SoundDebugStatus = {
  enabled: boolean;
  unlocked: boolean;
  awaitingUserGesture: boolean;
  preloadedIds: string[];
  queueLength: number;
  lastRequestAt?: number;
  lastPlayAt?: number;
  lastError?: string;
  lastDroppedAt?: number;
};

const MAX_QUEUE_LENGTH = 4;
const PLAYBACK_TIMEOUT_MS = 4000;
const PENDING_SOUND_TTL_MS = 10000;
const DUPLICATE_SOUND_WINDOW_MS = 900;
const RETRY_UNLOCK_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

class SoundPlayer {
  private settings: SoundSettings | null = null;
  private cache = new Map<string, HTMLAudioElement>();
  private queue: SoundQueueItem[] = [];
  private pendingLockedItem: SoundQueueItem | null = null;
  private lastSoundStartedAt = new Map<string, number>();
  private listeners = new Set<(status: SoundDebugStatus) => void>();
  private isPlaying = false;
  private isUnlocking = false;
  private unlocked = false;
  private debugStatus: SoundDebugStatus = {
    enabled: false,
    unlocked: false,
    awaitingUserGesture: false,
    preloadedIds: [],
    queueLength: 0,
  };

  constructor() {
    if (typeof window === "undefined") return;

    RETRY_UNLOCK_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, this.handleUserGesture, { passive: true });
    });
    this.publishDebugStatus();
  }

  getStatus() {
    return { ...this.debugStatus };
  }

  subscribe(listener: (status: SoundDebugStatus) => void) {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  setSettings(settings: SoundSettings | null) {
    this.settings = settings;
    this.debugStatus.enabled = Boolean(settings?.enabled);
    this.debugStatus.unlocked = this.unlocked;
    this.debugStatus.awaitingUserGesture = Boolean(settings?.enabled && !this.unlocked);
    this.preloadConfiguredSounds();
    this.publishDebugStatus();
  }

  playInboxItem(item: SoundInboxItemPayload) {
    const resolved = this.resolveInboxSound(item);
    if (!resolved) return false;

    const queueItem = {
      ...resolved,
      requestedAt: Date.now(),
    };

    this.debugStatus.lastRequestAt = Date.now();

    if (!this.unlocked) {
      this.pendingLockedItem = queueItem;
      this.queue = [];
      this.debugStatus.awaitingUserGesture = true;
      this.debugStatus.queueLength = 1;
      this.debugStatus.lastError = "Waiting for a page click to enable browser audio";
      this.publishDebugStatus();
      return true;
    }

    this.enqueueSound(queueItem);
    return true;
  }

  async enableFromUserGesture() {
    if (!this.settings?.enabled) return false;
    if (this.isUnlocking) return this.unlocked;
    this.isUnlocking = true;
    try {
      await this.unlockConfiguredSounds();
    } finally {
      this.isUnlocking = false;
    }
    if (!this.unlocked) return false;
    this.flushPendingLockedItem();
    return true;
  }

  private resolveInboxSound(item: SoundInboxItemPayload): Omit<SoundQueueItem, "requestedAt"> | null {
    const settings = this.settings;
    if (!settings?.enabled) return null;

    if (item.category === "DEVICE_FEED") {
      if (item.type === "DEVICE_AUTHORIZED" && settings.accessAllowedSoundId) {
        return {
          soundId: settings.accessAllowedSoundId,
          volume: settings.accessAllowedVolume ?? 0.8,
          reason: "device-authorized",
        };
      }
      if (item.type === "DEVICE_DENIED" && settings.accessDeniedSoundId) {
        return {
          soundId: settings.accessDeniedSoundId,
          volume: settings.accessDeniedVolume ?? 0.8,
          reason: "device-denied",
        };
      }
    }

    if (item.category === "ALERT" && settings.alertSoundId) {
      return {
        soundId: settings.alertSoundId,
        volume: settings.alertVolume ?? 0.8,
        reason: "alert",
      };
    }

    return null;
  }

  private preloadConfiguredSounds() {
    const ids = this.getConfiguredSoundIds();
    this.debugStatus.preloadedIds = ids;
    ids.forEach((id) => {
      const audio = this.getAudio(id);
      audio.preload = "auto";
      try {
        audio.load();
      } catch (error) {
        this.recordError("preload", error);
      }
    });
  }

  private getConfiguredSoundIds() {
    const settings = this.settings;
    if (!settings?.enabled) return [];
    return Array.from(
      new Set(
        [settings.accessAllowedSoundId, settings.accessDeniedSoundId, settings.alertSoundId].filter(
          (id): id is string => Boolean(id)
        )
      )
    );
  }

  private getAudio(soundId: string) {
    const src = getSoundAssetUrl(soundId);
    let audio = this.cache.get(soundId);
    if (!audio) {
      audio = new Audio(src);
      audio.preload = "auto";
      this.cache.set(soundId, audio);
      return audio;
    }
    if (audio.src !== src) {
      audio.src = src;
      audio.preload = "auto";
    }
    return audio;
  }

  private enqueueSound(item: SoundQueueItem) {
    const now = Date.now();
    const lastStartedAt = this.lastSoundStartedAt.get(item.soundId) ?? 0;
    if (now - lastStartedAt < DUPLICATE_SOUND_WINDOW_MS) {
      this.debugStatus.lastDroppedAt = now;
      this.publishDebugStatus();
      return;
    }

    if (this.queue.length >= MAX_QUEUE_LENGTH) {
      this.queue.shift();
      this.debugStatus.lastDroppedAt = now;
    }

    this.queue.push(item);
    this.debugStatus.queueLength = this.queue.length;
    this.debugStatus.awaitingUserGesture = false;
    this.publishDebugStatus();
    void this.drainQueue();
  }

  private async drainQueue() {
    if (this.isPlaying || !this.unlocked) return;
    this.isPlaying = true;

    while (this.queue.length) {
      const item = this.queue.shift();
      if (!item) break;
      this.debugStatus.queueLength = this.queue.length;
      this.publishDebugStatus();
      await this.playQueuedItem(item);
    }

    this.isPlaying = false;
    this.debugStatus.queueLength = 0;
    this.publishDebugStatus();
  }

  private async playQueuedItem(item: SoundQueueItem) {
    const audio = this.getAudio(item.soundId);
    audio.volume = Math.max(0, Math.min(1, item.volume));
    audio.muted = false;

    try {
      resetAudioPosition(audio);
      this.lastSoundStartedAt.set(item.soundId, Date.now());
      await audio.play();
      this.unlocked = true;
      this.debugStatus.unlocked = true;
      this.debugStatus.awaitingUserGesture = false;
      this.debugStatus.lastPlayAt = Date.now();
      this.debugStatus.lastError = undefined;
      this.publishDebugStatus();
      await this.waitForPlaybackEnd(audio);
    } catch (error) {
      if (isNotAllowedError(error)) {
        this.unlocked = false;
        this.pendingLockedItem = item;
        this.queue = [];
        this.debugStatus.unlocked = false;
        this.debugStatus.awaitingUserGesture = true;
        this.debugStatus.queueLength = 1;
      }
      this.recordError(item.reason, error);
      await delay(150);
    }
  }

  private waitForPlaybackEnd(audio: HTMLAudioElement) {
    return new Promise<void>((resolve) => {
      let settled = false;
      const cleanup = () => {
        audio.removeEventListener("ended", handleEnd);
        audio.removeEventListener("error", handleError);
        clearTimeout(timer);
      };
      const settle = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const handleEnd = () => settle();
      const handleError = () => settle();
      const timer = setTimeout(settle, PLAYBACK_TIMEOUT_MS);
      audio.addEventListener("ended", handleEnd, { once: true });
      audio.addEventListener("error", handleError, { once: true });
    });
  }

  private handleUserGesture = () => {
    if (this.unlocked || !this.settings?.enabled) return;
    void this.enableFromUserGesture();
  };

  private async unlockConfiguredSounds() {
    const ids = this.getConfiguredSoundIds();
    if (!ids.length) return;

    const audio = this.getAudio(ids[0]);
    const previousVolume = audio.volume;
    const previousMuted = audio.muted;
    try {
      audio.volume = 0;
      audio.muted = true;
      await audio.play();
      audio.pause();
      resetAudioPosition(audio);
      audio.muted = previousMuted;
      audio.volume = previousVolume;
      this.unlocked = true;
      this.debugStatus.unlocked = true;
      this.debugStatus.awaitingUserGesture = false;
      this.debugStatus.lastError = undefined;
      this.publishDebugStatus();
    } catch (error) {
      audio.muted = previousMuted;
      audio.volume = previousVolume;
      this.debugStatus.awaitingUserGesture = true;
      this.recordError("unlock", error);
    }

    if (this.unlocked && typeof window !== "undefined") {
      RETRY_UNLOCK_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, this.handleUserGesture);
      });
    }
  }

  private flushPendingLockedItem() {
    const pending = this.pendingLockedItem;
    this.pendingLockedItem = null;
    if (!pending) {
      this.debugStatus.queueLength = this.queue.length;
      this.publishDebugStatus();
      return;
    }

    if (Date.now() - pending.requestedAt > PENDING_SOUND_TTL_MS) {
      this.debugStatus.queueLength = this.queue.length;
      this.debugStatus.lastDroppedAt = Date.now();
      this.publishDebugStatus();
      return;
    }

    this.enqueueSound(pending);
  }

  private recordError(reason: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.debugStatus.lastError = `${reason}: ${message}`;
    this.debugStatus.unlocked = this.unlocked;
    this.publishDebugStatus();
    if (typeof console !== "undefined") {
      console.warn("[AtlasGym sound]", reason, error);
    }
  }

  private publishDebugStatus() {
    if (typeof window === "undefined") return;
    const target = window as typeof window & {
      __ecsSoundStatus?: SoundDebugStatus;
      __ecsSoundsEnabled?: boolean;
      __ecsSoundLastPlay?: number;
    };
    target.__ecsSoundStatus = { ...this.debugStatus };
    target.__ecsSoundsEnabled = this.debugStatus.enabled;
    if (this.debugStatus.lastPlayAt) {
      target.__ecsSoundLastPlay = this.debugStatus.lastPlayAt;
    }
    this.listeners.forEach((listener) => listener(this.getStatus()));
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resetAudioPosition(audio: HTMLAudioElement) {
  try {
    audio.currentTime = 0;
  } catch {
    // Some browsers reject seeking before metadata is ready. Playback still works from the start.
  }
}

function isNotAllowedError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "NotAllowedError"
    : error instanceof Error && error.name === "NotAllowedError";
}

export const soundPlayer = new SoundPlayer();
