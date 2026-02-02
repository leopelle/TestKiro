/**
 * Tests for AutofillService
 * 
 * Tests automatic form filling functionality and duplicate credential handling
 */

import { AutofillService, createAutofillService } from './autofill-service';
import { PasswordItem } from '../types/vault';
import { createMockClipboardManager } from './clipboard-manager';

describe('AutofillService', () => {
  // Helper function to create test password items
  function createPasswordItem(
    id: string,
    title: string,
    username: string,
    password: string,
    url?: string,
    updatedAt: number = Date.now()
  ): PasswordItem {
    const base = {
      id,
      type: 'password' as const,
      title,
      username,
      password,
      createdAt: Date.now(),
      updatedAt,
      tags: [],
      history: [],
    };

    if (url !== undefined) {
      return { ...base, url };
    }

    return base;
  }

  describe('detectCredentials', () => {
    it('should detect credentials for exact URL match', () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const matches = service.detectCredentials('https://github.com/login');

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.item.title).toBe('GitHub');
    });

    it('should detect credentials for subdomain match', () => {
      const items = [
        createPasswordItem('1', 'Google', 'user@example.com', 'pass123', 'https://google.com'),
      ];
      const service = new AutofillService(items);

      const matches = service.detectCredentials('https://mail.google.com');

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.item.title).toBe('Google');
    });

    it('should return empty array when no credentials match', () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const matches = service.detectCredentials('https://example.com');

      expect(matches).toEqual([]);
    });

    it('should handle items without URLs', () => {
      const items = [
        createPasswordItem('1', 'Local App', 'user', 'pass123'),
      ];
      const service = new AutofillService(items);

      const matches = service.detectCredentials('https://example.com');

      expect(matches).toEqual([]);
    });
  });

  describe('hasDuplicateCredentials', () => {
    it('should return true when multiple credentials exist for same URL', () => {
      const items = [
        createPasswordItem('1', 'GitHub Work', 'work@example.com', 'pass1', 'https://github.com'),
        createPasswordItem('2', 'GitHub Personal', 'personal@example.com', 'pass2', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const hasDuplicates = service.hasDuplicateCredentials('https://github.com');

      expect(hasDuplicates).toBe(true);
    });

    it('should return false when only one credential exists', () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const hasDuplicates = service.hasDuplicateCredentials('https://github.com');

      expect(hasDuplicates).toBe(false);
    });

    it('should return false when no credentials exist', () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const hasDuplicates = service.hasDuplicateCredentials('https://example.com');

      expect(hasDuplicates).toBe(false);
    });
  });

  describe('selectCredential', () => {
    it('should return null when no credentials match', async () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const selected = await service.selectCredential('https://example.com', {
        strategy: 'best-match',
      });

      expect(selected).toBeNull();
    });

    it('should return single credential when only one matches', async () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const selected = await service.selectCredential('https://github.com', {
        strategy: 'best-match',
      });

      expect(selected).not.toBeNull();
      expect(selected?.item.title).toBe('GitHub');
    });

    it('should select best match when strategy is best-match', async () => {
      const items = [
        createPasswordItem('1', 'GitHub Work', 'work@example.com', 'pass1', 'https://github.com'),
        createPasswordItem('2', 'GitHub Personal', 'personal@example.com', 'pass2', 'https://work.github.com'),
      ];
      const service = new AutofillService(items);

      const selected = await service.selectCredential('https://github.com', {
        strategy: 'best-match',
      });

      expect(selected).not.toBeNull();
      // Should select the exact match (github.com) over subdomain match
      expect(selected?.item.title).toBe('GitHub Work');
    });

    it('should select most recent when strategy is most-recent', async () => {
      const oldDate = Date.now() - 1000000;
      const newDate = Date.now();

      const items = [
        createPasswordItem('1', 'GitHub Old', 'old@example.com', 'pass1', 'https://github.com', oldDate),
        createPasswordItem('2', 'GitHub New', 'new@example.com', 'pass2', 'https://github.com', newDate),
      ];
      const service = new AutofillService(items);

      const selected = await service.selectCredential('https://github.com', {
        strategy: 'most-recent',
      });

      expect(selected).not.toBeNull();
      expect(selected?.item.title).toBe('GitHub New');
    });

    it('should use custom selector when strategy is prompt-user', async () => {
      const items = [
        createPasswordItem('1', 'GitHub Work', 'work@example.com', 'pass1', 'https://github.com'),
        createPasswordItem('2', 'GitHub Personal', 'personal@example.com', 'pass2', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      // Custom selector that selects the last match
      const customSelector = jest.fn(async (matches) => matches[matches.length - 1] ?? null);

      const selected = await service.selectCredential('https://github.com', {
        strategy: 'prompt-user',
        selector: customSelector,
      });

      expect(customSelector).toHaveBeenCalled();
      expect(selected?.item.title).toBe('GitHub Work');
    });

    it('should fallback to best-match when prompt-user has no selector', async () => {
      const items = [
        createPasswordItem('1', 'GitHub Work', 'work@example.com', 'pass1', 'https://github.com'),
        createPasswordItem('2', 'GitHub Personal', 'personal@example.com', 'pass2', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const selected = await service.selectCredential('https://github.com', {
        strategy: 'prompt-user',
      });

      expect(selected).not.toBeNull();
      // Should select first match (alphabetically sorted: Personal comes before Work)
      expect(selected?.item.title).toBe('GitHub Personal');
    });
  });

  describe('prepareCredentials', () => {
    it('should extract username and password from item', () => {
      const item = createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com');
      const service = new AutofillService([item]);

      const credentials = service.prepareCredentials(item);

      expect(credentials.username).toBe('user@example.com');
      expect(credentials.password).toBe('pass123');
    });

    it('should handle items with special characters in credentials', () => {
      const item = createPasswordItem('1', 'Test', 'user+tag@example.com', 'p@ss!w0rd#123', 'https://example.com');
      const service = new AutofillService([item]);

      const credentials = service.prepareCredentials(item);

      expect(credentials.username).toBe('user+tag@example.com');
      expect(credentials.password).toBe('p@ss!w0rd#123');
    });
  });

  describe('fillCredentials', () => {
    it('should successfully fill credentials for matching URL', async () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const result = await service.fillCredentials({
        url: 'https://github.com/login',
        usernameField: '#username',
        passwordField: '#password',
      });

      expect(result.success).toBe(true);
      expect(result.item?.title).toBe('GitHub');
      expect(result.filledFields).toContain('username');
      expect(result.filledFields).toContain('password');
    });

    it('should fail when no matching credentials exist', async () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const result = await service.fillCredentials({
        url: 'https://example.com',
        usernameField: '#username',
        passwordField: '#password',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No matching credentials found for this URL');
      expect(result.filledFields).toEqual([]);
    });

    it('should fail when no fields are specified', async () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const result = await service.fillCredentials({
        url: 'https://github.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No fields specified for filling');
      expect(result.filledFields).toEqual([]);
    });

    it('should fill only username field when password field not specified', async () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const result = await service.fillCredentials({
        url: 'https://github.com',
        usernameField: '#username',
      });

      expect(result.success).toBe(true);
      expect(result.filledFields).toContain('username');
      expect(result.filledFields).not.toContain('password');
    });

    it('should fill only password field when username field not specified', async () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const result = await service.fillCredentials({
        url: 'https://github.com',
        passwordField: '#password',
      });

      expect(result.success).toBe(true);
      expect(result.filledFields).toContain('password');
      expect(result.filledFields).not.toContain('username');
    });

    it('should handle duplicates with best-match strategy', async () => {
      const items = [
        createPasswordItem('1', 'GitHub Work', 'work@example.com', 'pass1', 'https://github.com'),
        createPasswordItem('2', 'GitHub Personal', 'personal@example.com', 'pass2', 'https://work.github.com'),
      ];
      const service = new AutofillService(items);

      const result = await service.fillCredentials(
        {
          url: 'https://github.com',
          usernameField: '#username',
          passwordField: '#password',
        },
        { strategy: 'best-match' }
      );

      expect(result.success).toBe(true);
      expect(result.item?.title).toBe('GitHub Work');
    });

    it('should handle duplicates with most-recent strategy', async () => {
      const oldDate = Date.now() - 1000000;
      const newDate = Date.now();

      const items = [
        createPasswordItem('1', 'GitHub Old', 'old@example.com', 'pass1', 'https://github.com', oldDate),
        createPasswordItem('2', 'GitHub New', 'new@example.com', 'pass2', 'https://github.com', newDate),
      ];
      const service = new AutofillService(items);

      const result = await service.fillCredentials(
        {
          url: 'https://github.com',
          usernameField: '#username',
          passwordField: '#password',
        },
        { strategy: 'most-recent' }
      );

      expect(result.success).toBe(true);
      expect(result.item?.title).toBe('GitHub New');
    });

    it('should handle duplicates with custom selector', async () => {
      const items = [
        createPasswordItem('1', 'GitHub Work', 'work@example.com', 'pass1', 'https://github.com'),
        createPasswordItem('2', 'GitHub Personal', 'personal@example.com', 'pass2', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const result = await service.fillCredentials(
        {
          url: 'https://github.com',
          usernameField: '#username',
          passwordField: '#password',
        },
        {
          strategy: 'prompt-user',
          selector: async (matches) => matches[matches.length - 1] ?? null,
        }
      );

      expect(result.success).toBe(true);
      expect(result.item?.title).toBe('GitHub Work');
    });
  });

  describe('getCredentialOptions', () => {
    it('should group credentials by exact and similar matches', () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user1@example.com', 'pass1', 'https://github.com'),
        createPasswordItem('2', 'GitHub Mail', 'user2@example.com', 'pass2', 'https://mail.github.com'),
      ];
      const service = new AutofillService(items);

      const options = service.getCredentialOptions('https://github.com');

      expect(options.exact.length).toBe(1);
      expect(options.exact[0]?.item.title).toBe('GitHub');
      expect(options.similar.length).toBe(1);
      expect(options.similar[0]?.item.title).toBe('GitHub Mail');
    });

    it('should return empty arrays when no credentials match', () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const options = service.getCredentialOptions('https://example.com');

      expect(options.exact).toEqual([]);
      expect(options.similar).toEqual([]);
    });

    it('should handle all exact matches', () => {
      const items = [
        createPasswordItem('1', 'GitHub Work', 'work@example.com', 'pass1', 'https://github.com'),
        createPasswordItem('2', 'GitHub Personal', 'personal@example.com', 'pass2', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const options = service.getCredentialOptions('https://github.com');

      expect(options.exact.length).toBe(2);
      expect(options.similar.length).toBe(0);
    });
  });

  describe('validateFillTarget', () => {
    it('should return true for valid fill target', () => {
      const service = new AutofillService([]);

      const isValid = service.validateFillTarget({
        url: 'https://github.com',
        usernameField: '#username',
        passwordField: '#password',
      });

      expect(isValid).toBe(true);
    });

    it('should return false when URL is empty', () => {
      const service = new AutofillService([]);

      const isValid = service.validateFillTarget({
        url: '',
        usernameField: '#username',
        passwordField: '#password',
      });

      expect(isValid).toBe(false);
    });

    it('should return false when no fields are specified', () => {
      const service = new AutofillService([]);

      const isValid = service.validateFillTarget({
        url: 'https://github.com',
      });

      expect(isValid).toBe(false);
    });

    it('should return true when only username field is specified', () => {
      const service = new AutofillService([]);

      const isValid = service.validateFillTarget({
        url: 'https://github.com',
        usernameField: '#username',
      });

      expect(isValid).toBe(true);
    });

    it('should return true when only password field is specified', () => {
      const service = new AutofillService([]);

      const isValid = service.validateFillTarget({
        url: 'https://github.com',
        passwordField: '#password',
      });

      expect(isValid).toBe(true);
    });
  });

  describe('getCredentialSummary', () => {
    it('should return correct summary for single credential', () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const summary = service.getCredentialSummary('https://github.com');

      expect(summary.count).toBe(1);
      expect(summary.hasDuplicates).toBe(false);
      expect(summary.bestMatch?.item.title).toBe('GitHub');
    });

    it('should return correct summary for duplicate credentials', () => {
      const items = [
        createPasswordItem('1', 'GitHub Work', 'work@example.com', 'pass1', 'https://github.com'),
        createPasswordItem('2', 'GitHub Personal', 'personal@example.com', 'pass2', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const summary = service.getCredentialSummary('https://github.com');

      expect(summary.count).toBe(2);
      expect(summary.hasDuplicates).toBe(true);
      expect(summary.bestMatch).not.toBeNull();
    });

    it('should return correct summary when no credentials match', () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const summary = service.getCredentialSummary('https://example.com');

      expect(summary.count).toBe(0);
      expect(summary.hasDuplicates).toBe(false);
      expect(summary.bestMatch).toBeNull();
    });
  });

  describe('createAutofillService', () => {
    it('should create a new AutofillService instance', () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];

      const service = createAutofillService(items);

      expect(service).toBeInstanceOf(AutofillService);
    });

    it('should work with empty items array', () => {
      const service = createAutofillService([]);

      expect(service).toBeInstanceOf(AutofillService);
      expect(service.detectCredentials('https://github.com')).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle URLs with different protocols', async () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
      ];
      const service = new AutofillService(items);

      const result = await service.fillCredentials({
        url: 'http://github.com',
        usernameField: '#username',
        passwordField: '#password',
      });

      expect(result.success).toBe(true);
    });

    it('should handle URLs with ports', async () => {
      const items = [
        createPasswordItem('1', 'Local App', 'user@example.com', 'pass123', 'http://localhost:3000'),
      ];
      const service = new AutofillService(items);

      const result = await service.fillCredentials({
        url: 'http://localhost:3000/login',
        usernameField: '#username',
        passwordField: '#password',
      });

      expect(result.success).toBe(true);
    });

    it('should handle URLs with paths', async () => {
      const items = [
        createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com/login'),
      ];
      const service = new AutofillService(items);

      const result = await service.fillCredentials({
        url: 'https://github.com/login',
        usernameField: '#username',
        passwordField: '#password',
      });

      expect(result.success).toBe(true);
    });

    it('should handle empty credentials gracefully', () => {
      const service = new AutofillService([]);

      const summary = service.getCredentialSummary('https://github.com');

      expect(summary.count).toBe(0);
      expect(summary.hasDuplicates).toBe(false);
      expect(summary.bestMatch).toBeNull();
    });
  });

  describe('clipboard integration', () => {
    // Helper to wait for a specific time
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    describe('copyToClipboard', () => {
      it('should copy username to clipboard with auto-wipe', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
        ];
        const { manager, provider } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        const result = await service.copyToClipboard(items[0]!, 'username');

        expect(result.success).toBe(true);
        expect(result.wipeAt).toBeDefined();
        expect(provider.getContent()).toBe('user@example.com');
      });

      it('should copy password to clipboard with auto-wipe', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
        ];
        const { manager, provider } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        const result = await service.copyToClipboard(items[0]!, 'password');

        expect(result.success).toBe(true);
        expect(result.wipeAt).toBeDefined();
        expect(provider.getContent()).toBe('pass123');
      });

      it('should auto-wipe after 30 seconds by default', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
        ];
        const { manager, provider } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        await service.copyToClipboard(items[0]!, 'password');

        expect(provider.getContent()).toBe('pass123');

        // Wait for auto-wipe
        await wait(30100);

        expect(provider.getContent()).toBe('');
      }, 35000);

      it('should support custom wipe timeout', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
        ];
        const { manager, provider } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        await service.copyToClipboard(items[0]!, 'password', {
          autoWipe: true,
          wipeTimeout: 100,
        });

        expect(provider.getContent()).toBe('pass123');

        await wait(150);

        expect(provider.getContent()).toBe('');
      });

      it('should support disabling auto-wipe', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
        ];
        const { manager, provider } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        await service.copyToClipboard(items[0]!, 'password', {
          autoWipe: false,
        });

        expect(provider.getContent()).toBe('pass123');

        await wait(200);

        // Should still be there
        expect(provider.getContent()).toBe('pass123');
      });

      it('should fail when clipboard manager is not available', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
        ];
        const service = new AutofillService(items);

        const result = await service.copyToClipboard(items[0]!, 'password');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Clipboard manager not available');
      });

      it('should fail when username is empty', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', '', 'pass123', 'https://github.com'),
        ];
        const { manager } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        const result = await service.copyToClipboard(items[0]!, 'username');

        expect(result.success).toBe(false);
        expect(result.error).toBe('username is empty');
      });

      it('should fail when password is empty', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', 'user@example.com', '', 'https://github.com'),
        ];
        const { manager } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        const result = await service.copyToClipboard(items[0]!, 'password');

        expect(result.success).toBe(false);
        expect(result.error).toBe('password is empty');
      });

      it('should handle special characters in credentials', async () => {
        const items = [
          createPasswordItem('1', 'Test', 'user+tag@example.com', 'p@ss!w0rd#123', 'https://example.com'),
        ];
        const { manager, provider } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        await service.copyToClipboard(items[0]!, 'username');
        expect(provider.getContent()).toBe('user+tag@example.com');

        await service.copyToClipboard(items[0]!, 'password');
        expect(provider.getContent()).toBe('p@ss!w0rd#123');
      });

      it('should handle unicode characters in credentials', async () => {
        const items = [
          createPasswordItem('1', 'Test', 'пользователь@example.com', '密码🔒', 'https://example.com'),
        ];
        const { manager, provider } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        await service.copyToClipboard(items[0]!, 'username');
        expect(provider.getContent()).toBe('пользователь@example.com');

        await service.copyToClipboard(items[0]!, 'password');
        expect(provider.getContent()).toBe('密码🔒');
      });
    });

    describe('wipeClipboard', () => {
      it('should manually wipe clipboard', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
        ];
        const { manager, provider } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        await service.copyToClipboard(items[0]!, 'password', {
          autoWipe: false,
        });

        expect(provider.getContent()).toBe('pass123');

        const result = await service.wipeClipboard();

        expect(result.success).toBe(true);
        expect(provider.getContent()).toBe('');
      });

      it('should fail when clipboard manager is not available', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
        ];
        const service = new AutofillService(items);

        const result = await service.wipeClipboard();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Clipboard manager not available');
      });

      it('should cancel pending auto-wipe timers', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
        ];
        const { manager, provider } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        await service.copyToClipboard(items[0]!, 'password', {
          autoWipe: true,
          wipeTimeout: 1000,
        });

        expect(manager.getPendingWipeCount()).toBe(1);

        await service.wipeClipboard();

        expect(manager.getPendingWipeCount()).toBe(0);
        expect(provider.getContent()).toBe('');
      });
    });

    describe('integration scenarios', () => {
      it('should support workflow: detect -> copy -> auto-wipe', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
        ];
        const { manager, provider } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        // Detect credentials
        const matches = service.detectCredentials('https://github.com/login');
        expect(matches.length).toBeGreaterThan(0);

        // Copy password
        await service.copyToClipboard(matches[0]!.item, 'password', {
          autoWipe: true,
          wipeTimeout: 100,
        });

        expect(provider.getContent()).toBe('pass123');

        // Wait for auto-wipe
        await wait(150);

        expect(provider.getContent()).toBe('');
      });

      it('should support workflow: copy username -> copy password -> both wipe', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
        ];
        const { manager, provider } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        // Copy username
        await service.copyToClipboard(items[0]!, 'username', {
          autoWipe: true,
          wipeTimeout: 100,
        });

        expect(provider.getContent()).toBe('user@example.com');

        // Copy password (replaces username in clipboard)
        await service.copyToClipboard(items[0]!, 'password', {
          autoWipe: true,
          wipeTimeout: 100,
        });

        expect(provider.getContent()).toBe('pass123');

        // Both should have timers
        expect(manager.getPendingWipeCount()).toBe(2);

        // Wait for auto-wipe
        await wait(150);

        expect(provider.getContent()).toBe('');
        expect(manager.getPendingWipeCount()).toBe(0);
      });

      it('should support workflow: copy -> manual wipe before timeout', async () => {
        const items = [
          createPasswordItem('1', 'GitHub', 'user@example.com', 'pass123', 'https://github.com'),
        ];
        const { manager, provider } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        await service.copyToClipboard(items[0]!, 'password', {
          autoWipe: true,
          wipeTimeout: 1000,
        });

        expect(provider.getContent()).toBe('pass123');

        // Manually wipe before timeout
        await service.wipeClipboard();

        expect(provider.getContent()).toBe('');
        expect(manager.getPendingWipeCount()).toBe(0);
      });

      it('should handle duplicates with clipboard copy', async () => {
        const items = [
          createPasswordItem('1', 'GitHub Work', 'work@example.com', 'pass1', 'https://github.com'),
          createPasswordItem('2', 'GitHub Personal', 'personal@example.com', 'pass2', 'https://github.com'),
        ];
        const { manager, provider } = createMockClipboardManager();
        const service = new AutofillService(items, manager);

        // Detect duplicates
        expect(service.hasDuplicateCredentials('https://github.com')).toBe(true);

        // Select credential
        const selected = await service.selectCredential('https://github.com', {
          strategy: 'best-match',
        });

        expect(selected).not.toBeNull();

        // Copy selected credential
        await service.copyToClipboard(selected!.item, 'password', {
          autoWipe: true,
          wipeTimeout: 100,
        });

        expect(provider.getContent()).toBe('pass2');

        await wait(150);

        expect(provider.getContent()).toBe('');
      });
    });
  });
});
