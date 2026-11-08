import { dateFromName } from './dates';
import { parseLoopItem, type ClassifyOptions } from './loops';
import { findSection, firstParagraph, fmList, fmString, normalizeMarkdown, parseFrontmatter, parseSections, stripInline } from './markdown';
import type { DailyCheckout, MovedGroup, SourceRef } from './types';

/** Parse a daily checkout file (YYYY-MM-DD.md) into the fixed-section shape the checkout writes. */
export function parseDailyCheckout(raw: string, source: SourceRef, today: string, opts: ClassifyOptions = {}): DailyCheckout {
  const md = normalizeMarkdown(raw);
  const { data, body } = parseFrontmatter(md);
  const { title, sections } = parseSections(body);

  const moved: MovedGroup[] = [];
  const movedSec = findSection(sections, /what moved/i);
  if (movedSec) {
    let current: MovedGroup | null = null;
    for (const line of movedSec.body.split('\n')) {
      const laneHead = line.match(/^\s*\*\*([^*]+)\*\*\s*:?\s*$/);
      if (laneHead) {
        current = { lane: laneHead[1].trim().toLowerCase(), items: [] };
        moved.push(current);
        continue;
      }
      const bullet = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
      if (bullet) {
        if (!current) {
          current = { lane: 'general', items: [] };
          moved.push(current);
        }
        current.items.push(stripInline(bullet[1]));
      } else if (current && current.items.length && /^\s+\S/.test(line)) {
        current.items[current.items.length - 1] += ' ' + stripInline(line);
      }
    }
  }

  const decisions = (findSection(sections, /decisions/i)?.items ?? []).map((it) => ({
    title: stripInline(it.bold ?? it.text),
    why: it.bold ? stripInline(it.rest) : '',
  }));

  const loopsSec = findSection(sections, /open loops/i);
  const openLoops = (loopsSec?.items ?? []).filter((it) => it.depth === 0).map((it) => parseLoopItem(it, 'Open loops (latest checkout)', today, opts));

  const priorities = (findSection(sections, /priorit/i)?.items ?? []).map((it) => stripInline(it.text));
  const aimSec = findSection(sections, /the aim|^aim/i);
  const signal = findSection(sections, /^signal/i);
  const coach = findSection(sections, /^coach/i);
  const sync = findSection(sections, /sync$/i);

  const lineFlag = fmString(data, 'line_flag');
  return {
    date: fmString(data, 'date') ?? dateFromName(source.name),
    day: fmString(data, 'day'),
    title,
    lanes: fmList(data, 'businesses').map((x) => x.toLowerCase()),
    aim: aimSec ? firstParagraph(aimSec.body) : undefined,
    nudge: fmString(data, 'nudge'),
    priorNudgeLanded: fmString(data, 'prior_nudge_landed'),
    priorities,
    decisions,
    openLoops,
    moved,
    signal: signal ? stripInline(signal.body) : undefined,
    coach: coach ? coach.body.trim() : undefined,
    syncNotes: sync ? sync.body.trim() : undefined,
    tags: fmList(data, 'tags'),
    instrumentation: fmString(data, 'instrumentation_note'),
    personal: {
      energy: fmString(data, 'energy'),
      health: fmString(data, 'health'),
      lineFlag: lineFlag ? /^true$/i.test(lineFlag) : undefined,
      priceSpend: fmString(data, 'price_spend'),
      avoidance: fmString(data, 'avoidance'),
      reading: fmString(data, 'reading'),
    },
    source,
  };
}

/** The checkout without personal advocacy and health fields, for shared screens. */
export function publicCheckout(c: DailyCheckout): DailyCheckout {
  return { ...c, personal: {} };
}
