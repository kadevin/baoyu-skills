/**
 * Browser validation headers generator for Chrome
 * Used to generate x-browser-validation header for Google services
 * 
 * Algorithm: base64(sha1(API_KEY + User-Agent))
 */

import { createHash } from 'node:crypto';

/**
 * Platform-specific API keys extracted from Chrome binaries
 * These are used to generate x-browser-validation headers
 */
const BROWSER_API_KEYS: Record<string, string> = {
  win32: 'AIzaSyA2KlwBX3mkFo30om9LUFYQhpqLoa_BNhE',
  // darwin and linux keys may differ - using Windows key as fallback
};

/**
 * Default User-Agent string for Chrome on Windows
 */
const DEFAULT_USER_AGENT = 
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36';

/**
 * Generate x-browser-validation header value
 * @param userAgent - Browser User-Agent string
 * @returns Base64-encoded SHA1 hash
 */
export function generateBrowserValidation(userAgent: string = DEFAULT_USER_AGENT): string {
  const platform = process.platform;
  const apiKey = BROWSER_API_KEYS[platform] ?? BROWSER_API_KEYS.win32!;
  const hash = createHash('sha1').update(apiKey + userAgent).digest('base64');
  return hash;
}

/**
 * Generate complete set of Chrome browser headers for Google services
 * @param userAgent - Browser User-Agent string
 * @returns Headers object with x-browser-* headers
 */
export function generateBrowserHeaders(userAgent: string = DEFAULT_USER_AGENT): Record<string, string> {
  const year = new Date().getFullYear().toString();
  return {
    'User-Agent': userAgent,
    'x-browser-channel': 'stable',
    'x-browser-copyright': `Copyright ${year} Google LLC. All Rights reserved.`,
    'x-browser-validation': generateBrowserValidation(userAgent),
    'x-browser-year': year,
  };
}

/**
 * Get default User-Agent string
 */
export function getDefaultUserAgent(): string {
  return DEFAULT_USER_AGENT;
}
