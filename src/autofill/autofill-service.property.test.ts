/**
 * Autofill Service Property-Based Tests
 * 
 * Property-based tests using fast-check to verify autofill correctness
 * and credential filling accuracy.
 * 
 * Feature: password-manager-app
 */

import * as fc from 'fast-check';
import { describe, test, expect } from '@jest/globals';
import { AutofillService, FillTarget } from './autofill-service';
import { PasswordItem } from '../types/vault';

/**
 * Helper function to create a password item for testing
 */
function createPasswordItem(
  id: string,
  title: string,
  username: string,
  password: string,
  url?: string
): PasswordItem {
  const base = {
    id,
    type: 'password' as const,
    title,
    username,
    password,
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
  };

  if (url !== undefined) {
    return { ...base, url };
  }

  return base;
}

/**
 * Arbitrary for generating valid URLs
 */
const validUrlArbitrary = fc.oneof(
  // Simple domains
  fc.record({
    protocol: fc.constantFrom('http', 'https'),
    domain: fc.constantFrom('example.com', 'github.com', 'google.com', 'test.org', 'app.io'),
    path: fc.constantFrom('', '/login', '/signup', '/dashboard', '/app'),
  }).map(({ protocol, domain, path }) => `${protocol}://${domain}${path}`),
  
  // Domains with subdomains
  fc.record({
    protocol: fc.constantFrom('http', 'https'),
    subdomain: fc.constantFrom('www', 'mail', 'api', 'app', 'admin'),
    domain: fc.constantFrom('example.com', 'github.com', 'google.com'),
    path: fc.constantFrom('', '/login', '/home'),
  }).map(({ protocol, subdomain, domain, path }) => `${protocol}://${subdomain}.${domain}${path}`),
  
  // Localhost URLs
  fc.record({
    protocol: fc.constantFrom('http', 'https'),
    port: fc.constantFrom('3000', '8080', '5000'),
    path: fc.constantFrom('', '/app', '/admin'),
  }).map(({ protocol, port, path }) => `${protocol}://localhost:${port}${path}`)
);

/**
 * Arbitrary for generating usernames
 */
const usernameArbitrary = fc.oneof(
  fc.emailAddress(),
  fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length > 0),
  fc.record({
    name: fc.string({ minLength: 3, maxLength: 15 }),
    domain: fc.constantFrom('example.com', 'test.org', 'mail.com'),
  }).map(({ name, domain }) => `${name}@${domain}`)
);

/**
 * Arbitrary for generating passwords
 */
const passwordArbitrary = fc.string({ minLength: 8, maxLength: 32 }).filter(s => s.trim().length >= 8);

/**
 * Arbitrary for generating password items with URLs
 */
const passwordItemWithUrlArbitrary = fc.tuple(
  fc.uuid(),
  fc.string({ minLength: 1, maxLength: 50 }),
  usernameArbitrary,
  passwordArbitrary,
  validUrlArbitrary
).map(([id, title, username, password, url]) => 
  createPasswordItem(id, title, username, password, url)
);

/**
 * Arbitrary for generating fill targets
 */
const fillTargetArbitrary = fc.record({
  url: validUrlArbitrary,
  usernameField: fc.constantFrom('#username', '#email', 'input[name="user"]', '#login-username'),
  passwordField: fc.constantFrom('#password', '#pass', 'input[name="password"]', '#login-password'),
});

describe('Autofill Service - Property-Based Tests', () => {
  /**
   * Property 17: Correttezza Compilazione Automatica
   * 
   * **Validates: Requirements 6.2**
   * 
   * For any confirmed autofill operation, the data inserted into the fields
   * should match exactly the data saved in the vault.
   * 
   * This property verifies that:
   * 1. When credentials are filled, the username matches the vault item exactly
   * 2. When credentials are filled, the password matches the vault item exactly
   * 3. The filled credentials are never modified or corrupted during the fill process
   * 4. Special characters in credentials are preserved exactly
   * 5. Unicode characters in credentials are preserved exactly
   * 6. Empty or whitespace-only credentials are handled correctly
   * 7. The correct credential is selected when multiple matches exist
   */
  describe('Property 17: Autofill Correctness', () => {
    test('filled credentials should match vault data exactly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(passwordItemWithUrlArbitrary, { minLength: 1, maxLength: 10 }),
          fillTargetArbitrary,
          async (items, target) => {
            const service = new AutofillService(items);

            // Find if any item matches the target URL
            const matches = service.detectCredentials(target.url);

            if (matches.length > 0) {
              // Perform autofill
              const result = await service.fillCredentials(target);

              if (result.success && result.item) {
                // Property 1: The filled item should be one of the vault items
                const vaultItem = items.find(item => item.id === result.item!.id);
                expect(vaultItem).toBeDefined();

                // Property 2: Prepare credentials to verify they match
                const preparedCredentials = service.prepareCredentials(result.item);

                // Property 3: Username should match exactly
                expect(preparedCredentials.username).toBe(result.item.username);
                expect(preparedCredentials.username).toBe(vaultItem!.username);

                // Property 4: Password should match exactly
                expect(preparedCredentials.password).toBe(result.item.password);
                expect(preparedCredentials.password).toBe(vaultItem!.password);

                // Property 5: Credentials should not be empty if fields were filled
                if (result.filledFields.includes('username')) {
                  expect(preparedCredentials.username).toBeTruthy();
                }
                if (result.filledFields.includes('password')) {
                  expect(preparedCredentials.password).toBeTruthy();
                }

                // Property 6: The number of filled fields should match what was requested
                const expectedFields = [];
                if (target.usernameField && preparedCredentials.username) {
                  expectedFields.push('username');
                }
                if (target.passwordField && preparedCredentials.password) {
                  expectedFields.push('password');
                }
                expect(result.filledFields.length).toBe(expectedFields.length);
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('credentials with special characters should be preserved exactly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 30 }),
            username: fc.string({ minLength: 3, maxLength: 30 }).map(s => 
              // Add special characters
              `${s}+tag@example.com`
            ),
            password: fc.string({ minLength: 8, maxLength: 20 }).map(s => 
              // Add special characters
              `${s}!@#$%^&*()`
            ),
            url: validUrlArbitrary,
          }),
          async ({ id, title, username, password, url }) => {
            const item = createPasswordItem(id, title, username, password, url);
            const service = new AutofillService([item]);

            const target: FillTarget = {
              url,
              usernameField: '#username',
              passwordField: '#password',
            };

            const result = await service.fillCredentials(target);

            // Property: Special characters should be preserved exactly
            expect(result.success).toBe(true);
            if (result.item) {
              const preparedCredentials = service.prepareCredentials(result.item);
              expect(preparedCredentials.username).toBe(username);
              expect(preparedCredentials.password).toBe(password);
              
              // Verify no character was lost or modified
              expect(preparedCredentials.username.length).toBe(username.length);
              expect(preparedCredentials.password.length).toBe(password.length);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('credentials with unicode characters should be preserved exactly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 30 }),
            username: fc.constantFrom(
              'пользователь@example.com',
              '用户@example.com',
              'ユーザー@example.com',
              'مستخدم@example.com',
              'user🔐@example.com'
            ),
            password: fc.constantFrom(
              'пароль123',
              '密码🔒',
              'パスワード',
              'كلمة السر',
              'p@ssw0rd🔑'
            ),
            url: validUrlArbitrary,
          }),
          async ({ id, title, username, password, url }) => {
            const item = createPasswordItem(id, title, username, password, url);
            const service = new AutofillService([item]);

            const target: FillTarget = {
              url,
              usernameField: '#username',
              passwordField: '#password',
            };

            const result = await service.fillCredentials(target);

            // Property: Unicode characters should be preserved exactly
            expect(result.success).toBe(true);
            if (result.item) {
              const preparedCredentials = service.prepareCredentials(result.item);
              expect(preparedCredentials.username).toBe(username);
              expect(preparedCredentials.password).toBe(password);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('correct credential should be selected when multiple matches exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: validUrlArbitrary,
            credentials: fc.array(
              fc.tuple(
                fc.uuid(),
                fc.string({ minLength: 1, maxLength: 30 }),
                usernameArbitrary,
                passwordArbitrary
              ),
              { minLength: 2, maxLength: 5 }
            ),
          }),
          async ({ url, credentials }) => {
            // Create multiple items for the same URL
            const items = credentials.map(([id, title, username, password]) =>
              createPasswordItem(id, title, username, password, url)
            );

            const service = new AutofillService(items);

            const target: FillTarget = {
              url,
              usernameField: '#username',
              passwordField: '#password',
            };

            // Test with different selection strategies
            const strategies = ['best-match', 'most-recent'] as const;

            for (const strategy of strategies) {
              const result = await service.fillCredentials(target, { strategy });

              // Property: A credential should be successfully selected
              expect(result.success).toBe(true);
              expect(result.item).toBeDefined();

              if (result.item) {
                // Property: The selected item should be one of the vault items
                const vaultItem = items.find(item => item.id === result.item!.id);
                expect(vaultItem).toBeDefined();

                // Property: The filled credentials should match the selected item exactly
                const preparedCredentials = service.prepareCredentials(result.item);
                expect(preparedCredentials.username).toBe(vaultItem!.username);
                expect(preparedCredentials.password).toBe(vaultItem!.password);
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('credentials should match regardless of URL variations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            protocol: fc.constantFrom('http', 'https'),
            domain: fc.constantFrom('example.com', 'github.com', 'test.org'),
            savedPath: fc.constantFrom('/login', '/app', '/home'),
            visitedPath: fc.constantFrom('/dashboard', '/profile', '/settings'),
            username: usernameArbitrary,
            password: passwordArbitrary,
          }),
          async ({ protocol, domain, savedPath, visitedPath, username, password }) => {
            const savedUrl = `${protocol}://${domain}${savedPath}`;
            const visitedUrl = `${protocol}://${domain}${visitedPath}`;

            const item = createPasswordItem('1', 'Test Account', username, password, savedUrl);
            const service = new AutofillService([item]);

            const target: FillTarget = {
              url: visitedUrl,
              usernameField: '#username',
              passwordField: '#password',
            };

            const result = await service.fillCredentials(target);

            // Property: Different paths on same domain should still fill correctly
            expect(result.success).toBe(true);
            if (result.item) {
              const preparedCredentials = service.prepareCredentials(result.item);
              
              // Property: Credentials should match exactly despite URL variation
              expect(preparedCredentials.username).toBe(username);
              expect(preparedCredentials.password).toBe(password);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('prepareCredentials should never modify vault data', () => {
      fc.assert(
        fc.property(
          passwordItemWithUrlArbitrary,
          (item) => {
            const service = new AutofillService([item]);

            // Store original values
            const originalUsername = item.username;
            const originalPassword = item.password;

            // Prepare credentials multiple times
            const prepared1 = service.prepareCredentials(item);
            const prepared2 = service.prepareCredentials(item);
            const prepared3 = service.prepareCredentials(item);

            // Property 1: Prepared credentials should match original exactly
            expect(prepared1.username).toBe(originalUsername);
            expect(prepared1.password).toBe(originalPassword);

            // Property 2: Multiple calls should return identical results
            expect(prepared2.username).toBe(prepared1.username);
            expect(prepared2.password).toBe(prepared1.password);
            expect(prepared3.username).toBe(prepared1.username);
            expect(prepared3.password).toBe(prepared1.password);

            // Property 3: Original vault item should remain unchanged
            expect(item.username).toBe(originalUsername);
            expect(item.password).toBe(originalPassword);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('fillCredentials should handle partial field specifications correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          passwordItemWithUrlArbitrary,
          fc.constantFrom('username-only', 'password-only', 'both'),
          async (item, fieldSpec) => {
            const service = new AutofillService([item]);

            const target = {
              url: item.url!,
              ...(fieldSpec === 'username-only' || fieldSpec === 'both' ? { usernameField: '#username' } : {}),
              ...(fieldSpec === 'password-only' || fieldSpec === 'both' ? { passwordField: '#password' } : {}),
            } as FillTarget;

            const result = await service.fillCredentials(target);

            if (result.success && result.item) {
              const preparedCredentials = service.prepareCredentials(result.item);

              // Property: Only requested fields should be marked as filled
              if (fieldSpec === 'username-only') {
                expect(result.filledFields).toContain('username');
                expect(result.filledFields).not.toContain('password');
                expect(preparedCredentials.username).toBe(item.username);
              } else if (fieldSpec === 'password-only') {
                expect(result.filledFields).toContain('password');
                expect(result.filledFields).not.toContain('username');
                expect(preparedCredentials.password).toBe(item.password);
              } else {
                expect(result.filledFields).toContain('username');
                expect(result.filledFields).toContain('password');
                expect(preparedCredentials.username).toBe(item.username);
                expect(preparedCredentials.password).toBe(item.password);
              }

              // Property: Credentials should still match vault data exactly
              expect(preparedCredentials.username).toBe(item.username);
              expect(preparedCredentials.password).toBe(item.password);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('credentials should be byte-for-byte identical to vault data', () => {
      fc.assert(
        fc.property(
          passwordItemWithUrlArbitrary,
          (item) => {
            const service = new AutofillService([item]);

            const preparedCredentials = service.prepareCredentials(item);

            // Property: Byte-level comparison should be identical
            const usernameBytes = Buffer.from(preparedCredentials.username, 'utf-8');
            const originalUsernameBytes = Buffer.from(item.username, 'utf-8');
            expect(usernameBytes.equals(originalUsernameBytes)).toBe(true);

            const passwordBytes = Buffer.from(preparedCredentials.password, 'utf-8');
            const originalPasswordBytes = Buffer.from(item.password, 'utf-8');
            expect(passwordBytes.equals(originalPasswordBytes)).toBe(true);

            // Property: Length should be identical
            expect(preparedCredentials.username.length).toBe(item.username.length);
            expect(preparedCredentials.password.length).toBe(item.password.length);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('autofill should work correctly with whitespace in credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 30 }),
            username: fc.string({ minLength: 3, maxLength: 20 }).map(s => `  ${s}  `),
            password: fc.string({ minLength: 8, maxLength: 20 }).map(s => `  ${s}  `),
            url: validUrlArbitrary,
          }),
          async ({ id, title, username, password, url }) => {
            const item = createPasswordItem(id, title, username, password, url);
            const service = new AutofillService([item]);

            const target: FillTarget = {
              url,
              usernameField: '#username',
              passwordField: '#password',
            };

            const result = await service.fillCredentials(target);

            // Property: Whitespace should be preserved exactly
            if (result.success && result.item) {
              const preparedCredentials = service.prepareCredentials(result.item);
              expect(preparedCredentials.username).toBe(username);
              expect(preparedCredentials.password).toBe(password);
              
              // Verify leading/trailing whitespace is preserved
              expect(preparedCredentials.username.startsWith('  ')).toBe(true);
              expect(preparedCredentials.username.endsWith('  ')).toBe(true);
              expect(preparedCredentials.password.startsWith('  ')).toBe(true);
              expect(preparedCredentials.password.endsWith('  ')).toBe(true);
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
