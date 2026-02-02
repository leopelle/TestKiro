/**
 * URL Matcher Property-Based Tests
 * 
 * Property-based tests using fast-check to verify URL recognition
 * and credential matching correctness.
 * 
 * Feature: password-manager-app
 */

import * as fc from 'fast-check';
import { describe, test, expect } from '@jest/globals';
import {
  findMatchingCredentials,
  isUrlRecognized,
  getBestMatch,
  normalizeUrl,
  calculateMatchConfidence,
} from './url-matcher';
import { PasswordItem } from '../types/vault';

/**
 * Helper function to create a password item for testing
 */
function createPasswordItem(
  id: string,
  title: string,
  url: string,
  username: string = 'user@example.com',
  password: string = 'password123'
): PasswordItem {
  return {
    id,
    type: 'password',
    title,
    username,
    password,
    url,
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
  };
}

/**
 * Arbitrary for generating valid URLs
 */
const validUrlArbitrary = fc.oneof(
  // Simple domains
  fc.record({
    protocol: fc.constantFrom('http', 'https'),
    domain: fc.constantFrom('example.com', 'github.com', 'google.com', 'test.org'),
    path: fc.constantFrom('', '/login', '/signup', '/dashboard', '/api/v1'),
  }).map(({ protocol, domain, path }) => `${protocol}://${domain}${path}`),
  
  // Domains with subdomains
  fc.record({
    protocol: fc.constantFrom('http', 'https'),
    subdomain: fc.constantFrom('www', 'mail', 'api', 'app', 'dev'),
    domain: fc.constantFrom('example.com', 'github.com', 'google.com'),
    path: fc.constantFrom('', '/login', '/home'),
  }).map(({ protocol, subdomain, domain, path }) => `${protocol}://${subdomain}.${domain}${path}`),
  
  // Localhost URLs
  fc.record({
    protocol: fc.constantFrom('http', 'https'),
    port: fc.constantFrom('3000', '8080', '5000', ''),
    path: fc.constantFrom('', '/app', '/admin'),
  }).map(({ protocol, port, path }) => {
    const portPart = port ? `:${port}` : '';
    return `${protocol}://localhost${portPart}${path}`;
  }),
  
  // IP addresses
  fc.record({
    protocol: fc.constantFrom('http', 'https'),
    ip: fc.constantFrom('192.168.1.1', '10.0.0.1', '127.0.0.1'),
    path: fc.constantFrom('', '/admin'),
  }).map(({ protocol, ip, path }) => `${protocol}://${ip}${path}`)
);

/**
 * Arbitrary for generating password items with URLs
 */
const passwordItemWithUrlArbitrary = fc.tuple(
  fc.uuid(),
  fc.string({ minLength: 1, maxLength: 50 }),
  validUrlArbitrary,
  fc.emailAddress(),
  fc.string({ minLength: 8, maxLength: 32 })
).map(([id, title, url, username, password]) => 
  createPasswordItem(id, title, url, username, password)
);

describe('URL Matcher - Property-Based Tests', () => {
  /**
   * Property 16: Riconoscimento URL Autofill
   * 
   * **Validates: Requirements 6.1**
   * 
   * For any URL saved in the vault, the system should recognize it
   * and suggest appropriate credentials when visited.
   * 
   * This property verifies that:
   * 1. Any saved URL is recognized when visited exactly
   * 2. The system suggests the correct credentials for the URL
   * 3. Subdomain variations are properly matched
   * 4. Path variations on the same domain are matched
   * 5. Protocol variations (http/https) don't prevent matching
   */
  describe('Property 16: URL Recognition for Autofill', () => {
    test('should recognize and suggest credentials for any saved URL', () => {
      fc.assert(
        fc.property(
          fc.array(passwordItemWithUrlArbitrary, { minLength: 1, maxLength: 10 }),
          (items) => {
            // For each item in the vault, verify it can be recognized
            for (const item of items) {
              // Property 1: The exact URL should be recognized
              const isRecognized = isUrlRecognized(item.url!, items);
              expect(isRecognized).toBe(true);

              // Property 2: The system should find matching credentials
              const matches = findMatchingCredentials(item.url!, items);
              expect(matches.length).toBeGreaterThan(0);

              // Property 3: The original item should be in the matches
              const foundItem = matches.find(m => m.item.id === item.id);
              expect(foundItem).toBeDefined();
              expect(foundItem?.item.url).toBe(item.url);

              // Property 4: The match should have high confidence (exact match)
              expect(foundItem?.confidence).toBe(1.0);
              expect(foundItem?.exactMatch).toBe(true);

              // Property 5: getBestMatch should return a valid match
              const bestMatch = getBestMatch(item.url!, items);
              expect(bestMatch).not.toBeNull();
              expect(bestMatch?.item.url).toBeDefined();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should recognize URLs with different paths on the same domain', () => {
      fc.assert(
        fc.property(
          fc.record({
            protocol: fc.constantFrom('http', 'https'),
            domain: fc.constantFrom('example.com', 'github.com', 'test.org'),
            savedPath: fc.constantFrom('/login', '/signup', '/home'),
            visitedPath: fc.constantFrom('/dashboard', '/profile', '/settings'),
          }),
          ({ protocol, domain, savedPath, visitedPath }) => {
            const savedUrl = `${protocol}://${domain}${savedPath}`;
            const visitedUrl = `${protocol}://${domain}${visitedPath}`;

            const items = [
              createPasswordItem('1', 'Test Account', savedUrl),
            ];

            // Property: Different paths on same domain should be recognized
            const isRecognized = isUrlRecognized(visitedUrl, items);
            expect(isRecognized).toBe(true);

            const matches = findMatchingCredentials(visitedUrl, items);
            expect(matches.length).toBe(1);
            expect(matches[0]?.confidence).toBe(1.0);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should recognize URLs regardless of protocol (http vs https)', () => {
      fc.assert(
        fc.property(
          fc.record({
            savedProtocol: fc.constantFrom('http', 'https'),
            visitedProtocol: fc.constantFrom('http', 'https'),
            domain: fc.constantFrom('example.com', 'github.com', 'test.org'),
            path: fc.constantFrom('', '/login', '/app'),
          }),
          ({ savedProtocol, visitedProtocol, domain, path }) => {
            const savedUrl = `${savedProtocol}://${domain}${path}`;
            const visitedUrl = `${visitedProtocol}://${domain}${path}`;

            const items = [
              createPasswordItem('1', 'Test Account', savedUrl),
            ];

            // Property: Protocol differences should not prevent recognition
            const isRecognized = isUrlRecognized(visitedUrl, items);
            expect(isRecognized).toBe(true);

            const matches = findMatchingCredentials(visitedUrl, items);
            expect(matches.length).toBe(1);
            expect(matches[0]?.confidence).toBe(1.0);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should recognize subdomain variations of saved URLs', () => {
      fc.assert(
        fc.property(
          fc.record({
            protocol: fc.constantFrom('http', 'https'),
            baseDomain: fc.constantFrom('example.com', 'github.com', 'google.com'),
            savedSubdomain: fc.constantFrom('app', 'api', 'admin'),
            visitedSubdomain: fc.constantFrom('mail', 'dev', 'staging'),
          }),
          ({ protocol, baseDomain, savedSubdomain, visitedSubdomain }) => {
            const savedUrl = `${protocol}://${savedSubdomain}.${baseDomain}`;
            const visitedUrl = `${protocol}://${visitedSubdomain}.${baseDomain}`;

            const items = [
              createPasswordItem('1', 'Test Account', savedUrl),
            ];

            // Property: Different subdomains of same base domain should be recognized
            const isRecognized = isUrlRecognized(visitedUrl, items);
            expect(isRecognized).toBe(true);

            const matches = findMatchingCredentials(visitedUrl, items);
            expect(matches.length).toBe(1);
            
            // Confidence should be 0.8 for different subdomains of same base domain
            // (Note: www is normalized away, so we exclude it from this test)
            expect(matches[0]?.confidence).toBe(0.8);
            expect(matches[0]?.exactMatch).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should recognize base domain when subdomain is visited', () => {
      fc.assert(
        fc.property(
          fc.record({
            protocol: fc.constantFrom('http', 'https'),
            baseDomain: fc.constantFrom('example.com', 'github.com', 'google.com'),
            subdomain: fc.constantFrom('mail', 'api', 'app', 'admin'),
          }),
          ({ protocol, baseDomain, subdomain }) => {
            const savedUrl = `${protocol}://${baseDomain}`;
            const visitedUrl = `${protocol}://${subdomain}.${baseDomain}`;

            const items = [
              createPasswordItem('1', 'Test Account', savedUrl),
            ];

            // Property: Visiting subdomain should recognize base domain credentials
            const isRecognized = isUrlRecognized(visitedUrl, items);
            expect(isRecognized).toBe(true);

            const matches = findMatchingCredentials(visitedUrl, items);
            expect(matches.length).toBe(1);
            
            // Confidence should be 0.6 for subdomain vs base domain
            // (Note: www is normalized away and would give 1.0, so we exclude it)
            expect(matches[0]?.confidence).toBe(0.6);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should handle multiple credentials for the same domain', () => {
      fc.assert(
        fc.property(
          fc.record({
            protocol: fc.constantFrom('http', 'https'),
            domain: fc.constantFrom('example.com', 'github.com'),
            usernames: fc.array(fc.emailAddress(), { minLength: 2, maxLength: 5 }),
          }),
          ({ protocol, domain, usernames }) => {
            const url = `${protocol}://${domain}`;
            
            // Create multiple items for the same URL
            const items = usernames.map((username, index) =>
              createPasswordItem(`${index}`, `Account ${index}`, url, username)
            );

            // Property: All credentials for the same URL should be recognized
            const matches = findMatchingCredentials(url, items);
            expect(matches.length).toBe(items.length);

            // Property: All matches should have exact confidence
            for (const match of matches) {
              expect(match.confidence).toBe(1.0);
              expect(match.exactMatch).toBe(true);
            }

            // Property: getBestMatch should return one of the valid matches
            const bestMatch = getBestMatch(url, items);
            expect(bestMatch).not.toBeNull();
            expect(bestMatch?.confidence).toBe(1.0);
            
            // Verify the best match is actually one of our items
            const foundInItems = items.some(item => item.id === bestMatch?.item.id);
            expect(foundInItems).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should handle URLs with query parameters and fragments', () => {
      fc.assert(
        fc.property(
          fc.record({
            protocol: fc.constantFrom('http', 'https'),
            domain: fc.constantFrom('example.com', 'github.com'),
            path: fc.constantFrom('/login', '/app', '/dashboard'),
            queryParam: fc.constantFrom('?user=123', '?token=abc', '?ref=home'),
            fragment: fc.constantFrom('#section1', '#top', '#main'),
          }),
          ({ protocol, domain, path, queryParam, fragment }) => {
            const baseUrl = `${protocol}://${domain}${path}`;
            const urlWithQuery = `${baseUrl}${queryParam}`;
            const urlWithFragment = `${baseUrl}${fragment}`;
            const urlWithBoth = `${baseUrl}${queryParam}${fragment}`;

            const items = [
              createPasswordItem('1', 'Test Account', baseUrl),
            ];

            // Property: Query parameters and fragments should not prevent recognition
            expect(isUrlRecognized(urlWithQuery, items)).toBe(true);
            expect(isUrlRecognized(urlWithFragment, items)).toBe(true);
            expect(isUrlRecognized(urlWithBoth, items)).toBe(true);

            // All should have exact match confidence
            const matchesQuery = findMatchingCredentials(urlWithQuery, items);
            expect(matchesQuery[0]?.confidence).toBe(1.0);

            const matchesFragment = findMatchingCredentials(urlWithFragment, items);
            expect(matchesFragment[0]?.confidence).toBe(1.0);

            const matchesBoth = findMatchingCredentials(urlWithBoth, items);
            expect(matchesBoth[0]?.confidence).toBe(1.0);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should handle www prefix correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            protocol: fc.constantFrom('http', 'https'),
            domain: fc.constantFrom('example.com', 'github.com', 'test.org'),
            hasWwwSaved: fc.boolean(),
            hasWwwVisited: fc.boolean(),
          }),
          ({ protocol, domain, hasWwwSaved, hasWwwVisited }) => {
            const savedDomain = hasWwwSaved ? `www.${domain}` : domain;
            const visitedDomain = hasWwwVisited ? `www.${domain}` : domain;
            
            const savedUrl = `${protocol}://${savedDomain}`;
            const visitedUrl = `${protocol}://${visitedDomain}`;

            const items = [
              createPasswordItem('1', 'Test Account', savedUrl),
            ];

            // Property: www prefix should not prevent recognition
            const isRecognized = isUrlRecognized(visitedUrl, items);
            expect(isRecognized).toBe(true);

            const matches = findMatchingCredentials(visitedUrl, items);
            expect(matches.length).toBe(1);
            expect(matches[0]?.confidence).toBe(1.0);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should not recognize completely different domains', () => {
      fc.assert(
        fc.property(
          fc.record({
            savedDomain: fc.constantFrom('example.com', 'github.com', 'test.org'),
            visitedDomain: fc.constantFrom('different.com', 'other.net', 'unrelated.io'),
          }).filter(({ savedDomain, visitedDomain }) => {
            // Ensure domains are actually different
            const saved = savedDomain.split('.').slice(-2).join('.');
            const visited = visitedDomain.split('.').slice(-2).join('.');
            return saved !== visited;
          }),
          ({ savedDomain, visitedDomain }) => {
            const savedUrl = `https://${savedDomain}`;
            const visitedUrl = `https://${visitedDomain}`;

            const items = [
              createPasswordItem('1', 'Test Account', savedUrl),
            ];

            // Property: Completely different domains should not be recognized
            const matches = findMatchingCredentials(visitedUrl, items);
            expect(matches.length).toBe(0);

            const isRecognized = isUrlRecognized(visitedUrl, items);
            expect(isRecognized).toBe(false);

            const bestMatch = getBestMatch(visitedUrl, items);
            expect(bestMatch).toBeNull();
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should maintain confidence ordering when multiple matches exist', () => {
      fc.assert(
        fc.property(
          fc.record({
            protocol: fc.constantFrom('http', 'https'),
            baseDomain: fc.constantFrom('example.com', 'github.com'),
          }),
          ({ protocol, baseDomain }) => {
            const visitedUrl = `${protocol}://mail.${baseDomain}`;

            // Create items with different confidence levels
            const items = [
              createPasswordItem('1', 'Exact Match', visitedUrl),
              createPasswordItem('2', 'Base Domain', `${protocol}://${baseDomain}`),
              createPasswordItem('3', 'Other Subdomain', `${protocol}://api.${baseDomain}`),
            ];

            const matches = findMatchingCredentials(visitedUrl, items);

            // Property: Matches should be ordered by confidence (highest first)
            expect(matches.length).toBe(3);
            
            for (let i = 1; i < matches.length; i++) {
              const prevConfidence = matches[i - 1]?.confidence ?? 0;
              const currConfidence = matches[i]?.confidence ?? 0;
              expect(prevConfidence).toBeGreaterThanOrEqual(currConfidence);
            }

            // Property: First match should be the exact match
            expect(matches[0]?.item.id).toBe('1');
            expect(matches[0]?.confidence).toBe(1.0);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Additional property tests for URL normalization
   */
  describe('URL Normalization Properties', () => {
    test('normalizeUrl should handle any valid URL format', () => {
      fc.assert(
        fc.property(validUrlArbitrary, (url) => {
          const normalized = normalizeUrl(url);
          
          // Property: Valid URLs should always normalize successfully
          expect(normalized).not.toBeNull();
          
          if (normalized) {
            // Property: Normalized URL should have all required components
            expect(normalized.protocol).toBeDefined();
            expect(normalized.hostname).toBeDefined();
            expect(normalized.domain).toBeDefined();
            expect(normalized.pathname).toBeDefined();
            
            // Property: Domain should be lowercase
            expect(normalized.domain).toBe(normalized.domain.toLowerCase());
            
            // Property: Hostname should be lowercase
            expect(normalized.hostname).toBe(normalized.hostname.toLowerCase());
          }
        }),
        { numRuns: 10 }
      );
    });

    test('normalizeUrl should be idempotent for valid URLs', () => {
      fc.assert(
        fc.property(validUrlArbitrary, (url) => {
          const normalized1 = normalizeUrl(url);
          
          if (normalized1) {
            // Reconstruct URL from normalized components
            const reconstructed = `${normalized1.protocol}//${normalized1.hostname}${normalized1.pathname}`;
            const normalized2 = normalizeUrl(reconstructed);
            
            // Property: Normalizing twice should give same result
            expect(normalized2).not.toBeNull();
            expect(normalized2?.hostname).toBe(normalized1.hostname);
            expect(normalized2?.domain).toBe(normalized1.domain);
            expect(normalized2?.protocol).toBe(normalized1.protocol);
          }
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Additional property tests for confidence calculation
   */
  describe('Confidence Calculation Properties', () => {
    test('confidence should be symmetric for same domain', () => {
      fc.assert(
        fc.property(validUrlArbitrary, (url) => {
          // Property: Comparing a URL with itself should give confidence 1.0
          const confidence = calculateMatchConfidence(url, url);
          expect(confidence).toBe(1.0);
        }),
        { numRuns: 10 }
      );
    });

    test('confidence should be in range [0, 1]', () => {
      fc.assert(
        fc.property(
          validUrlArbitrary,
          validUrlArbitrary,
          (url1, url2) => {
            const confidence = calculateMatchConfidence(url1, url2);
            
            // Property: Confidence should always be between 0 and 1
            expect(confidence).toBeGreaterThanOrEqual(0);
            expect(confidence).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
