import type { ListItem, ParsedDoc, Section } from './types';

/**
 * Normalize markdown as stored in Drive. Some readers return CommonMark-escaped text
 * ("\#\# Heading", "\[owed\]", "\---"); both forms normalize to the same plain markdown.
 */
export function normalizeMarkdown(raw: string): string {
  let s = (raw ?? '').replace(/\r\n?/g, '\n').replace(/ /g, ' ').replace(/^﻿/, '');
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|>&<~"$=:'])/g, '$1');
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n');
}

function parseScalar(v: string): string | string[] {
  const t = v.trim();
  if (/^\[.*\]$/.test(t)) {
    return t
      .slice(1, -1)
      .split(',')
      .map((x) => x.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }
  return t.replace(/^['"]|['"]$/g, '');
}

/** Minimal YAML frontmatter reader: `key: value`, `[a, b]` lists, folded continuation lines. */
export function parseFrontmatter(md: string): { data: Record<string, string | string[]>; body: string } {
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (lines[i]?.trim() !== '---') return { data: {}, body: md };
  const data: Record<string, string | string[]> = {};
  let lastKey: string | null = null;
  let j = i + 1;
  for (; j < lines.length; j++) {
    const line = lines[j];
    if (line.trim() === '---') break;
    const m = !/^\s/.test(line) ? line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/) : null;
    if (m) {
      lastKey = m[1].toLowerCase().replace(/-/g, '_');
      let v = m[2].trim();
      if (/^[>|][-+]?$/.test(v)) v = '';
      data[lastKey] = parseScalar(v);
    } else if (lastKey && line.trim()) {
      const prev = data[lastKey];
      const prevText = Array.isArray(prev) ? prev.join(', ') : prev;
      data[lastKey] = (prevText ? prevText + ' ' : '') + line.trim();
    }
  }
  if (j >= lines.length) return { data: {}, body: md };
  return { data, body: lines.slice(j + 1).join('\n') };
}

export function fmString(data: Record<string, string | string[]>, key: string): string | undefined {
  const v = data[key];
  if (v === undefined) return undefined;
  const s = Array.isArray(v) ? v.join(', ') : v;
  const t = s.trim();
  return t && t !== '—' && t !== '-' ? t : undefined;
}

export function fmList(data: Record<string, string | string[]>, key: string): string[] {
  const v = data[key];
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => x && x !== '—');
  return v
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x && x !== '—');
}

function cleanBold(b: string): string {
  return b.replace(/[\s:.,;]+$/, '').trim();
}

function finalizeItem(raw: string, ordered: boolean, depth: number, index: number): ListItem {
  const text = raw.trim();
  const m = text.match(/^\*\*(.+?)\*\*\s*[:.,]?\s*/);
  if (m) {
    return { text, bold: cleanBold(m[1]), rest: text.slice(m[0].length).trim(), ordered, depth, index };
  }
  return { text, rest: text, ordered, depth, index };
}

/** Parse bullet and numbered lists. Indented lines continue the previous item. */
export function parseListItems(text: string): ListItem[] {
  const items: ListItem[] = [];
  let cur: { raw: string; ordered: boolean; depth: number } | null = null;
  let index = 0;
  const flush = () => {
    if (cur) items.push(finalizeItem(cur.raw, cur.ordered, cur.depth, index++));
    cur = null;
  };
  for (const line of text.split('\n')) {
    const m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (m) {
      flush();
      const indent = m[1].replace(/\t/g, '  ').length;
      cur = { raw: m[3], ordered: /\d/.test(m[2]), depth: indent === 0 ? 0 : Math.max(1, Math.round(indent / 2)) };
    } else if (!line.trim()) {
      flush();
    } else if (cur && /^\s+\S/.test(line)) {
      (cur as { raw: string }).raw += ' ' + line.trim();
    } else {
      flush();
    }
  }
  flush();
  return items;
}

/** Split a markdown body into heading sections. The first H1 becomes the title. */
export function parseSections(body: string): { title?: string; intro?: string; sections: Section[] } {
  const sections: Section[] = [];
  let title: string | undefined;
  const intro: string[] = [];
  let cur: { heading: string; level: number; parent?: string; lines: string[] } | null = null;
  let lastL2: string | undefined;
  const push = () => {
    if (!cur) return;
    const bodyText = cur.lines.join('\n').trim();
    sections.push({ heading: cur.heading, level: cur.level, parent: cur.parent, body: bodyText, items: parseListItems(bodyText) });
    cur = null;
  };
  for (const line of body.split('\n')) {
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      const level = h[1].length;
      const heading = h[2].trim();
      if (level === 1 && title === undefined && sections.length === 0 && !cur) {
        title = heading;
        continue;
      }
      push();
      const parent = level > 2 ? lastL2 : undefined;
      if (level <= 2) lastL2 = heading;
      cur = { heading, level, parent, lines: [] };
    } else if (cur) {
      (cur as { lines: string[] }).lines.push(line);
    } else {
      intro.push(line);
    }
  }
  push();
  const introText = intro.join('\n').trim();
  return { title, intro: introText || undefined, sections };
}

export function parseDoc(raw: string): ParsedDoc {
  const md = normalizeMarkdown(raw);
  const { data, body } = parseFrontmatter(md);
  const { title, intro, sections } = parseSections(body);
  return { frontmatter: data, title, intro, sections };
}

export function findSection(sections: Section[], pattern: RegExp, level?: number): Section | undefined {
  return sections.find((s) => pattern.test(s.heading) && (level === undefined || s.level === level));
}

/** Plain text for display and search: drops emphasis markers and link syntax. */
export function stripInline(md: string): string {
  return (md ?? '')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|\W)\*(\S[^*]*?)\*(?=\W|$)/g, '$1$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pull a trailing `[tag]` (backtick-wrapped) off an item. */
export function extractTrailingTag(text: string): { tag?: string; before: string } {
  const m = text.match(/`\[([^`\]]*)\]`\s*\.?\s*$/);
  if (!m || m.index === undefined) return { before: text.trim() };
  return { tag: m[1].trim(), before: text.slice(0, m.index).trim() };
}

/** Small stable hash for ids. */
export function hashId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function firstWords(text: string, n: number): string {
  const words = stripInline(text).split(' ');
  return words.slice(0, n).join(' ') + (words.length > n ? '…' : '');
}

export function firstParagraph(text: string): string {
  const para = (text ?? '').split(/\n\s*\n/)[0] ?? '';
  return stripInline(para);
}
