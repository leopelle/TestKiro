/**
 * Autofill module for Password Manager
 * 
 * Provides URL recognition, credential matching, and automatic form filling
 * functionality.
 * 
 * Requirements:
 * - 6.1: URL recognition and credential matching
 * - 6.2: Automatic credential insertion
 * - 6.4: Secure clipboard management with auto-wipe
 * - 6.5: Handle duplicate credentials
 */

export {
  normalizeUrl,
  extractBaseDomain,
  calculateMatchConfidence,
  findMatchingCredentials,
  isUrlRecognized,
  getBestMatch,
  groupMatchesByConfidence,
  type WebsiteMatch,
  type MatchOptions,
} from './url-matcher';

export {
  AutofillService,
  createAutofillService,
  type FillTarget,
  type FillResult,
  type FillCredentials,
  type CredentialSelectionOptions,
} from './autofill-service';

export {
  ClipboardManager,
  BrowserClipboardProvider,
  MockClipboardProvider,
  createClipboardManager,
  createMockClipboardManager,
  type ClipboardProvider,
  type ClipboardOptions,
  type ClipboardResult,
} from './clipboard-manager';
