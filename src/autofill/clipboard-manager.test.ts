/**
 * Tests for ClipboardManager
 * 
 * Tests secure clipboard operations with auto-wipe functionality
 */

import {
  ClipboardManager,
  MockClipboardProvider,
  createMockClipboardManager,
  createClipboardManager,
} from './clipboard-manager';

describe('ClipboardManager', () => {
  // Helper to wait for a specific time
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  describe('copyToClipboard', () => {
    it('should successfully copy text to clipboard', async () => {
      const { manager, provider } = createMockClipboardManager();

      const result = await manager.copyToClipboard('test-password', {
        autoWipe: false,
      });

      expect(result.success).toBe(true);
      expect(provider.getContent()).toBe('test-password');
    });

    it('should fail when copying empty text', async () => {
      const { manager } = createMockClipboardManager();

      const result = await manager.copyToClipboard('', {
        autoWipe: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot copy empty text to clipboard');
    });

    it('should fail when copying whitespace-only text', async () => {
      const { manager } = createMockClipboardManager();

      const result = await manager.copyToClipboard('   ', {
        autoWipe: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot copy empty text to clipboard');
    });

    it('should copy text with special characters', async () => {
      const { manager, provider } = createMockClipboardManager();
      const specialText = 'p@ss!w0rd#123$%^&*()';

      const result = await manager.copyToClipboard(specialText, {
        autoWipe: false,
      });

      expect(result.success).toBe(true);
      expect(provider.getContent()).toBe(specialText);
    });

    it('should copy text with unicode characters', async () => {
      const { manager, provider } = createMockClipboardManager();
      const unicodeText = 'пароль密码🔒';

      const result = await manager.copyToClipboard(unicodeText, {
        autoWipe: false,
      });

      expect(result.success).toBe(true);
      expect(provider.getContent()).toBe(unicodeText);
    });

    it('should copy multiline text', async () => {
      const { manager, provider } = createMockClipboardManager();
      const multilineText = 'line1\nline2\nline3';

      const result = await manager.copyToClipboard(multilineText, {
        autoWipe: false,
      });

      expect(result.success).toBe(true);
      expect(provider.getContent()).toBe(multilineText);
    });
  });

  describe('auto-wipe functionality', () => {
    it('should enable auto-wipe by default', async () => {
      const { manager } = createMockClipboardManager();

      const result = await manager.copyToClipboard('test-password');

      expect(result.success).toBe(true);
      expect(result.wipeAt).toBeDefined();
      expect(result.wipeAt).toBeGreaterThan(Date.now());
    });

    it('should wipe clipboard after 30 seconds by default', async () => {
      const { manager, provider } = createMockClipboardManager();

      await manager.copyToClipboard('test-password', {
        autoWipe: true,
      });

      expect(provider.getContent()).toBe('test-password');

      // Wait for auto-wipe (30 seconds + small buffer)
      await wait(30100);

      expect(provider.getContent()).toBe('');
    }, 35000); // Increase test timeout

    it('should wipe clipboard after custom timeout', async () => {
      const { manager, provider } = createMockClipboardManager();

      await manager.copyToClipboard('test-password', {
        autoWipe: true,
        wipeTimeout: 100, // 100ms for faster testing
      });

      expect(provider.getContent()).toBe('test-password');

      // Wait for auto-wipe
      await wait(150);

      expect(provider.getContent()).toBe('');
    });

    it('should not wipe clipboard when autoWipe is false', async () => {
      const { manager, provider } = createMockClipboardManager();

      await manager.copyToClipboard('test-password', {
        autoWipe: false,
      });

      expect(provider.getContent()).toBe('test-password');

      // Wait longer than default timeout
      await wait(200);

      // Should still be there
      expect(provider.getContent()).toBe('test-password');
    });

    it('should return correct wipeAt timestamp', async () => {
      const { manager } = createMockClipboardManager();
      const beforeCopy = Date.now();

      const result = await manager.copyToClipboard('test-password', {
        autoWipe: true,
        wipeTimeout: 5000,
      });

      const afterCopy = Date.now();

      expect(result.wipeAt).toBeDefined();
      expect(result.wipeAt).toBeGreaterThanOrEqual(beforeCopy + 5000);
      expect(result.wipeAt).toBeLessThanOrEqual(afterCopy + 5000);
    });

    it('should not wipe if clipboard content has changed', async () => {
      const { manager, provider } = createMockClipboardManager();

      await manager.copyToClipboard('sensitive-password', {
        autoWipe: true,
        wipeTimeout: 100,
      });

      expect(provider.getContent()).toBe('sensitive-password');

      // User copies something else
      await provider.writeText('something-else');

      // Wait for auto-wipe timer
      await wait(150);

      // Should not wipe because content changed
      expect(provider.getContent()).toBe('something-else');
    });

    it('should track multiple pending wipe timers', async () => {
      const { manager } = createMockClipboardManager();

      await manager.copyToClipboard('password1', {
        autoWipe: true,
        wipeTimeout: 1000,
      });

      expect(manager.getPendingWipeCount()).toBe(1);

      await manager.copyToClipboard('password2', {
        autoWipe: true,
        wipeTimeout: 1000,
      });

      expect(manager.getPendingWipeCount()).toBe(2);
    });

    it('should cancel previous timer when copying same text again', async () => {
      const { manager, provider } = createMockClipboardManager();

      await manager.copyToClipboard('test-password', {
        autoWipe: true,
        wipeTimeout: 100,
      });

      expect(manager.getPendingWipeCount()).toBe(1);

      // Copy same text again before first timer expires
      await wait(50);
      await manager.copyToClipboard('test-password', {
        autoWipe: true,
        wipeTimeout: 100,
      });

      // Should still have only 1 timer (old one cancelled)
      expect(manager.getPendingWipeCount()).toBe(1);

      // Wait for first timer (should not wipe)
      await wait(60);
      expect(provider.getContent()).toBe('test-password');

      // Wait for second timer (should wipe)
      await wait(50);
      expect(provider.getContent()).toBe('');
    });
  });

  describe('wipeNow', () => {
    it('should immediately wipe clipboard', async () => {
      const { manager, provider } = createMockClipboardManager();

      await manager.copyToClipboard('test-password', {
        autoWipe: false,
      });

      expect(provider.getContent()).toBe('test-password');

      const result = await manager.wipeNow();

      expect(result.success).toBe(true);
      expect(provider.getContent()).toBe('');
    });

    it('should cancel all pending wipe timers', async () => {
      const { manager, provider } = createMockClipboardManager();

      await manager.copyToClipboard('password1', {
        autoWipe: true,
        wipeTimeout: 1000,
      });

      await manager.copyToClipboard('password2', {
        autoWipe: true,
        wipeTimeout: 1000,
      });

      expect(manager.getPendingWipeCount()).toBe(2);

      await manager.wipeNow();

      expect(manager.getPendingWipeCount()).toBe(0);
      expect(provider.getContent()).toBe('');
    });

    it('should work even when clipboard is already empty', async () => {
      const { manager, provider } = createMockClipboardManager();

      const result = await manager.wipeNow();

      expect(result.success).toBe(true);
      expect(provider.getContent()).toBe('');
    });
  });

  describe('destroy', () => {
    it('should cancel all pending timers', async () => {
      const { manager, provider } = createMockClipboardManager();

      await manager.copyToClipboard('password1', {
        autoWipe: true,
        wipeTimeout: 1000,
      });

      await manager.copyToClipboard('password2', {
        autoWipe: true,
        wipeTimeout: 1000,
      });

      expect(manager.getPendingWipeCount()).toBe(2);

      manager.destroy();

      expect(manager.getPendingWipeCount()).toBe(0);

      // Wait to ensure timers don't fire
      await wait(1100);

      // Clipboard should still have content (timers were cancelled)
      expect(provider.getContent()).toBe('password2');
    });

    it('should be safe to call multiple times', () => {
      const { manager } = createMockClipboardManager();

      expect(() => {
        manager.destroy();
        manager.destroy();
        manager.destroy();
      }).not.toThrow();
    });
  });

  describe('getPendingWipeCount', () => {
    it('should return 0 when no timers are pending', () => {
      const { manager } = createMockClipboardManager();

      expect(manager.getPendingWipeCount()).toBe(0);
    });

    it('should return correct count after copying', async () => {
      const { manager } = createMockClipboardManager();

      await manager.copyToClipboard('password1', {
        autoWipe: true,
        wipeTimeout: 1000,
      });

      expect(manager.getPendingWipeCount()).toBe(1);

      await manager.copyToClipboard('password2', {
        autoWipe: true,
        wipeTimeout: 1000,
      });

      expect(manager.getPendingWipeCount()).toBe(2);
    });

    it('should decrease after timer expires', async () => {
      const { manager } = createMockClipboardManager();

      await manager.copyToClipboard('password', {
        autoWipe: true,
        wipeTimeout: 100,
      });

      expect(manager.getPendingWipeCount()).toBe(1);

      await wait(150);

      expect(manager.getPendingWipeCount()).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle clipboard provider errors gracefully', async () => {
      const errorProvider = {
        writeText: jest.fn().mockRejectedValue(new Error('Clipboard access denied')),
        readText: jest.fn().mockResolvedValue(''),
        clear: jest.fn().mockResolvedValue(undefined),
      };

      const manager = new ClipboardManager(errorProvider);

      const result = await manager.copyToClipboard('test-password', {
        autoWipe: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Clipboard access denied');
    });

    it('should handle wipe errors silently', async () => {
      const errorProvider = {
        writeText: jest.fn().mockResolvedValue(undefined),
        readText: jest.fn().mockRejectedValue(new Error('Cannot read clipboard')),
        clear: jest.fn().mockResolvedValue(undefined),
      };

      const manager = new ClipboardManager(errorProvider);

      // Should not throw even if wipe fails
      await expect(
        manager.copyToClipboard('test-password', {
          autoWipe: true,
          wipeTimeout: 100,
        })
      ).resolves.toBeDefined();

      // Wait for wipe attempt
      await wait(150);

      // Should not throw
      expect(errorProvider.readText).toHaveBeenCalled();
    });

    it('should handle clear errors in wipeNow', async () => {
      const errorProvider = {
        writeText: jest.fn().mockResolvedValue(undefined),
        readText: jest.fn().mockResolvedValue(''),
        clear: jest.fn().mockRejectedValue(new Error('Cannot clear clipboard')),
      };

      const manager = new ClipboardManager(errorProvider);

      const result = await manager.wipeNow();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot clear clipboard');
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid successive copies', async () => {
      const { manager, provider } = createMockClipboardManager();

      await manager.copyToClipboard('password1', {
        autoWipe: true,
        wipeTimeout: 200,
      });

      await manager.copyToClipboard('password2', {
        autoWipe: true,
        wipeTimeout: 200,
      });

      await manager.copyToClipboard('password3', {
        autoWipe: true,
        wipeTimeout: 200,
      });

      expect(provider.getContent()).toBe('password3');
      expect(manager.getPendingWipeCount()).toBe(3);
    });

    it('should handle mix of auto-wipe and manual copies', async () => {
      const { manager, provider } = createMockClipboardManager();

      await manager.copyToClipboard('password1', {
        autoWipe: true,
        wipeTimeout: 100,
      });

      await manager.copyToClipboard('password2', {
        autoWipe: false,
      });

      expect(manager.getPendingWipeCount()).toBe(1);

      await wait(150);

      // password1 timer expired, but password2 is still there
      expect(provider.getContent()).toBe('password2');
    });

    it('should handle long-running application lifecycle', async () => {
      const { manager, provider } = createMockClipboardManager();

      // Copy multiple passwords over time
      await manager.copyToClipboard('password1', {
        autoWipe: true,
        wipeTimeout: 50,
      });

      await wait(60);

      await manager.copyToClipboard('password2', {
        autoWipe: true,
        wipeTimeout: 50,
      });

      await wait(60);

      await manager.copyToClipboard('password3', {
        autoWipe: true,
        wipeTimeout: 50,
      });

      expect(provider.getContent()).toBe('password3');

      await wait(60);

      expect(provider.getContent()).toBe('');
      expect(manager.getPendingWipeCount()).toBe(0);
    });
  });

  describe('createClipboardManager', () => {
    it('should create a manager with browser provider', () => {
      // This will fail in Node.js environment but demonstrates the API
      expect(() => createClipboardManager()).not.toThrow();
    });
  });

  describe('createMockClipboardManager', () => {
    it('should create a manager with mock provider', () => {
      const { manager, provider } = createMockClipboardManager();

      expect(manager).toBeInstanceOf(ClipboardManager);
      expect(provider).toBeInstanceOf(MockClipboardProvider);
    });

    it('should provide access to mock provider for testing', async () => {
      const { manager, provider } = createMockClipboardManager();

      await manager.copyToClipboard('test', { autoWipe: false });

      expect(provider.getContent()).toBe('test');
    });
  });

  describe('edge cases', () => {
    it('should handle very long text', async () => {
      const { manager, provider } = createMockClipboardManager();
      const longText = 'a'.repeat(10000);

      const result = await manager.copyToClipboard(longText, {
        autoWipe: false,
      });

      expect(result.success).toBe(true);
      expect(provider.getContent()).toBe(longText);
    });

    it('should handle zero timeout', async () => {
      const { manager, provider } = createMockClipboardManager();

      await manager.copyToClipboard('test-password', {
        autoWipe: true,
        wipeTimeout: 0,
      });

      // Should wipe immediately
      await wait(10);

      expect(provider.getContent()).toBe('');
    });

    it('should handle very long timeout', async () => {
      const { manager, provider } = createMockClipboardManager();

      const result = await manager.copyToClipboard('test-password', {
        autoWipe: true,
        wipeTimeout: 3600000, // 1 hour
      });

      expect(result.success).toBe(true);
      expect(result.wipeAt).toBeGreaterThan(Date.now() + 3500000);
      expect(provider.getContent()).toBe('test-password');

      // Clean up
      manager.destroy();
    });

    it('should handle concurrent wipe operations', async () => {
      const { manager, provider } = createMockClipboardManager();

      await manager.copyToClipboard('password1', {
        autoWipe: true,
        wipeTimeout: 100,
      });

      await manager.copyToClipboard('password2', {
        autoWipe: true,
        wipeTimeout: 100,
      });

      // Manually wipe while timers are pending
      await manager.wipeNow();

      expect(provider.getContent()).toBe('');
      expect(manager.getPendingWipeCount()).toBe(0);

      // Wait for original timers (should not cause issues)
      await wait(150);

      expect(provider.getContent()).toBe('');
    });
  });
});
