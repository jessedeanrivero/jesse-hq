import { findSection, fmString, normalizeMarkdown, parseFrontmatter, parseSections, stripInline } from './markdown';
import type { OsDoc, OsLane, Section, SourceRef } from './types';

/** Split "a, b (note, with comma), c." on top-level commas. */
export function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

export function parseLaneList(text: string): OsLane[] {
  const flat = stripInline(text.replace(/\n/g, ' '));
  const lanes: OsLane[] = [];
  for (const token of splitTopLevel(flat)) {
    const m = token.replace(/\.$/, '').match(/^([a-z0-9][a-z0-9-]*)\s*(?:\((.*)\))?$/i);
    if (!m) continue;
    const id = m[1].toLowerCase();
    if (lanes.some((l) => l.id === id)) continue;
    const note = m[2]?.trim();
    lanes.push({ id, note, closed: !!note && /\bclosed\b/i.test(note) });
  }
  return lanes;
}

function itemsText(sec?: Section, depth?: number): string[] {
  if (!sec) return [];
  return sec.items.filter((it) => depth === undefined || it.depth === depth).map((it) => stripInline(it.text));
}

/** Parse the current operating-system file. */
export function parseOsDoc(raw: string, source: SourceRef): OsDoc {
  const md = normalizeMarkdown(raw);
  const { data, body } = parseFrontmatter(md);
  const { sections } = parseSections(body);

  const laneSec = findSection(sections, /^lanes\b/i);
  const lanes = laneSec ? parseLaneList(laneSec.items.length ? laneSec.items.map((i) => i.text).join(', ') : laneSec.body) : [];

  const bizSec = findSection(sections, /businesses|where they stand/i);
  const businesses = (bizSec?.items ?? [])
    .filter((it) => it.depth === 0 && it.bold)
    .map((it) => ({ name: (it.bold ?? '').replace(/[.,:]+$/, ''), text: stripInline(it.rest) }));

  const laneMap = itemsText(findSection(sections, /lane map/i), 0);

  const weekSec = sections.find((s) => /^week of\b/i.test(s.heading));
  const weekPlan = weekSec ? { title: weekSec.heading, days: itemsText(weekSec) } : undefined;

  const allocation: OsDoc['allocation'] = [];
  for (const s of sections) {
    for (const it of s.items) {
      const m = (it.bold ?? '').match(/^(.+?)\s*=\s*(.+?)$/);
      if (m && it.depth > 0) allocation.push({ name: m[1].trim(), value: m[2].replace(/\.$/, '').trim(), text: stripInline(it.rest) });
    }
  }

  return {
    updated: fmString(data, 'updated'),
    changeSummary: fmString(data, 'change_summary'),
    lanes,
    businesses,
    laneMap,
    weekPlan,
    allocation,
    goals: itemsText(findSection(sections, /^goals/i)),
    lifeDirection: itemsText(findSection(sections, /life direction/i)),
    energy: itemsText(findSection(sections, /energy/i)),
    health: itemsText(findSection(sections, /^health/i)),
    sections,
    source,
  };
}

/** The OS file minus personal sections, for shared screens. */
export function publicOs(os: OsDoc): OsDoc {
  const personal = /health|energy|goals|life direction|identity|line/i;
  return {
    ...os,
    health: [],
    energy: [],
    goals: [],
    lifeDirection: [],
    sections: os.sections.filter((s) => !personal.test(s.heading) && !personal.test(s.parent ?? '')),
  };
}
