'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { isTouchFirst, useStore } from './store';
import { pressButton, setTouchStick } from './input/active';
import { voiceStart, voiceStop } from './panels/voice';

const RADIUS = 46;

/** On-screen stick and buttons for phones and tablets. Hidden while a panel is open. */
export function TouchControls() {
  const device = useStore((s) => s.device);
  const panelOpen = useStore((s) => s.panels.length > 0);
  const voiceOn = useStore((s) => s.settings.voiceCommands);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);

  if (!(device === 'touch' || isTouchFirst()) || panelOpen) return null;

  const update = (e: PointerEvent<HTMLDivElement>) => {
    const r = base.current?.getBoundingClientRect();
    if (!r) return;
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    const nx = dx / RADIUS;
    const ny = dy / RADIUS;
    const mag = Math.hypot(nx, ny);
    setTouchStick(mag < 0.18 ? 0 : nx, mag < 0.18 ? 0 : ny, true);
  };

  const end = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    setTouchStick(0, 0, false);
  };

  return (
    <div className="touch-ui">
      <div
        ref={base}
        className="stick"
        onPointerDown={(e) => {
          e.preventDefault();
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e);
        }}
        onPointerMove={(e) => {
          if (pointer.current === e.pointerId) update(e);
        }}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label="Move"
        role="application"
      >
        <div className="stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="touch-buttons">
        {voiceOn && (
          <button
            className="tbtn tbtn-voice"
            aria-label="Hold to speak a command"
            onPointerDown={(e) => {
              e.preventDefault();
              voiceStart();
            }}
            onPointerUp={() => voiceStop()}
            onPointerCancel={() => voiceStop()}
          >
            🎙️
          </button>
        )}
        <button
          className="tbtn tbtn-x"
          aria-label="Secondary action"
          onPointerDown={(e) => {
            e.preventDefault();
            pressButton('X');
          }}
        >
          X
        </button>
        <button
          className="tbtn tbtn-a"
          aria-label="Interact"
          onPointerDown={(e) => {
            e.preventDefault();
            pressButton('A');
          }}
        >
          A
        </button>
      </div>
    </div>
  );
}
