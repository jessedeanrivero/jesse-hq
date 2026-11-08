import { describe, expect, it } from 'vitest';
import { routeVoiceCommand, type RouteTarget } from '@/lib/shared/voice-commands';

const rooms: RouteTarget[] = [
  { id: 'command', label: 'Command Center', aliases: ['hq', 'home', 'headquarters'] },
  { id: 'warroom', label: 'Hawks War Room', aliases: ['war room', 'football', 'seahawks'] },
  { id: 'lane:widgetco', label: 'WidgetCo', aliases: ['widgetco', 'widgetco office', 'dev office'] },
  { id: 'lounge', label: 'Dream Lounge', aliases: ['lounge', 'dream room'] },
  { id: 'comms', label: 'Communications Hub', aliases: ['comms', 'communications', 'mail room'] },
];
const npcs: RouteTarget[] = [
  { id: 'archivist', label: 'Archivist', aliases: ['quill', 'librarian', 'the archivist'] },
  { id: 'chief', label: 'Chief of Staff', aliases: ['vesper', 'chief'] },
];
const route = (s: string) => routeVoiceCommand(s, { rooms, npcs });

describe('voice commands', () => {
  it('routes the documented phrases', () => {
    expect(route('Open Hawks War Room.')).toEqual({ type: 'travel', roomId: 'warroom', label: 'Hawks War Room' });
    expect(route('Show my open loops')).toMatchObject({ type: 'panel', panel: 'loops' });
    expect(route('Go to the WidgetCo office')).toMatchObject({ type: 'travel', roomId: 'lane:widgetco' });
    expect(route("Open today's checkout")).toMatchObject({ type: 'panel', panel: 'checkout' });
    expect(route('Talk to the Archivist')).toEqual({ type: 'talk', npcId: 'archivist', label: 'Talk to Archivist' });
  });
  it('handles search, compose, surprise and home', () => {
    expect(route('search for split sheet')).toMatchObject({ type: 'panel', panel: 'search', query: 'split sheet' });
    expect(route('compose an email to Robin')).toEqual({ type: 'compose', to: 'robin', label: 'Email to robin' });
    expect(route('surprise me')).toMatchObject({ panel: 'surprise' });
    expect(route('go home')).toMatchObject({ type: 'travel', roomId: 'command' });
    expect(route('please take me to the lounge')).toMatchObject({ type: 'travel', roomId: 'lounge' });
  });
  it('refuses what it does not know instead of guessing', () => {
    expect(route('what is the meaning of life')).toBeNull();
    expect(route('')).toBeNull();
  });
});
