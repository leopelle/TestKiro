/**
 * Tests for URL Matcher
 * 
 * Requirements: 6.1 - URL recognition and credential matching
 */

import { describe, test, expect } from '@jest/globals';
import {
  normalizeUrl,
  extractBaseDomain,
  calculateMatchConfidence,
  findMatchingCredentials,
  isUrlRecognized,
  getBestMatch,
  groupMatchesByConfidence,
  type MatchOptions,
} from './url-matcher';
import { PasswordItem } from '../types/vault';

// Helper function to create test password items
function createPasswordItem(
  id: string,
  title: string,
  url: string | undefined,
  username: string = 'user@example.com',
  password: string = 'password123'
): PasswordItem {
  const item: PasswordItem = {
    id,
    type: 'password',
    title,
    username,
    password,
    history: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
  };
  
  if (url !== undefined) {
    return { ...item, url };
  }
  
  return item;
}

describe('URL Matcher', () => {
  describe('normalizeUrl', () => {
    test('should normalize a complete URL', () => {
      const result = normalizeUrl('https://www.example.com/path');
      expect(result).not.toBeNull();
      expect(result?.protocol).toBe('https:');
      expect(result?.hostname).toBe('www.example.com');
      expect(result?.domain).toBe('example.com');
      expect(result?.pathname).toBe('/path');
    });

    test('should add https protocol to URLs without protocol', () => {
      const result = normalizeUrl('example.com');
      expect(result).not.toBeNull();
      expect(result?.protocol).toBe('https:');
      expect(result?.hostname).toBe('example.com');
    });

    test('should remove www prefix from domain', () => {
      const result = normalizeUrl('https://www.example.com');
      expect(result).not.toBeNull();
      expect(result?.domain).toBe('example.com');
      expect(result?.hostname).toBe('www.example.com');
    });

    test('should handle URLs with ports', () => {
      const result = normalizeUrl('https://example.com:8080/path');
      expect(result).not.toBeNull();
      expect(result?.port).toBe('8080');
    });

    test('should return null for invalid URLs', () => {
      expect(normalizeUrl('not a url')).toBeNull();
      expect(normalizeUrl('')).toBeNull();
      expect(normalizeUrl('   ')).toBeNull();
    });

    test('should handle URLs with subdomains', () => {
      const result = normalizeUrl('https://mail.google.com');
      expect(result).not.toBeNull();
      expect(result?.hostname).toBe('mail.google.com');
      expect(result?.domain).toBe('mail.google.com');
    });
  });

  describe('extractBaseDomain', () => {
    test('should extract base domain from simple hostname', () => {
      expect(extractBaseDomain('example.com')).toBe('example.com');
      expect(extractBaseDomain('google.com')).toBe('google.com');
    });

    test('should extract base domain from subdomain', () => {
      expect(extractBaseDomain('mail.google.com')).toBe('google.com');
      expect(extractBaseDomain('www.example.com')).toBe('example.com');
      expect(extractBaseDomain('api.github.com')).toBe('github.com');
    });

    test('should handle multi-part TLDs', () => {
      expect(extractBaseDomain('example.co.uk')).toBe('example.co.uk');
      expect(extractBaseDomain('mail.example.co.uk')).toBe('example.co.uk');
      expect(extractBaseDomain('example.com.au')).toBe('example.com.au');
    });

    test('should handle single-part hostnames', () => {
      expect(extractBaseDomain('localhost')).toBe('localhost');
    });
  });

  describe('calculateMatchConfidence', () => {
    test('should return 1.0 for exact hostname match', () => {
      const confidence = calculateMatchConfidence(
        'https://example.com/login',
        'https://example.com/signup'
      );
      expect(confidence).toBe(1.0);
    });

    test('should return 0.8 for same base domain with different subdomains', () => {
      const confidence = calculateMatchConfidence(
        'https://mail.google.com',
        'https://drive.google.com'
      );
      expect(confidence).toBe(0.8);
    });

    test('should return 0.6 for subdomain match', () => {
      const confidence = calculateMatchConfidence(
        'https://mail.google.com',
        'https://google.com'
      );
      expect(confidence).toBe(0.6);
    });

    test('should return 0 for completely different domains', () => {
      const confidence = calculateMatchConfidence(
        'https://example.com',
        'https://different.com'
      );
      expect(confidence).toBe(0);
    });

    test('should respect includeSubdomains option', () => {
      const options: MatchOptions = { includeSubdomains: false };
      
      const confidence1 = calculateMatchConfidence(
        'https://mail.google.com',
        'https://drive.google.com',
        options
      );
      expect(confidence1).toBe(0.3);

      const confidence2 = calculateMatchConfidence(
        'https://mail.google.com',
        'https://google.com',
        options
      );
      expect(confidence2).toBe(0.2);
    });

    test('should handle URLs without protocol', () => {
      const confidence = calculateMatchConfidence(
        'example.com',
        'https://example.com'
      );
      expect(confidence).toBe(1.0);
    });

    test('should handle www prefix correctly', () => {
      const confidence = calculateMatchConfidence(
        'https://www.example.com',
        'https://example.com'
      );
      expect(confidence).toBe(1.0);
    });
  });

  describe('findMatchingCredentials', () => {
    const items: PasswordItem[] = [
      createPasswordItem('1', 'Example Login', 'https://example.com'),
      createPasswordItem('2', 'Google Mail', 'https://mail.google.com'),
      createPasswordItem('3', 'Google Drive', 'https://drive.google.com'),
      createPasswordItem('4', 'GitHub', 'https://github.com'),
      createPasswordItem('5', 'No URL Item', undefined),
    ];

    test('should find exact matches', () => {
      const matches = findMatchingCredentials('https://example.com', items);
      expect(matches.length).toBe(1);
      expect(matches[0]?.item.title).toBe('Example Login');
      expect(matches[0]?.exactMatch).toBe(true);
      expect(matches[0]?.confidence).toBe(1.0);
    });

    test('should find multiple matches for same base domain', () => {
      const matches = findMatchingCredentials('https://accounts.google.com', items);
      expect(matches.length).toBe(2);
      expect(matches[0]?.item.title).toMatch(/Google/);
      expect(matches[1]?.item.title).toMatch(/Google/);
    });

    test('should sort matches by confidence', () => {
      const matches = findMatchingCredentials('https://mail.google.com', items);
      expect(matches.length).toBeGreaterThan(0);
      
      // First match should be exact or highest confidence
      for (let i = 1; i < matches.length; i++) {
        const prev = matches[i - 1];
        const curr = matches[i];
        if (prev && curr) {
          expect(prev.confidence).toBeGreaterThanOrEqual(curr.confidence);
        }
      }
    });

    test('should respect minimum confidence threshold', () => {
      const options: MatchOptions = { minConfidence: 0.9 };
      const matches = findMatchingCredentials('https://accounts.google.com', items, options);
      
      // Should only include high-confidence matches
      matches.forEach(match => {
        expect(match.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    test('should skip items without URLs', () => {
      const matches = findMatchingCredentials('https://example.com', items);
      
      // Should not include the item without URL
      matches.forEach(match => {
        expect(match.item.url).toBeDefined();
      });
    });

    test('should return empty array when no matches found', () => {
      const matches = findMatchingCredentials('https://nomatch.com', items);
      expect(matches).toEqual([]);
    });

    test('should handle empty items array', () => {
      const matches = findMatchingCredentials('https://example.com', []);
      expect(matches).toEqual([]);
    });
  });

  describe('isUrlRecognized', () => {
    const items: PasswordItem[] = [
      createPasswordItem('1', 'Example', 'https://example.com'),
      createPasswordItem('2', 'GitHub', 'https://github.com'),
    ];

    test('should return true for recognized URLs', () => {
      expect(isUrlRecognized('https://example.com', items)).toBe(true);
      expect(isUrlRecognized('https://github.com', items)).toBe(true);
    });

    test('should return false for unrecognized URLs', () => {
      expect(isUrlRecognized('https://unknown.com', items)).toBe(false);
    });

    test('should return true for subdomain matches', () => {
      expect(isUrlRecognized('https://www.example.com', items)).toBe(true);
    });

    test('should handle empty items array', () => {
      expect(isUrlRecognized('https://example.com', [])).toBe(false);
    });
  });

  describe('getBestMatch', () => {
    const items: PasswordItem[] = [
      createPasswordItem('1', 'Example Login', 'https://example.com'),
      createPasswordItem('2', 'Example Subdomain', 'https://sub.example.com'),
      createPasswordItem('3', 'GitHub', 'https://github.com'),
    ];

    test('should return the best match', () => {
      const match = getBestMatch('https://example.com', items);
      expect(match).not.toBeNull();
      expect(match?.item.title).toBe('Example Login');
      expect(match?.exactMatch).toBe(true);
    });

    test('should return null when no matches found', () => {
      const match = getBestMatch('https://nomatch.com', items);
      expect(match).toBeNull();
    });

    test('should prefer exact matches over subdomain matches', () => {
      const match = getBestMatch('https://example.com', items);
      expect(match?.item.title).toBe('Example Login');
      expect(match?.confidence).toBe(1.0);
    });

    test('should handle empty items array', () => {
      const match = getBestMatch('https://example.com', []);
      expect(match).toBeNull();
    });
  });

  describe('groupMatchesByConfidence', () => {
    const items: PasswordItem[] = [
      createPasswordItem('1', 'Exact', 'https://example.com'),
      createPasswordItem('2', 'High', 'https://mail.example.com'),
      createPasswordItem('3', 'Medium', 'https://different.com'),
    ];

    test('should group matches by confidence level', () => {
      const matches = findMatchingCredentials('https://example.com', items, {
        minConfidence: 0,
      });
      const grouped = groupMatchesByConfidence(matches);

      expect(grouped.exact.length).toBeGreaterThan(0);
      grouped.exact.forEach(m => expect(m.confidence).toBe(1.0));
      
      grouped.high.forEach(m => {
        expect(m.confidence).toBeGreaterThanOrEqual(0.8);
        expect(m.confidence).toBeLessThan(1.0);
      });
      
      grouped.medium.forEach(m => {
        expect(m.confidence).toBeGreaterThanOrEqual(0.5);
        expect(m.confidence).toBeLessThan(0.8);
      });
      
      grouped.low.forEach(m => {
        expect(m.confidence).toBeLessThan(0.5);
      });
    });

    test('should handle empty matches array', () => {
      const grouped = groupMatchesByConfidence([]);
      expect(grouped.exact).toEqual([]);
      expect(grouped.high).toEqual([]);
      expect(grouped.medium).toEqual([]);
      expect(grouped.low).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    test('should handle URLs with query parameters', () => {
      const items = [createPasswordItem('1', 'Example', 'https://example.com')];
      const matches = findMatchingCredentials('https://example.com?param=value', items);
      expect(matches.length).toBe(1);
      expect(matches[0]?.exactMatch).toBe(true);
    });

    test('should handle URLs with fragments', () => {
      const items = [createPasswordItem('1', 'Example', 'https://example.com')];
      const matches = findMatchingCredentials('https://example.com#section', items);
      expect(matches.length).toBe(1);
      expect(matches[0]?.exactMatch).toBe(true);
    });

    test('should handle URLs with different protocols', () => {
      const items = [createPasswordItem('1', 'Example', 'https://example.com')];
      const matches = findMatchingCredentials('http://example.com', items);
      expect(matches.length).toBe(1);
      expect(matches[0]?.exactMatch).toBe(true);
    });

    test('should handle case-insensitive domain matching', () => {
      const items = [createPasswordItem('1', 'Example', 'https://Example.COM')];
      const matches = findMatchingCredentials('https://example.com', items);
      expect(matches.length).toBe(1);
      expect(matches[0]?.exactMatch).toBe(true);
    });

    test('should handle multiple credentials for same site', () => {
      const items = [
        createPasswordItem('1', 'Personal', 'https://example.com', 'personal@example.com'),
        createPasswordItem('2', 'Work', 'https://example.com', 'work@example.com'),
        createPasswordItem('3', 'Admin', 'https://example.com', 'admin@example.com'),
      ];
      
      const matches = findMatchingCredentials('https://example.com', items);
      expect(matches.length).toBe(3);
      
      // All should have same confidence
      matches.forEach(match => {
        expect(match.confidence).toBe(1.0);
        expect(match.exactMatch).toBe(true);
      });
      
      // Should be sorted alphabetically by title when confidence is equal
      expect(matches[0]?.item.title).toBe('Admin');
      expect(matches[1]?.item.title).toBe('Personal');
      expect(matches[2]?.item.title).toBe('Work');
    });

    test('should handle localhost URLs', () => {
      const items = [createPasswordItem('1', 'Local Dev', 'http://localhost:3000')];
      const matches = findMatchingCredentials('http://localhost:3000', items);
      expect(matches.length).toBe(1);
      expect(matches[0]?.exactMatch).toBe(true);
    });

    test('should handle IP address URLs', () => {
      const items = [createPasswordItem('1', 'Server', 'http://192.168.1.1')];
      const matches = findMatchingCredentials('http://192.168.1.1', items);
      expect(matches.length).toBe(1);
      expect(matches[0]?.exactMatch).toBe(true);
    });
  });

  describe('Real-world Scenarios', () => {
    test('should match login and signup pages of same site', () => {
      const items = [createPasswordItem('1', 'Example', 'https://example.com/login')];
      const matches = findMatchingCredentials('https://example.com/signup', items);
      expect(matches.length).toBe(1);
      expect(matches[0]?.exactMatch).toBe(true);
    });

    test('should match different Google services', () => {
      const items = [
        createPasswordItem('1', 'Gmail', 'https://mail.google.com'),
        createPasswordItem('2', 'Drive', 'https://drive.google.com'),
        createPasswordItem('3', 'Calendar', 'https://calendar.google.com'),
      ];
      
      const matches = findMatchingCredentials('https://accounts.google.com', items);
      expect(matches.length).toBe(3);
      
      // All should have same confidence (same base domain)
      matches.forEach(match => {
        expect(match.confidence).toBe(0.8);
      });
    });

    test('should prioritize exact subdomain match over base domain match', () => {
      const items = [
        createPasswordItem('1', 'Main Site', 'https://example.com'),
        createPasswordItem('2', 'Mail', 'https://mail.example.com'),
      ];
      
      const matches = findMatchingCredentials('https://mail.example.com', items);
      expect(matches.length).toBe(2);
      expect(matches[0]?.item.title).toBe('Mail');
      expect(matches[0]?.confidence).toBe(1.0);
      expect(matches[1]?.item.title).toBe('Main Site');
      expect(matches[1]?.confidence).toBeLessThan(1.0);
    });
  });
});
