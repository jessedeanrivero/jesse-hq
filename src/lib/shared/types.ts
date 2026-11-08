// Application-facing shapes. Everything here is derived from the user's own records at runtime.

export type Freshness = 'fresh' | 'recent' | 'stale' | 'unknown';

export type SourceKind =
  | 'daily'
  | 'loops'
  | 'os'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'identity'
  | 'health'
  | 'lenses'
  | 'relationships'
  | 'folder'
  | 'site'
  | 'calendar'
  | 'gmail'
  | 'other';

export interface SourceRef {
  kind: SourceKind;
  name: string;
  id?: string;
  url: string;
  modifiedTime?: string;
  /** YYYY-MM-DD the record is about (from its filename), when known */
  date?: string;
  freshness: Freshness;
}

export interface ListItem {
  text: string;
  /** Leading **bold** label, without trailing punctuation */
  bold?: string;
  /** Text after the bold label */
  rest: string;
  ordered: boolean;
  depth: number;
  index: number;
}

export interface Section {
  heading: string;
  level: number;
  parent?: string;
  body: string;
  items: ListItem[];
}

export interface ParsedDoc {
  frontmatter: Record<string, string | string[]>;
  title?: string;
  intro?: string;
  sections: Section[];
}

export type LoopStatus =
  | 'owed'
  | 'waiting'
  | 'scheduled'
  | 'decide'
  | 'active'
  | 'parked'
  | 'idea'
  | 'done'
  | 'decided'
  | 'standing'
  | 'watch'
  | 'warm'
  | 'info'
  | 'open';

export interface LoopItem {
  id: string;
  title: string;
  text: string;
  status: LoopStatus;
  /** Raw tag text inside `[...]`, e.g. "waiting on Sam · contract" */
  tag: string;
  tagParts: string[];
  /** Person whose turn it is, for waiting items */
  who?: string;
  section: string;
  laneId?: string;
  /** YYYY-MM-DD when a date could be read from the tag or text */
  due?: string;
  dueLabel?: string;
}

export interface LoopsSpine {
  updated?: string;
  note?: string;
  items: LoopItem[];
  sections: { heading: string; laneId?: string; count: number }[];
  next: LoopItem[];
  recentlyClosed: { label: string; items: string[] }[];
  killed: string[];
  source: SourceRef;
}

export interface MovedGroup {
  lane: string;
  items: string[];
}

export interface DailyCheckout {
  date?: string;
  day?: string;
  title?: string;
  lanes: string[];
  aim?: string;
  nudge?: string;
  priorNudgeLanded?: string;
  priorities: string[];
  decisions: { title: string; why: string }[];
  openLoops: LoopItem[];
  moved: MovedGroup[];
  signal?: string;
  coach?: string;
  syncNotes?: string;
  tags: string[];
  instrumentation?: string;
  /** Personal fields. Only ever returned by the personal endpoint. */
  personal: { energy?: string; health?: string; lineFlag?: boolean; priceSpend?: string; avoidance?: string; reading?: string };
  source: SourceRef;
}

export interface OsLane {
  id: string;
  note?: string;
  closed: boolean;
}

export interface OsDoc {
  updated?: string;
  changeSummary?: string;
  lanes: OsLane[];
  businesses: { name: string; text: string }[];
  laneMap: string[];
  weekPlan?: { title: string; days: string[] };
  allocation: { name: string; value: string; text: string }[];
  goals: string[];
  lifeDirection: string[];
  energy: string[];
  health: string[];
  sections: Section[];
  source: SourceRef;
}

export type RoomTheme =
  | 'devoffice'
  | 'writersroom'
  | 'studio'
  | 'workshop'
  | 'label'
  | 'archive'
  | 'broadcast'
  | 'office'
  | 'backstage'
  | 'generic';

export interface LaneLink {
  label: string;
  url: string;
  kind: 'found' | 'tool' | 'search';
}

export interface Lane {
  id: string;
  name: string;
  note?: string;
  closed: boolean;
  personal: boolean;
  theme: RoomTheme;
  description?: string;
  counts: Partial<Record<LoopStatus, number>>;
  openCount: number;
  waitingCount: number;
  loops: LoopItem[];
  recent: string[];
  decisions: { title: string; why: string }[];
  people: string[];
  links: LaneLink[];
  allocation?: string;
  schedule: string[];
  sections: string[];
}

export type IdeaCategory =
  | 'build'
  | 'music'
  | 'content'
  | 'community'
  | 'family'
  | 'game'
  | 'experience'
  | 'venture'
  | 'skill'
  | 'other';

export interface Idea {
  id: string;
  title: string;
  text: string;
  category: IdeaCategory;
  origin: 'loops' | 'os' | 'folder';
  status?: LoopStatus;
  date?: string;
  laneId?: string;
  source: SourceRef;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  calendar: string;
  location?: string;
  url?: string;
  meetUrl?: string;
}

export interface MailThread {
  id: string;
  from: string;
  fromEmail?: string;
  subject: string;
  date?: string;
  snippet: string;
  unread: boolean;
  url: string;
}

export interface DeadlineItem {
  title: string;
  date: string;
  label: string;
  laneId?: string;
  status?: LoopStatus;
  origin: 'loops' | 'checkout' | 'calendar';
}

export type ApiErrorCode =
  | 'not_configured'
  | 'not_signed_in'
  | 'forbidden'
  | 'missing_scope'
  | 'google_error'
  | 'not_found'
  | 'bad_request'
  | 'unavailable';

export interface ApiError {
  error: string;
  code: ApiErrorCode;
  detail?: string;
  setup?: string[];
}

export interface PartError {
  part: string;
  message: string;
  code?: ApiErrorCode;
}
