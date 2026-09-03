const logger = require('../helpers/logger');

class ChunkerService {
  /**
   * Split clean text into recursive semantic chunks with overlap
   * @param {string} text - Raw content text
   * @param {number} chunkSize - Max characters per chunk (default 600)
   * @param {number} chunkOverlap - Overlap characters between consecutive chunks (default 100)
   * @returns {Array<{ chunkIndex: number, text: string, charCount: number }>}
   */
  chunkText(text, chunkSize = 600, chunkOverlap = 100) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const effectiveChunkSize = Math.max(100, parseInt(chunkSize) || 600);
    const effectiveOverlap = Math.min(Math.floor(effectiveChunkSize / 2), Math.max(0, parseInt(chunkOverlap) || 100));

    // Separators to attempt in order of priority: paragraphs, sentences, words
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      if ((currentChunk.length + trimmedPara.length + 2) <= effectiveChunkSize) {
        currentChunk = currentChunk ? `${currentChunk}\n\n${trimmedPara}` : trimmedPara;
      } else {
        // If currentChunk has content, push it
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          // Prepare next chunk with overlap from the end of currentChunk
          const overlapText = currentChunk.slice(-effectiveOverlap);
          currentChunk = overlapText ? `${overlapText} ${trimmedPara}` : trimmedPara;
        } else {
          currentChunk = trimmedPara;
        }

        // If a single paragraph is larger than chunkSize, split by sentences
        while (currentChunk.length > effectiveChunkSize) {
          // Find sentence boundary near effectiveChunkSize
          let splitIdx = currentChunk.lastIndexOf('. ', effectiveChunkSize);
          if (splitIdx === -1 || splitIdx < effectiveChunkSize * 0.4) {
            splitIdx = currentChunk.lastIndexOf(' ', effectiveChunkSize);
          }
          if (splitIdx === -1) {
            splitIdx = effectiveChunkSize;
          } else {
            splitIdx += 1; // Include period or space
          }

          const part = currentChunk.slice(0, splitIdx).trim();
          if (part) chunks.push(part);

          const overlapText = currentChunk.slice(Math.max(0, splitIdx - effectiveOverlap), splitIdx).trim();
          const remaining = currentChunk.slice(splitIdx).trim();
          currentChunk = overlapText ? `${overlapText} ${remaining}` : remaining;
        }
      }
    }

    if (currentChunk && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Map into structured chunk objects
    return chunks.map((chunkText, idx) => ({
      chunkIndex: idx,
      text: chunkText,
      charCount: chunkText.length
    }));
  }
}

module.exports = new ChunkerService();
