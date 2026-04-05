/**
 * Text Chunker
 *
 * Splits text into overlapping chunks for embedding and retrieval.
 * Multiple strategies: token-based, paragraph, sentence, recursive.
 */

'use strict';

const DEFAULT_CHUNK_SIZE = 512;
const DEFAULT_OVERLAP = 50;

/**
 * Split text into chunks by approximate token count (4 chars ≈ 1 token)
 * @param {string} text - Input text
 * @param {number} [chunkSize=512] - Target tokens per chunk
 * @param {number} [overlap=50] - Overlap tokens between chunks
 * @returns {{ text: string, index: number, start: number, end: number }[]}
 */
function splitByTokens(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP) {
  if (!text || !text.trim()) return [];

  const charChunk = chunkSize * 4;
  const charOverlap = overlap * 4;
  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(start + charChunk, text.length);

    // Try to break at a sentence/paragraph boundary
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastBreak = Math.max(
        slice.lastIndexOf('\n\n'),
        slice.lastIndexOf('. '),
        slice.lastIndexOf('? '),
        slice.lastIndexOf('! '),
      );
      if (lastBreak > charChunk * 0.5) {
        end = start + lastBreak + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push({ text: chunk, index, start, end });
      index++;
    }

    start = end - charOverlap;
    if (start >= text.length) break;
    if (end >= text.length) break;
  }

  return chunks;
}

/**
 * Split text by paragraphs (double newline)
 * @param {string} text - Input text
 * @param {number} [maxChunkSize=2048] - Max chars per chunk, merge small paragraphs
 * @returns {{ text: string, index: number }[]}
 */
function splitByParagraph(text, maxChunkSize = 2048) {
  if (!text || !text.trim()) return [];

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  let index = 0;

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChunkSize && current.length > 0) {
      chunks.push({ text: current.trim(), index: index++ });
      current = '';
    }
    current += (current ? '\n\n' : '') + para;
  }

  if (current.trim()) {
    chunks.push({ text: current.trim(), index: index++ });
  }

  return chunks;
}

/**
 * Split text by sentences
 * @param {string} text - Input text
 * @param {number} [sentencesPerChunk=5] - Sentences per chunk
 * @param {number} [overlapSentences=1] - Overlap sentences between chunks
 * @returns {{ text: string, index: number }[]}
 */
function splitBySentence(text, sentencesPerChunk = 5, overlapSentences = 1) {
  if (!text || !text.trim()) return [];

  // Split on sentence boundaries
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  const chunks = [];
  let index = 0;

  for (let i = 0; i < sentences.length; i += sentencesPerChunk - overlapSentences) {
    const slice = sentences.slice(i, i + sentencesPerChunk);
    if (slice.length === 0) break;
    const chunk = slice.join('').trim();
    if (chunk) {
      chunks.push({ text: chunk, index: index++ });
    }
  }

  return chunks;
}

/**
 * Recursive character text splitter — splits on largest separators first,
 * then recursively splits any oversized chunks on smaller separators.
 * @param {string} text - Input text
 * @param {number} [chunkSize=512] - Target tokens per chunk
 * @param {number} [overlap=50] - Overlap tokens between chunks
 * @returns {{ text: string, index: number }[]}
 */
function splitRecursive(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP) {
  if (!text || !text.trim()) return [];

  const charChunk = chunkSize * 4;
  const charOverlap = overlap * 4;
  const separators = ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '];

  function _split(txt, seps) {
    if (txt.length <= charChunk) return [txt];
    const sep = seps[0];
    if (!sep) {
      // No more separators — hard split
      return splitByTokens(txt, chunkSize, overlap).map((c) => c.text);
    }

    const parts = txt.split(sep);
    const results = [];
    let current = '';

    for (const part of parts) {
      const candidate = current ? current + sep + part : part;
      if (candidate.length > charChunk && current) {
        results.push(current);
        current = part;
      } else {
        current = candidate;
      }
    }
    if (current) results.push(current);

    // Recursively split any oversized chunks
    const final = [];
    for (const chunk of results) {
      if (chunk.length > charChunk) {
        final.push(..._split(chunk, seps.slice(1)));
      } else {
        final.push(chunk);
      }
    }
    return final;
  }

  const rawChunks = _split(text, separators);

  // Add overlap
  const chunks = [];
  for (let i = 0; i < rawChunks.length; i++) {
    let chunk = rawChunks[i].trim();
    if (i > 0 && charOverlap > 0) {
      const prevTail = rawChunks[i - 1].slice(-charOverlap);
      chunk = prevTail + chunk;
    }
    if (chunk) {
      chunks.push({ text: chunk, index: i });
    }
  }

  return chunks;
}

module.exports = {
  splitByTokens,
  splitByParagraph,
  splitBySentence,
  splitRecursive,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_OVERLAP,
};
