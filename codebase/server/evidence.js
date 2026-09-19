"use strict";

const fs = require("fs");
const path = require("path");

const DATA_ROOT = path.resolve(__dirname, "..", "..", "data");
const EVIDENCE_ROOT = path.join(DATA_ROOT, "processed", "evidence_chunks");
const SLIDE_IMAGE_ROOT = path.join(DATA_ROOT, "processed", "slide_images");
let cache = null;

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { return fallback; }
}

function readJsonl(file) {
  try {
    return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  } catch (_) { return []; }
}

function load() {
  if (cache) return cache;
  const map = readJson(path.join(EVIDENCE_ROOT, "question_evidence_map.json"), { questions: {} });
  const chunks = new Map();
  for (const file of ["slide_chunks.jsonl", "transcript_chunks.jsonl", "fallback_chunks.jsonl"]) {
    for (const item of readJsonl(path.join(EVIDENCE_ROOT, file))) chunks.set(item.id, item);
  }
  cache = { questions: map.questions || {}, chunks };
  return cache;
}

function assetName(sourceFile) {
  return String(sourceFile || "").replace(/\\/g, "/").split("/").pop() || "source";
}

function sourceAnchor(source, label) {
  if (!source) return null;
  return {
    code: source.id,
    quote: source.excerpt || "",
    confidence: source.confidence || "partial",
    type: source.source_type || label
  };
}

function knowledgeItem(source, fallbackText, target) {
  const file = path.join(path.resolve(DATA_ROOT, ".."), String(source?.source_file || "").replace(/[\\/]+/g, path.sep));
  let raw = "";
  try { raw = fs.readFileSync(file, "utf8"); } catch (_) { return { text: fallbackText, highlight_text: target || fallbackText, item_number: null }; }
  const lines = raw.split(/\r?\n/);
  const foldedTarget = String(target || "").replace(/^…|…$/g, "").trim();
  const numberedTarget = foldedTarget.match(/(?:^|[^\d])(\d{2})(?=\s|$)/);
  const textIndex = foldedTarget ? lines.findIndex(line => line.includes(foldedTarget.slice(0, 55))) : -1;
  let targetIndex = textIndex;
  if (numberedTarget) {
    const from = Math.max(0, textIndex);
    const near = lines.findIndex((line, index) => index >= from && index <= from + 20 && line.trim() === numberedTarget[1]);
    targetIndex = near >= 0 ? near : lines.findIndex(line => line.trim() === numberedTarget[1]);
  }
  let start = targetIndex >= 0 ? targetIndex : 0;
  while (start > 0 && !/^\d{2}$/.test(lines[start].trim())) start--;
  let end = start + 1;
  while (end < lines.length && !/^\d{2}$/.test(lines[end].trim())) end++;
  const text = lines.slice(start, end).join("\n").trim();
  return { text: text || fallbackText, highlight_text: text || target || fallbackText, item_number: /^\d{2}$/.test(lines[start]?.trim()) ? lines[start].trim() : null };
}

function getEvidence(questionId) {
  const item = load().questions[questionId];
  if (!item) return null;
  const slideChunk = item.slide ? load().chunks.get(item.slide.id) : null;
  const knowledgeSource = item.fallback || item.transcript || null;
  const knowledgeChunk = knowledgeSource ? load().chunks.get(knowledgeSource.id) : null;
  const slidePage = Number(item.slide?.evidence?.slide_page || item.slide?.evidence?.page || 0);
  const slideDeck = String(item.slide?.source_file || "").match(/(?:^|\/)(d[12])-/i)?.[1]?.toLowerCase() || "d1";
  const excerpt = knowledgeSource?.excerpt || knowledgeChunk?.text || "";
  const knowledgeView = item.fallback ? knowledgeItem(knowledgeSource, knowledgeChunk?.text || excerpt, excerpt) : { text: knowledgeChunk?.text || excerpt, highlight_text: excerpt, item_number: null };
  return {
    question_id: questionId,
    slide: item.slide ? {
      id: item.slide.id,
      label: `Slide ${slidePage || "?"}`,
      page: slidePage || null,
      source_type: "slide",
      confidence: item.slide.confidence || "strong",
      source_file: item.slide.source_file,
      excerpt: item.slide.excerpt || slideChunk?.text || "",
      image_url: slidePage ? `/api/evidence/slide/${slideDeck}/${slidePage}` : null
    } : null,
    knowledge: knowledgeSource ? {
      id: knowledgeSource.id,
      key: knowledgeSource.evidence?.fallback_key || path.basename(knowledgeSource.source_file || "").replace(/\.[^.]+$/, ""),
      label: item.fallback ? "KIẾN THỨC TRỌNG TÂM" : "TRANSCRIPT",
      source_type: knowledgeSource.source_type,
      source_file: knowledgeSource.source_file,
      excerpt,
      text: knowledgeView.text,
      highlight_text: knowledgeView.highlight_text,
      item_number: knowledgeView.item_number,
      confidence: knowledgeSource.confidence || "partial"
    } : null,
    note: item.note || null,
    fallback_used: Boolean(item.fallback_used),
    anchors: [sourceAnchor(item.slide, "slide"), sourceAnchor(knowledgeSource, "knowledge")].filter(Boolean)
  };
}

function readSlideImage(deck, page) {
  const safeDeck = String(deck || "").toLowerCase().match(/^d[12]$/)?.[0];
  const safePage = String(page || "").match(/^\d{1,3}$/)?.[0];
  if (!safeDeck || !safePage) return null;
  const file = path.join(SLIDE_IMAGE_ROOT, safeDeck, `slide-${safePage.padStart(2, "0")}.png`);
  return fs.existsSync(file) ? file : null;
}

module.exports = { getEvidence, readSlideImage };
