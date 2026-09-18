/* Local, persona-independent transcript retrieval for the demo.
 * Uses lightweight lexical BM25-style scoring; no embedding/API cost. */
"use strict";
const fs = require("fs");
const path = require("path");

const TRANSCRIPT_DIR = process.env.TRANSCRIPT_DIR || path.resolve(__dirname, "..", "..", "data", "vlearn-pack", "transcript");
const CHUNK_RE = /\*\*\[(T\d+-\d+)\]\*\*\s*(.+)$/gm;
const STOP = new Set("các cái cho của có là và một những được trong khi với này đó từ vào về thì để hoặc nên nào gì như theo trên dưới tại bởi đang sẽ đã cũng hơn nhất đúng sai câu hỏi đáp án lựa chọn".split(/\s+/));
let cache = null;

function tokens(text) {
  const folded = String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (folded.match(/[a-z0-9_]+/g) || []).filter(t => t.length >= 3 && !STOP.has(t));
}

function normalizedPhrase(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function loadIndex() {
  if (cache) return cache;
  const chunks = [];
  if (fs.existsSync(TRANSCRIPT_DIR)) {
    for (const file of fs.readdirSync(TRANSCRIPT_DIR).filter(x => /^transcript-.*-clean\.md$/.test(x)).sort()) {
      const content = fs.readFileSync(path.join(TRANSCRIPT_DIR, file), "utf8");
      for (const match of content.matchAll(CHUNK_RE)) {
        const terms = tokens(match[2]);
        chunks.push({ code: match[1], quote: match[2].trim(), file, terms, counts: countTerms(terms) });
      }
    }
  }
  const df = new Map();
  for (const chunk of chunks) for (const term of new Set(chunk.terms)) df.set(term, (df.get(term) || 0) + 1);
  const avgLength = chunks.length ? chunks.reduce((sum, c) => sum + c.terms.length, 0) / chunks.length : 0;
  cache = { chunks, df, total: chunks.length, avgLength };
  return cache;
}

function countTerms(items) {
  const out = new Map();
  for (const item of items) out.set(item, (out.get(item) || 0) + 1);
  return out;
}

function correctOptionText(question) {
  const labels = String(question.correct || "").split(",").map(x => x.trim());
  return labels.map(label => question.options?.[label] || "").join(" ");
}

function retrieveAnchors(question, topK = 3) {
  const index = loadIndex();
  if (!index.total) return [];
  const query = tokens([question.topic, question.stem, correctOptionText(question)].join(" "));
  const coreTerms = new Set(tokens([question.topic, question.stem].join(" ")));
  const topicTerms = new Set(tokens(question.topic));
  const answerTerms = new Set(tokens(correctOptionText(question)).filter(term => !topicTerms.has(term)));
  const topicPhrase = normalizedPhrase(question.topic);
  const queryCounts = countTerms(query);
  const scored = [];
  for (const chunk of index.chunks) {
    let score = 0;
    let coreMatches = 0;
    let topicMatches = 0;
    let answerMatches = 0;
    const exactTopic = topicTerms.size <= 1 || normalizedPhrase(chunk.quote).includes(topicPhrase);
    for (const term of coreTerms) if (chunk.counts.has(term)) coreMatches++;
    for (const term of topicTerms) if (chunk.counts.has(term)) topicMatches++;
    for (const term of answerTerms) if (chunk.counts.has(term)) answerMatches++;
    for (const [term, qtf] of queryCounts) {
      const tf = chunk.counts.get(term) || 0;
      if (!tf) continue;
      const idf = Math.log(1 + (index.total - (index.df.get(term) || 0) + 0.5) / ((index.df.get(term) || 0) + 0.5));
      const k1 = 1.2, b = 0.75;
      const lengthNorm = 1 - b + b * (chunk.terms.length / Math.max(index.avgLength, 1));
      score += idf * Math.min(qtf, 2) * ((tf * (k1 + 1)) / (tf + k1 * lengthNorm));
    }
    if (score > 0) scored.push({ score, coreMatches, topicMatches, answerMatches, exactTopic, chunk });
  }
  scored.sort((a, b) => b.score - a.score || a.chunk.code.localeCompare(b.chunk.code));
  const minScore = Number(process.env.RETRIEVAL_MIN_SCORE || 5);
  const minCoreTerms = Number(process.env.RETRIEVAL_MIN_CORE_TERMS || 2);
  const minTopicTerms = topicTerms.size ? Math.max(1, Math.ceil(topicTerms.size * 0.75)) : 0;
  const minAnswerTerms = topicTerms.size >= 2 && answerTerms.size ? 1 : 0;
  return scored.filter(x => x.score >= minScore && x.coreMatches >= minCoreTerms && x.topicMatches >= minTopicTerms && x.answerMatches >= minAnswerTerms && x.exactTopic).slice(0, topK).map(x => ({
    code: x.chunk.code,
    quote: excerpt(x.chunk.quote, query),
    retrieval_score: Number(x.score.toFixed(3))
  }));
}

function excerpt(text, queryTerms, maxLength = 1200) {
  if (text.length <= maxLength) return text;
  const folded = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const positions = queryTerms.map(term => folded.indexOf(term)).filter(i => i >= 0);
  const center = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, Math.min(center - Math.floor(maxLength / 3), text.length - maxLength));
  return `${start ? "…" : ""}${text.slice(start, start + maxLength).trim()}${start + maxLength < text.length ? "…" : ""}`;
}

function retrievalStatus() {
  const index = loadIndex();
  return { transcript_dir: TRANSCRIPT_DIR, chunks: index.total };
}

module.exports = { retrieveAnchors, retrievalStatus };
