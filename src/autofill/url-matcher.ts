/**
 * URL Matcher for Password Manager Autofill System
 * 
 * This module provides URL recognition and credential matching functionality
 * for the autofill system.
 * 
 * Requirements: 6.1 - Recognize URLs and suggest appropriate credentials
 */

import { PasswordItem } from '../types/vault';

/**
 * Represents a match between a URL and a password item
 */
export interface WebsiteMatch {
  /** The password item that matches the URL */
  readonly item: PasswordItem;
  /** Confidence score (0-1) indicating match quality */
  readonly confidence: number;
  /** Whether this is an exact domain match */
  readonly exactMatch: boolean;
}

/**
 * Options for URL matching
 */
export interface MatchOptions {
  /** Whether to include subdomain matches (default: true) */
  readonly includeSubdomains?: boolean;
  /** Minimum confidence threshold (0-1, default: 0.5) */
  readonly minConfidence?: number;
  /** Whether to match by path as well (default: false) */
  readonly matchPath?: boolean;
}

/**
 * Normalizes a URL for comparison
 * 
 * @param url - The URL to normalize
 * @returns Normalized URL components or null if invalid
 */
export function normalizeUrl(url: string): {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  domain: string;
} | null {
  try {
    // Handle URLs without protocol
    let urlToProcess = url.trim();
    if (!urlToProcess.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/)) {
      urlToProcess = 'https://' + urlToProcess;
    }

    const parsed = new URL(urlToProcess);
    
    // Extract base domain (remove www. prefix if present)
    const hostname = parsed.hostname.toLowerCase();
    const domain = hostname.replace(/^www\./, '');

    return {
      protocol: parsed.protocol,
      hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      domain,
    };
  } catch {
    return null;
  }
}

/**
 * Extracts the base domain from a hostname
 * (e.g., "mail.google.com" -> "google.com")
 * 
 * @param hostname - The hostname to process
 * @returns Base domain
 */
export function extractBaseDomain(hostname: string): string {
  const parts = hostname.split('.');
  
  // Handle special cases like .co.uk, .com.au, etc.
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join('.');
    const commonTLDs = ['co.uk', 'com.au', 'co.jp', 'co.nz', 'com.br'];
    
    if (commonTLDs.includes(lastTwo)) {
      return parts.slice(-3).join('.');
    }
  }
  
  // Return last two parts (domain.tld)
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  
  return hostname;
}

/**
 * Calculates the confidence score for a URL match
 * 
 * @param targetUrl - The URL being visited
 * @param itemUrl - The URL stored in the password item
 * @param options - Matching options
 * @returns Confidence score (0-1)
 */
export function calculateMatchConfidence(
  targetUrl: string,
  itemUrl: string,
  options: MatchOptions = {}
): number {
  const target = normalizeUrl(targetUrl);
  const item = normalizeUrl(itemUrl);

  if (!target || !item) {
    return 0;
  }

  let confidence = 0;

  // Exact hostname match (highest confidence)
  if (target.hostname === item.hostname) {
    confidence = 1.0;
    
    // Bonus for exact path match
    if (options.matchPath && target.pathname === item.pathname) {
      confidence = 1.0;
    }
    
    return confidence;
  }

  // Base domain match
  const targetBase = extractBaseDomain(target.domain);
  const itemBase = extractBaseDomain(item.domain);

  if (targetBase === itemBase) {
    // Check if one is a subdomain of the other
    const targetIsSubdomain = target.domain !== targetBase;
    const itemIsSubdomain = item.domain !== itemBase;
    
    // Both are subdomains of the same base domain (e.g., mail.google.com vs drive.google.com)
    if (targetIsSubdomain && itemIsSubdomain) {
      if (options.includeSubdomains !== false) {
        confidence = 0.8;
      } else {
        confidence = 0.3;
      }
      return confidence;
    }
    
    // One is the base domain and the other is a subdomain (e.g., google.com vs mail.google.com)
    if (targetIsSubdomain !== itemIsSubdomain) {
      if (options.includeSubdomains !== false) {
        confidence = 0.6;
      } else {
        confidence = 0.2;
      }
      return confidence;
    }
    
    // Both are the base domain (should have been caught by exact hostname match above)
    confidence = 1.0;
    return confidence;
  }

  // No match
  return 0;
}

/**
 * Finds password items that match a given URL
 * 
 * Requirement 6.1: Recognize URL and suggest appropriate credentials
 * 
 * @param url - The URL to match against
 * @param items - Array of password items to search
 * @param options - Matching options
 * @returns Array of matches sorted by confidence (highest first)
 */
export function findMatchingCredentials(
  url: string,
  items: readonly PasswordItem[],
  options: MatchOptions = {}
): WebsiteMatch[] {
  const minConfidence = options.minConfidence ?? 0.5;
  const matches: WebsiteMatch[] = [];

  for (const item of items) {
    // Skip items without URLs
    if (!item.url) {
      continue;
    }

    const confidence = calculateMatchConfidence(url, item.url, options);

    // Only include matches above the minimum confidence threshold
    if (confidence >= minConfidence) {
      matches.push({
        item,
        confidence,
        exactMatch: confidence === 1.0,
      });
    }
  }

  // Sort by confidence (highest first), then by title alphabetically
  matches.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return a.item.title.localeCompare(b.item.title);
  });

  return matches;
}

/**
 * Checks if a URL is recognized (has any matching credentials)
 * 
 * Requirement 6.1: Recognize website URLs
 * 
 * @param url - The URL to check
 * @param items - Array of password items to search
 * @param options - Matching options
 * @returns true if at least one match is found
 */
export function isUrlRecognized(
  url: string,
  items: readonly PasswordItem[],
  options: MatchOptions = {}
): boolean {
  const matches = findMatchingCredentials(url, items, options);
  return matches.length > 0;
}

/**
 * Gets the best matching credential for a URL
 * 
 * Requirement 6.5: Handle multiple credentials for the same site
 * 
 * @param url - The URL to match against
 * @param items - Array of password items to search
 * @param options - Matching options
 * @returns The best match or null if no matches found
 */
export function getBestMatch(
  url: string,
  items: readonly PasswordItem[],
  options: MatchOptions = {}
): WebsiteMatch | null {
  const matches = findMatchingCredentials(url, items, options);
  const firstMatch = matches[0];
  return firstMatch !== undefined ? firstMatch : null;
}

/**
 * Groups matches by confidence level
 * 
 * @param matches - Array of website matches
 * @returns Matches grouped by confidence level
 */
export function groupMatchesByConfidence(matches: readonly WebsiteMatch[]): {
  exact: WebsiteMatch[];
  high: WebsiteMatch[];
  medium: WebsiteMatch[];
  low: WebsiteMatch[];
} {
  return {
    exact: matches.filter(m => m.confidence === 1.0),
    high: matches.filter(m => m.confidence >= 0.8 && m.confidence < 1.0),
    medium: matches.filter(m => m.confidence >= 0.5 && m.confidence < 0.8),
    low: matches.filter(m => m.confidence < 0.5),
  };
}
