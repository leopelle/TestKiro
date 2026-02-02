/**
 * Clipboard Manager for Password Manager
 * 
 * This module provides secure clipboard management with automatic
 * data wiping after a configurable timeout.
 * 
 * Requirements:
 * - 6.4: Copy to clipboard with auto-deletion after 30 seconds
 */

/**
 * Options for clipboard copy operations
 */
export interface ClipboardOptions {
  /** Whether to automatically wipe the clipboard after timeout */
  readonly autoWipe: boolean;
  /** Timeout in milliseconds before wiping (default: 30000ms = 30 seconds) */
  readonly wipeTimeout?: number;
}

/**
 * Result of a clipboard operation
 */
export interface ClipboardResult {
  /** Whether the operation was successful */
  readonly success: boolean;
  /** Error message if the operation failed */
  readonly error?: string;
  /** Timestamp when the data will be wiped (if autoWipe is enabled) */
  readonly wipeAt?: number;
}

/**
 * Interface for clipboard operations
 * This abstraction allows for different implementations (browser, Node.js, mobile)
 */
export interface ClipboardProvider {
  /** Write text to clipboard */
  writeText(text: string): Promise<void>;
  /** Read text from clipboard */
  readText(): Promise<string>;
  /** Clear clipboard */
  clear(): Promise<void>;
}

/**
 * Default clipboard provider using browser Clipboard API
 */
export class BrowserClipboardProvider implements ClipboardProvider {
  async writeText(text: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error('Clipboard API not available');
    }
  }

  async readText(): Promise<string> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      return await navigator.clipboard.readText();
    }
    throw new Error('Clipboard API not available');
  }

  async clear(): Promise<void> {
    await this.writeText('');
  }
}

/**
 * Mock clipboard provider for testing and environments without clipboard access
 */
export class MockClipboardProvider implements ClipboardProvider {
  private content: string = '';

  async writeText(text: string): Promise<void> {
    this.content = text;
  }

  async readText(): Promise<string> {
    return this.content;
  }

  async clear(): Promise<void> {
    this.content = '';
  }

  /** Get current clipboard content (for testing) */
  getContent(): string {
    return this.content;
  }
}

/**
 * ClipboardManager provides secure clipboard operations with auto-wipe functionality
 * 
 * Requirement 6.4: Manual filling via clipboard with auto-deletion after 30 seconds
 */
export class ClipboardManager {
  private wipeTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly defaultWipeTimeout = 30000; // 30 seconds

  /**
   * Creates a new ClipboardManager instance
   * 
   * @param provider - Clipboard provider implementation
   */
  constructor(private readonly provider: ClipboardProvider) {}

  /**
   * Copies text to clipboard with optional auto-wipe
   * 
   * Requirement 6.4: Copy to clipboard with auto-deletion after 30 seconds
   * 
   * @param text - Text to copy to clipboard
   * @param options - Clipboard options
   * @returns Result of the clipboard operation
   */
  async copyToClipboard(
    text: string,
    options: ClipboardOptions = { autoWipe: true }
  ): Promise<ClipboardResult> {
    try {
      // Validate input
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: 'Cannot copy empty text to clipboard',
        };
      }

      // Write to clipboard
      await this.provider.writeText(text);

      // Set up auto-wipe if enabled
      if (options.autoWipe) {
        const wipeTimeout = options.wipeTimeout ?? this.defaultWipeTimeout;
        const wipeAt = Date.now() + wipeTimeout;

        // Cancel any existing wipe timer for this content
        this.cancelWipeTimer(text);

        // Schedule auto-wipe
        const timer = setTimeout(async () => {
          await this.wipeClipboard(text);
          this.wipeTimers.delete(text);
        }, wipeTimeout);

        this.wipeTimers.set(text, timer);

        return {
          success: true,
          wipeAt,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Wipes the clipboard if it contains the specified text
   * 
   * This ensures we only wipe the clipboard if it still contains
   * the sensitive data we copied, not if the user has copied something else.
   * 
   * @param expectedText - The text we expect to be in the clipboard
   */
  private async wipeClipboard(expectedText: string): Promise<void> {
    try {
      // Check if clipboard still contains our sensitive data
      const currentContent = await this.provider.readText();
      
      // Only wipe if the clipboard still contains the data we copied
      if (currentContent === expectedText) {
        await this.provider.clear();
      }
    } catch (error) {
      // Silently fail - clipboard might not be accessible
      // This is acceptable as it's a security feature, not critical functionality
    }
  }

  /**
   * Cancels a pending wipe timer for specific text
   * 
   * @param text - The text whose wipe timer should be cancelled
   */
  private cancelWipeTimer(text: string): void {
    const timer = this.wipeTimers.get(text);
    if (timer) {
      clearTimeout(timer);
      this.wipeTimers.delete(text);
    }
  }

  /**
   * Manually wipes the clipboard immediately
   * 
   * @returns Result of the wipe operation
   */
  async wipeNow(): Promise<ClipboardResult> {
    try {
      await this.provider.clear();
      
      // Cancel all pending wipe timers
      for (const timer of this.wipeTimers.values()) {
        clearTimeout(timer);
      }
      this.wipeTimers.clear();

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Gets the number of pending wipe timers
   * Useful for testing and monitoring
   * 
   * @returns Number of active wipe timers
   */
  getPendingWipeCount(): number {
    return this.wipeTimers.size;
  }

  /**
   * Cancels all pending wipe timers
   * Should be called when the manager is being destroyed
   */
  destroy(): void {
    for (const timer of this.wipeTimers.values()) {
      clearTimeout(timer);
    }
    this.wipeTimers.clear();
  }
}

/**
 * Creates a ClipboardManager instance with the default browser provider
 * 
 * @returns New ClipboardManager instance
 */
export function createClipboardManager(): ClipboardManager {
  return new ClipboardManager(new BrowserClipboardProvider());
}

/**
 * Creates a ClipboardManager instance with a mock provider for testing
 * 
 * @returns New ClipboardManager instance with mock provider
 */
export function createMockClipboardManager(): {
  manager: ClipboardManager;
  provider: MockClipboardProvider;
} {
  const provider = new MockClipboardProvider();
  const manager = new ClipboardManager(provider);
  return { manager, provider };
}
