'use client';

import dynamic from 'next/dynamic';

// The game touches window/canvas, so the whole app shell renders on the client only.
const HQApp = dynamic(() => import('./HQApp'), {
  ssr: false,
  loading: () => (
    <div className="boot-screen">
      <div className="boot-title">JESSE HQ</div>
      <div className="boot-sub">Opening the doors…</div>
    </div>
  ),
});

export default function HQRoot() {
  return <HQApp />;
}
