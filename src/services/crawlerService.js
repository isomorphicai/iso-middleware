const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../helpers/logger');
const jobManagerService = require('./jobManagerService');

// Ignored extensions that are not HTML documents
const IGNORED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff',
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv',
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
  'mp3', 'mp4', 'm4a', 'wav', 'avi', 'mov', 'mkv', 'webm', 'ogg',
  'css', 'js', 'json', 'xml', 'txt', 'map',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'exe', 'dmg', 'apk', 'iso', 'bin'
]);

class CrawlerService {
  parseProxy(proxyStr) {
    if (!proxyStr || typeof proxyStr !== 'string') return undefined;
    const clean = proxyStr.trim();
    if (!clean) return undefined;

    try {
      const urlObj = new URL(clean.startsWith('http') ? clean : `http://${clean}`);
      const proxyConfig = {
        protocol: urlObj.protocol.replace(':', ''),
        host: urlObj.hostname,
        port: parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 80)
      };

      if (urlObj.username || urlObj.password) {
        proxyConfig.auth = {
          username: decodeURIComponent(urlObj.username || ''),
          password: decodeURIComponent(urlObj.password || '')
        };
      }

      return proxyConfig;
    } catch (err) {
      logger.warn(`[Web Crawler] Invalid proxy format: "${proxyStr}"`);
      return undefined;
    }
  }

  normalizeUrl(rawUrl, baseUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
      return null;
    }

    try {
      const resolved = new URL(trimmed, baseUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        return null;
      }

      resolved.hash = '';

      const pathname = resolved.pathname.toLowerCase();
      const dotIdx = pathname.lastIndexOf('.');
      if (dotIdx !== -1) {
        const ext = pathname.slice(dotIdx + 1);
        if (IGNORED_EXTENSIONS.has(ext)) {
          return null;
        }
      }

      let normalized = resolved.href;
      if (normalized.endsWith('/') && resolved.pathname !== '/') {
        normalized = normalized.slice(0, -1);
      }

      return normalized;
    } catch (e) {
      return null;
    }
  }

  matchesPattern(url, pattern) {
    if (!pattern || typeof pattern !== 'string') return false;
    const p = pattern.trim().toLowerCase();
    if (!p) return false;

    const u = url.toLowerCase();

    if (p.includes('*')) {
      const regexStr = '^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      try {
        const regex = new RegExp(regexStr);
        try {
          const urlObj = new URL(url);
          if (regex.test(urlObj.pathname) || regex.test(u)) return true;
        } catch (_) {
          if (regex.test(u)) return true;
        }
      } catch (e) {}
    }

    return u.includes(p);
  }

  isUrlAllowed(url, includePatterns = [], excludePatterns = []) {
    if (Array.isArray(excludePatterns) && excludePatterns.length > 0) {
      for (const pattern of excludePatterns) {
        if (pattern && pattern.trim() && this.matchesPattern(url, pattern.trim())) {
          return false;
        }
      }
    }

    if (Array.isArray(includePatterns) && includePatterns.length > 0) {
      const validIncludes = includePatterns.filter(p => p && p.trim());
      if (validIncludes.length > 0) {
        const matched = validIncludes.some(p => this.matchesPattern(url, p.trim()));
        if (!matched) return false;
      }
    }

    return true;
  }

  async crawl({
    startUrl,
    maxDepth = 2,
    maxPages = 50,
    includePatterns = [],
    excludePatterns = [],
    proxy = '',
    allowSubdomains = false,
    jobId = null
  }) {
    if (!startUrl || typeof startUrl !== 'string') {
      throw new Error('A valid starting URL is required.');
    }

    let initialUrl = startUrl.trim();
    if (!/^https?:\/\//i.test(initialUrl)) {
      initialUrl = `https://${initialUrl}`;
    }

    let startUrlObj;
    try {
      startUrlObj = new URL(initialUrl);
    } catch (e) {
      throw new Error(`Invalid start URL format: "${initialUrl}"`);
    }

    const baseHost = startUrlObj.hostname.toLowerCase();
    const depthLimit = Math.min(Math.max(parseInt(maxDepth) || 2, 1), 5);
    const pageLimit = Math.min(Math.max(parseInt(maxPages) || 50, 1), 10000);

    const parsedProxy = this.parseProxy(proxy);

    if (jobId) {
      jobManagerService.updateJob(jobId, {
        status: 'running',
        progress: { current: 0, total: pageLimit },
        stats: {
          startUrl: initialUrl,
          activeUrl: initialUrl,
          currentDepth: 1,
          maxDepth: depthLimit,
          discoveredCount: 0
        }
      });
      jobManagerService.addLog(jobId, `Crawler started for ${initialUrl} (Depth ${depthLimit}, Max Pages ${pageLimit})`, 'info');
    }

    const queue = [{ url: initialUrl, depth: 1, foundOn: 'Root Entry' }];
    const visited = new Set();
    const queuedSet = new Set([initialUrl]);
    const discoveredUrls = [];

    const axiosInstance = axios.create({
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ISO-WebCrawler/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      proxy: parsedProxy || false,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });

    while (queue.length > 0 && discoveredUrls.length < pageLimit) {
      // Check if job was cancelled
      if (jobId) {
        const currentJob = jobManagerService.getJob(jobId);
        if (currentJob && currentJob.status === 'cancelled') {
          logger.info(`[Web Crawler] Crawl job "${jobId}" stopped due to cancellation.`);
          break;
        }
      }

      const current = queue.shift();
      const currentUrl = current.url;

      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      if (jobId) {
        const pct = Math.min(99, Math.round((discoveredUrls.length / pageLimit) * 100));
        jobManagerService.updateJob(jobId, {
          progress: { current: discoveredUrls.length, total: pageLimit, currentUrl, percentage: pct, percent: pct },
          stats: {
            activeUrl: currentUrl,
            currentDepth: current.depth,
            discoveredCount: discoveredUrls.length
          }
        });
      }

      try {
        logger.info(`[Web Crawler] Crawling [Depth ${current.depth}/${depthLimit}] (${discoveredUrls.length + 1}/${pageLimit}): ${currentUrl}`);

        const response = await axiosInstance.get(currentUrl);
        const contentType = response.headers['content-type'] || '';

        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
          continue;
        }

        const html = response.data;
        if (!html || typeof html !== 'string') continue;

        const $ = cheerio.load(html);

        const pageTitle = $('title').text().trim() || 
                          $('meta[property="og:title"]').attr('content') || 
                          $('h1').first().text().trim() || 
                          currentUrl;

        discoveredUrls.push({
          url: currentUrl,
          title: pageTitle,
          depth: current.depth,
          foundOn: current.foundOn,
          status: 'discovered',
          selected: true
        });

        if (jobId) {
          const pct = Math.min(99, Math.round((discoveredUrls.length / pageLimit) * 100));
          jobManagerService.addLog(jobId, `Discovered: "${pageTitle.slice(0, 45)}" (Depth ${current.depth})`, 'success');
          jobManagerService.updateJob(jobId, {
            progress: { current: discoveredUrls.length, total: pageLimit, currentUrl, percentage: pct, percent: pct },
            stats: { discoveredCount: discoveredUrls.length }
          });
        }

        if (current.depth >= depthLimit) {
          continue;
        }

        $('a[href]').each((_, el) => {
          if (discoveredUrls.length + queue.length >= pageLimit * 2) {
            return false;
          }

          const href = $(el).attr('href');
          const normalized = this.normalizeUrl(href, currentUrl);
          if (!normalized) return;

          try {
            const linkObj = new URL(normalized);
            const linkHost = linkObj.hostname.toLowerCase();

            if (allowSubdomains) {
              if (linkHost !== baseHost && !linkHost.endsWith(`.${baseHost}`)) {
                return;
              }
            } else {
              if (linkHost !== baseHost) {
                return;
              }
            }

            if (!this.isUrlAllowed(normalized, includePatterns, excludePatterns)) {
              return;
            }

            if (!visited.has(normalized) && !queuedSet.has(normalized)) {
              queuedSet.add(normalized);
              queue.push({
                url: normalized,
                depth: current.depth + 1,
                foundOn: currentUrl
              });
            }
          } catch (e) {}
        });

      } catch (err) {
        logger.warn(`[Web Crawler] Failed to fetch "${currentUrl}": ${err.message}`);
        discoveredUrls.push({
          url: currentUrl,
          title: currentUrl,
          depth: current.depth,
          foundOn: current.foundOn,
          status: 'error',
          error: err.message,
          selected: false
        });

        if (jobId) {
          jobManagerService.addLog(jobId, `Failed to crawl: ${currentUrl} (${err.message})`, 'warn');
        }
      }
    }

    const crawlResult = {
      startUrl: initialUrl,
      baseHost,
      totalDiscovered: discoveredUrls.length,
      maxDepth: depthLimit,
      maxPages: pageLimit,
      discoveredUrls
    };

    if (jobId) {
      jobManagerService.updateJob(jobId, {
        status: 'completed',
        progress: { current: discoveredUrls.length, total: discoveredUrls.length, percentage: 100 },
        stats: {
          activeUrl: '',
          discoveredCount: discoveredUrls.length
        },
        result: crawlResult
      });
      jobManagerService.addLog(jobId, `Crawler finished. Discovered ${discoveredUrls.length} total pages.`, 'info');
    }

    logger.info(`[Web Crawler] Finished crawl for "${initialUrl}". Total URLs discovered: ${discoveredUrls.length}`);
    return crawlResult;
  }
}

module.exports = new CrawlerService();
