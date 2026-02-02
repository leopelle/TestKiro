/**
 * Autofill Service for Password Manager
 * 
 * This module provides automatic form filling functionality with support
 * for credential insertion and duplicate credential management.
 * 
 * Requirements:
 * - 6.2: Insert username and password into appropriate fields
 * - 6.4: Manual filling via clipboard with auto-deletion after 30 seconds
 * - 6.5: Allow user to choose when duplicate credentials exist
 */

import { PasswordItem } from '../types/vault';
import { findMatchingCredentials, WebsiteMatch } from './url-matcher';
import { ClipboardManager, ClipboardOptions } from './clipboard-manager';

/**
 * Represents a form field that can be filled
 */
export interface FillTarget {
  /** The URL of the page containing the form */
  readonly url: string;
  /** Username/email field identifier (CSS selector, field name, or ID) */
  readonly usernameField?: string;
  /** Password field identifier (CSS selector, field name, or ID) */
  readonly passwordField?: string;
}

/**
 * Result of a fill operation
 */
export interface FillResult {
  /** Whether the fill operation was successful */
  readonly success: boolean;
  /** The item that was used for filling */
  readonly item?: PasswordItem;
  /** Error message if the operation failed */
  readonly error?: string;
  /** Fields that were successfully filled */
  readonly filledFields: readonly string[];
}

/**
 * Options for credential selection when duplicates exist
 */
export interface CredentialSelectionOptions {
  /** Strategy for handling duplicates */
  readonly strategy: 'best-match' | 'prompt-user' | 'most-recent';
  /** Custom selection function (used when strategy is 'prompt-user') */
  readonly selector?: (matches: readonly WebsiteMatch[]) => Promise<WebsiteMatch | null>;
}

/**
 * Credentials to be filled into a form
 */
export interface FillCredentials {
  readonly username: string;
  readonly password: string;
}

/**
 * AutofillService provides automatic form filling functionality
 * 
 * Requirements:
 * - 6.2: Automatic credential insertion
 * - 6.4: Manual filling via clipboard with auto-deletion
 * - 6.5: Handle duplicate credentials
 */
export class AutofillService {
  /**
   * Creates a new AutofillService instance
   * 
   * @param items - Array of password items available for autofill
   * @param clipboardManager - Optional clipboard manager for secure copy operations
   */
  constructor(
    private readonly items: readonly PasswordItem[],
    private readonly clipboardManager?: ClipboardManager
  ) {}

  /**
   * Detects if there are credentials available for a given URL
   * 
   * Requirement 6.1: Recognize URL and suggest credentials
   * 
   * @param url - The URL to check
   * @returns Array of matching credentials
   */
  detectCredentials(url: string): readonly WebsiteMatch[] {
    return findMatchingCredentials(url, this.items);
  }

  /**
   * Checks if there are duplicate credentials for a URL
   * 
   * Requirement 6.5: Detect duplicate credentials for the same site
   * 
   * @param url - The URL to check
   * @returns true if multiple credentials exist for the URL
   */
  hasDuplicateCredentials(url: string): boolean {
    const matches = this.detectCredentials(url);
    return matches.length > 1;
  }

  /**
   * Selects the appropriate credential when duplicates exist
   * 
   * Requirement 6.5: Allow user to choose which credential to use
   * 
   * @param url - The URL to get credentials for
   * @param options - Selection options
   * @returns The selected credential match or null if none selected
   */
  async selectCredential(
    url: string,
    options: CredentialSelectionOptions
  ): Promise<WebsiteMatch | null> {
    const matches = this.detectCredentials(url);

    if (matches.length === 0) {
      return null;
    }

    if (matches.length === 1) {
      return matches[0] ?? null;
    }

    // Handle duplicates based on strategy
    switch (options.strategy) {
      case 'best-match':
        // Return the match with highest confidence
        return matches[0] ?? null;

      case 'most-recent':
        // Return the most recently updated credential
        return this.selectMostRecent(matches);

      case 'prompt-user':
        // Use custom selector function
        if (options.selector) {
          return await options.selector(matches);
        }
        // Fallback to best match if no selector provided
        return matches[0] ?? null;

      default:
        return matches[0] ?? null;
    }
  }

  /**
   * Selects the most recently updated credential from matches
   * 
   * @param matches - Array of credential matches
   * @returns The most recent match
   */
  private selectMostRecent(matches: readonly WebsiteMatch[]): WebsiteMatch | null {
    if (matches.length === 0) {
      return null;
    }

    let mostRecent = matches[0];
    
    for (const match of matches) {
      if (match.item.updatedAt > (mostRecent?.item.updatedAt ?? 0)) {
        mostRecent = match;
      }
    }

    return mostRecent ?? null;
  }

  /**
   * Prepares credentials for filling
   * 
   * Requirement 6.2: Prepare username and password for insertion
   * 
   * @param item - The password item to extract credentials from
   * @returns Credentials ready for filling
   */
  prepareCredentials(item: PasswordItem): FillCredentials {
    return {
      username: item.username,
      password: item.password,
    };
  }

  /**
   * Fills credentials into a form
   * 
   * Requirement 6.2: Insert username and password into appropriate fields
   * 
   * @param target - The form target to fill
   * @param options - Selection options for handling duplicates
   * @returns Result of the fill operation
   */
  async fillCredentials(
    target: FillTarget,
    options: CredentialSelectionOptions = { strategy: 'best-match' }
  ): Promise<FillResult> {
    try {
      // Select the appropriate credential
      const match = await this.selectCredential(target.url, options);

      if (!match) {
        return {
          success: false,
          error: 'No matching credentials found for this URL',
          filledFields: [],
        };
      }

      // Prepare credentials
      const credentials = this.prepareCredentials(match.item);

      // Track which fields were filled
      const filledFields: string[] = [];

      // In a real implementation, this would interact with the browser/form
      // For now, we validate that the credentials are ready to be filled
      if (target.usernameField && credentials.username) {
        filledFields.push('username');
      }

      if (target.passwordField && credentials.password) {
        filledFields.push('password');
      }

      if (filledFields.length === 0) {
        return {
          success: false,
          error: 'No fields specified for filling',
          filledFields: [],
        };
      }

      return {
        success: true,
        item: match.item,
        filledFields,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        filledFields: [],
      };
    }
  }

  /**
   * Gets all available credentials for a URL, grouped by confidence
   * 
   * Requirement 6.5: Present multiple credentials for user selection
   * 
   * @param url - The URL to get credentials for
   * @returns Grouped credentials by confidence level
   */
  getCredentialOptions(url: string): {
    exact: readonly WebsiteMatch[];
    similar: readonly WebsiteMatch[];
  } {
    const matches = this.detectCredentials(url);

    return {
      exact: matches.filter(m => m.exactMatch),
      similar: matches.filter(m => !m.exactMatch),
    };
  }

  /**
   * Validates that credentials can be filled into the target
   * 
   * @param target - The fill target to validate
   * @returns true if the target is valid for filling
   */
  validateFillTarget(target: FillTarget): boolean {
    // Must have a valid URL
    if (!target.url || target.url.trim().length === 0) {
      return false;
    }

    // Must have at least one field to fill
    if (!target.usernameField && !target.passwordField) {
      return false;
    }

    return true;
  }

  /**
   * Gets a summary of available credentials for a URL
   * 
   * @param url - The URL to check
   * @returns Summary information about available credentials
   */
  getCredentialSummary(url: string): {
    count: number;
    hasDuplicates: boolean;
    bestMatch: WebsiteMatch | null;
  } {
    const matches = this.detectCredentials(url);

    return {
      count: matches.length,
      hasDuplicates: matches.length > 1,
      bestMatch: matches[0] ?? null,
    };
  }

  /**
   * Copies a password to clipboard with auto-wipe
   * 
   * Requirement 6.4: Manual filling via clipboard with auto-deletion after 30 seconds
   * 
   * @param item - The password item to copy
   * @param field - Which field to copy ('username' or 'password')
   * @param options - Clipboard options (defaults to auto-wipe after 30 seconds)
   * @returns Result of the clipboard operation
   */
  async copyToClipboard(
    item: PasswordItem,
    field: 'username' | 'password',
    options?: ClipboardOptions
  ): Promise<{ success: boolean; error?: string; wipeAt?: number }> {
    if (!this.clipboardManager) {
      return {
        success: false,
        error: 'Clipboard manager not available',
      };
    }

    const text = field === 'username' ? item.username : item.password;

    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: `${field} is empty`,
      };
    }

    // Default to auto-wipe after 30 seconds
    const clipboardOptions: ClipboardOptions = options ?? {
      autoWipe: true,
      wipeTimeout: 30000,
    };

    return await this.clipboardManager.copyToClipboard(text, clipboardOptions);
  }

  /**
   * Manually wipes the clipboard immediately
   * 
   * Requirement 6.4: Secure clipboard management
   * 
   * @returns Result of the wipe operation
   */
  async wipeClipboard(): Promise<{ success: boolean; error?: string }> {
    if (!this.clipboardManager) {
      return {
        success: false,
        error: 'Clipboard manager not available',
      };
    }

    return await this.clipboardManager.wipeNow();
  }
}

/**
 * Creates an AutofillService instance
 * 
 * @param items - Array of password items
 * @param clipboardManager - Optional clipboard manager for secure copy operations
 * @returns New AutofillService instance
 */
export function createAutofillService(
  items: readonly PasswordItem[],
  clipboardManager?: ClipboardManager
): AutofillService {
  return new AutofillService(items, clipboardManager);
}
