const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../helpers/logger');

class ScraperService {
  /**
   * Scrapes webpage content, extracts clean text and metadata
   * @param {string} url - Target URL to scrape
   * @returns {Promise<{ title: string, description: string, cleanText: string, charCount: number, url: string }>}
   */
  async scrapeUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('Valid URL string is required.');
    }

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    try {
      logger.info(`[RAG Scraper] Fetching content from: ${targetUrl}`);

      const response = await axios.get(targetUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ISO-RAG-Ingest/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        maxRedirects: 5
      });

      const html = response.data;
      if (!html || typeof html !== 'string') {
        throw new Error('Empty response or non-HTML content received from URL.');
      }

      const $ = cheerio.load(html);

      // Remove non-content elements
      $('script, style, nav, footer, header, noscript, iframe, svg, [role="navigation"], [role="banner"], .ad, .advertisement, .cookie-banner').remove();

      // Extract metadata
      const title = $('title').text().trim() || 
                    $('meta[property="og:title"]').attr('content') || 
                    $('h1').first().text().trim() || 
                    targetUrl;

      const description = $('meta[name="description"]').attr('content') || 
                          $('meta[property="og:description"]').attr('content') || 
                          '';

      // Extract main readable content
      // Prioritize semantic tags if available
      let contentContainer = $('main, article, [role="main"], #content, .content, .main-content');
      let rawText = '';

      if (contentContainer.length > 0) {
        rawText = contentContainer.text();
      } else {
        rawText = $('body').text();
      }

      // Clean up text whitespace and newlines
      const cleanText = rawText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (!cleanText || cleanText.length < 20) {
        throw new Error('Could not extract sufficient text content from URL. The page might be rendering content dynamically with JavaScript.');
      }

      logger.info(`[RAG Scraper] Successfully extracted ${cleanText.length} characters from: ${targetUrl}`);

      return {
        url: targetUrl,
        title,
        description,
        cleanText,
        charCount: cleanText.length
      };
    } catch (err) {
      logger.error(`[RAG Scraper] Failed to scrape URL ${targetUrl}: ${err.message}`);
      throw new Error(`Failed to scrape URL: ${err.message}`);
    }
  }
}

module.exports = new ScraperService();
