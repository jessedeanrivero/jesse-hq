// Local-only check against real files kept OUTSIDE the repo (never committed).
// Skips automatically when the private fixture folder is absent (CI, Vercel, anyone else).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLoopsSpine, countByStatus } from '@/lib/shared/loops';
import { ideasFromLoops } from '@/lib/shared/ideas';

const DIR = process.env.HQ_PRIVATE_FIXTURES ?? '/home/claude/private-fixtures';
const loopsPath = `${DIR}/loops-latest.raw.md`;
const has = existsSync(loopsPath);

describe.skipIf(!has)('real loops spine (local only)', () => {
  it('parses the escaped Drive text into structured loops', () => {
    const raw = readFileSync(loopsPath, 'utf8');
    const spine = parseLoopsSpine(raw, { kind: 'loops', name: 'loops-latest.md', url: 'x', freshness: 'fresh' }, '2026-11-08', { ownerNames: ['jesse'] });
    const counts = countByStatus(spine.items);
    // Shape only, no content is printed.
    console.log('sections', spine.sections.length, 'items', spine.items.length, 'next', spine.next.length, 'closed groups', spine.recentlyClosed.length, 'killed', spine.killed.length);
    console.log('status counts', JSON.stringify(counts));
    console.log('ideas', ideasFromLoops(spine, '2026-11-08').length, 'with due dates', spine.items.filter((i) => i.due).length);
    expect(spine.items.length).toBeGreaterThan(300);
    expect(spine.next.length).toBeGreaterThan(5);
    expect((counts.owed ?? 0) + (counts.waiting ?? 0)).toBeGreaterThan(50);
    expect(counts.open ?? 0).toBeLessThan(spine.items.length * 0.25);
  });
});

const osPath = `${DIR}/os-latest.raw.md`;

describe.skipIf(!existsSync(osPath) || !has)('real OS file + lane registry (local only)', () => {
  it('finds the lanes, their names and room themes', async () => {
    const { parseOsDoc } = await import('@/lib/shared/osdoc');
    const { buildLaneRegistry } = await import('@/lib/shared/lanes');
    const src = { kind: 'os' as const, name: 'os.md', url: 'x', freshness: 'fresh' as const };
    const os = parseOsDoc(readFileSync(osPath, 'utf8'), src);
    const spine = parseLoopsSpine(readFileSync(loopsPath, 'utf8'), { ...src, kind: 'loops' }, '2026-11-08', { ownerNames: ['jesse'] });
    const lanes = buildLaneRegistry({ os, loops: spine, daily: null });
    // Printed locally only; this output is never committed.
    console.log('os.updated', os.updated, 'allocation', os.allocation.length, 'laneMap', os.laneMap.length, 'weekPlan', os.weekPlan?.days.length);
    for (const l of lanes) console.log(`lane ${l.id} | ${l.name} | ${l.theme} | closed=${l.closed} personal=${l.personal} open=${l.openCount} waiting=${l.waitingCount}`);
    expect(lanes.length).toBeGreaterThanOrEqual(8);
  });
});
