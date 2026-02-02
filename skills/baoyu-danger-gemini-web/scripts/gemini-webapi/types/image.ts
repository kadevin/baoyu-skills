import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

import { logger } from '../utils/logger.js';
import { cookie_header, fetch_with_timeout } from '../utils/http.js';

export class Image {
  constructor(
    public url: string,
    public title = '[Image]',
    public alt = '',
    public proxy: string | null = null,
  ) {}

  toString(): string {
    const u = this.url.length <= 20 ? this.url : `${this.url.slice(0, 8)}...${this.url.slice(-12)}`;
    return `Image(title='${this.title}', alt='${this.alt}', url='${u}')`;
  }

  async save(
    p: string = 'temp',
    filename: string | null = null,
    cookies: Record<string, string> | null = null,
    verbose: boolean = false,
    skip_invalid_filename: boolean = false,
  ): Promise<string | null> {
    filename = filename ?? this.url.split('/').pop()?.split('?')[0] ?? 'image';
    const m = filename.match(/^(.*\.\w+)/);
    if (m) filename = m[1]!;
    else {
      if (verbose) logger.warning(`Invalid filename: ${filename}`);
      if (skip_invalid_filename) return null;
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://gemini.google.com/',
    };
    if (cookies) headers.Cookie = cookie_header(cookies);

    let url = this.url;
    let res: Response | null = null;
    for (let i = 0; i < 10; i++) {
      res = await fetch_with_timeout(url, {
        method: 'GET',
        headers,
        redirect: 'manual',
        timeout_ms: 30_000,
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) break;
        url = new URL(loc, url).toString();
        continue;
      }

      break;
    }

    if (!res) throw new Error('Image download failed: no response');

    if (!res.ok) {
      throw new Error(`Error downloading image: ${res.status} ${res.statusText}`);
    }

    const ct = res.headers.get('content-type');
    if (ct && !ct.includes('image')) {
      logger.warning(`Content type of ${filename} is not image, but ${ct}.`);
    }

    const dir = path.resolve(p);
    await mkdir(dir, { recursive: true });

    const dest = path.join(dir, filename);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);

    if (verbose) logger.info(`Image saved as ${dest}`);
    return dest;
  }
}

export class WebImage extends Image {}

/**
 * Metadata needed for 2K image generation request
 */
export interface FullSizeImageMeta {
  /** Image token starting with $AS... */
  imageToken: string;
  /** Original prompt used to generate the image */
  prompt: string;
  /** Response ID like r_xxx */
  responseId: string;
  /** Candidate ID like rc_xxx */
  candidateId: string;
  /** Conversation ID like c_xxx */
  conversationId: string;
}

export class GeneratedImage extends Image {
  /** Metadata for requesting 2K full-size image */
  public fullSizeMeta?: FullSizeImageMeta;

  constructor(
    url: string,
    title: string,
    alt: string,
    proxy: string | null,
    public cookies: Record<string, string>,
    fullSizeMeta?: FullSizeImageMeta,
  ) {
    super(url, title, alt, proxy);
    if (!cookies || Object.keys(cookies).length === 0) {
      throw new Error('GeneratedImage is designed to be initialized with same cookies as GeminiClient.');
    }
    this.fullSizeMeta = fullSizeMeta;
  }

  /**
   * Check if this image supports 2K full-size download
   */
  canDownloadFullSize(): boolean {
    return !!(this.fullSizeMeta?.imageToken && this.fullSizeMeta?.conversationId);
  }

  async save(
    p: string = 'temp',
    filename: string | null = null,
    cookies: Record<string, string> | null = null,
    verbose: boolean = false,
    skip_invalid_filename: boolean = false,
    full_size: boolean = true,
  ): Promise<string | null> {
    const u = full_size ? `${this.url}=s2048` : this.url;
    const f = filename ?? `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${u.slice(-10)}.png`;
    const img = new Image(u, this.title, this.alt, this.proxy);
    return await img.save(p, f, cookies ?? this.cookies, verbose, skip_invalid_filename);
  }
}
