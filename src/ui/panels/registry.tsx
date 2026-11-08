'use client';

import { useEffect, useRef, type ComponentType } from 'react';
import { closePanel, useStore } from '../store';
import { focus } from '../input/focus';
import { BriefingPanel, CalendarPanel, CheckoutPanel, DeadlinesPanel, DecisionsPanel, LanesPanel, LoopsPanel, OsPanel, PrioritiesPanel, SourcesPanel, WallPanel } from './command';
import { HandoffPanel, LanePanel } from './work';
import { CommsPanel, ComposePanel } from './comms';
import { ArchivePanel, DocPanel, SearchPanel } from './library';
import { AutomationsPanel } from './lab';
import { WarRoomPanel } from './warroom';
import { DreamBoardPanel, JournalPanel, QuietPanel, SurprisePanel, ThinkPanel } from './lounge';
import { ConfirmPersonalPanel, PersonalPanel } from './personal';
import { HelpPanel, MapPanel, MenuPanel, SettingsPanel, SetupPanel } from './core';
import { NpcPanel } from './npc';
import { VoicePanel } from './voice';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPanel = ComponentType<any>;

export const PANELS: Record<string, AnyPanel> = {
  // Command Center
  briefing: BriefingPanel,
  wall: WallPanel,
  checkout: CheckoutPanel,
  loops: LoopsPanel,
  priorities: PrioritiesPanel,
  calendar: CalendarPanel,
  deadlines: DeadlinesPanel,
  decisions: DecisionsPanel,
  lanes: LanesPanel,
  os: OsPanel,
  sources: SourcesPanel,
  // Work District
  lane: LanePanel,
  handoff: HandoffPanel,
  // Comms
  comms: CommsPanel,
  compose: ComposePanel,
  // Library
  archive: ArchivePanel,
  doc: DocPanel,
  search: SearchPanel,
  // Lab
  automations: AutomationsPanel,
  // War Room
  warroom: WarRoomPanel,
  // Upstairs
  dreamboard: DreamBoardPanel,
  surprise: SurprisePanel,
  think: ThinkPanel,
  journal: JournalPanel,
  quiet: QuietPanel,
  personal: PersonalPanel,
  'confirm-personal': ConfirmPersonalPanel,
  // System
  menu: MenuPanel,
  map: MapPanel,
  settings: SettingsPanel,
  help: HelpPanel,
  setup: SetupPanel,
  npc: NpcPanel,
  voice: VoicePanel,
};

/** Renders only the top panel. B (or Esc) closes it and reveals the one underneath. */
export function PanelHost() {
  const panels = useStore((s) => s.panels);
  const top = panels[panels.length - 1];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => focus.reconcile());
    });
    obs.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'data-autofocus'] });
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  const C = top ? PANELS[top.type] : null;
  return (
    <div ref={ref} className="panel-layer">
      {top && C ? <C key={top.key} {...(top.props ?? {})} /> : null}
      {top && !C ? <UnknownPanel type={top.type} /> : null}
    </div>
  );
}

function UnknownPanel({ type }: { type: string }) {
  useEffect(() => {
    console.warn('[hq] no panel registered for', type);
    closePanel();
  }, [type]);
  return null;
}
