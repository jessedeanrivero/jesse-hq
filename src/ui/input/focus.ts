// Spatial "virtual focus" for controller and arrow-key navigation inside panels.
// Buttons and links get clicked; text fields receive real DOM focus so OS dictation works.

const SEL = '[data-nav]:not([disabled]):not([aria-hidden="true"])';

function topRoot(): HTMLElement | null {
  const roots = document.querySelectorAll<HTMLElement>('[data-panel-root]');
  return roots.length ? roots[roots.length - 1] : null;
}

/** Is the element inside the visible part of its scrolling panel body (or outside any scroller)? */
function inView(el: HTMLElement): boolean {
  const scroller = el.closest<HTMLElement>('[data-scroll]');
  if (!scroller) return true;
  const a = el.getBoundingClientRect();
  const b = scroller.getBoundingClientRect();
  return a.bottom > b.top + 4 && a.top < b.bottom - 4;
}

function visible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

export function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color'].includes(el.type);
  return (el as HTMLElement).isContentEditable;
}

class FocusManager {
  current: HTMLElement | null = null;

  items(): HTMLElement[] {
    const root = topRoot();
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(SEL)).filter(visible);
  }

  set(el: HTMLElement | null, scroll = true): void {
    if (this.current === el) return;
    this.current?.classList.remove('vfocus');
    this.current = el;
    if (el) {
      el.classList.add('vfocus');
      if (scroll) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  /** The first enabled, visible element marked data-autofocus in the top panel. */
  preferred(items = this.items()): HTMLElement | null {
    const root = topRoot();
    if (!root) return null;
    return Array.from(root.querySelectorAll<HTMLElement>('[data-autofocus]')).find((el) => items.includes(el)) ?? null;
  }

  ensure(): HTMLElement | null {
    const items = this.items();
    if (this.current && items.includes(this.current) && document.contains(this.current)) return this.current;
    // Pick automatically without scrolling, so a panel always opens at the top of its content.
    this.set(this.defaultPick(items), false);
    return this.current;
  }

  /**
   * The element focus starts on: the panel's autofocus element if it's on screen, otherwise the first visible
   * thing in the panel body, otherwise the footer. Close is the last resort (B already closes).
   */
  private defaultPick(items: HTMLElement[]): HTMLElement | null {
    const pref = this.preferred(items);
    if (pref && inView(pref)) return pref;
    const body = items.find((el) => !!el.closest('[data-scroll]') && inView(el));
    const foot = items.find((el) => !!el.closest('.panel-foot'));
    return body ?? foot ?? pref ?? items[0] ?? null;
  }

  /**
   * Called when panel content changes (data loaded, a confirm step appeared). Keeps focus on
   * something that exists, and moves off the Close button once real content arrives.
   */
  reconcile(): void {
    const root = topRoot();
    if (!root) return;
    const cur = this.current;
    if (!cur || !document.contains(cur) || !root.contains(cur) || (cur as HTMLButtonElement).disabled) {
      this.set(null);
      this.ensure();
      return;
    }
    if (cur.classList.contains('panel-close')) {
      const next = this.defaultPick(this.items());
      if (next && next !== cur) this.set(next, false);
    }
  }

  clear(): void {
    this.set(null);
  }

  move(dir: 'up' | 'down' | 'left' | 'right'): boolean {
    const cur = this.ensure();
    const items = this.items();
    if (!cur) return false;
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const b = el.getBoundingClientRect();
      const bx = b.left + b.width / 2;
      const by = b.top + b.height / 2;
      const dx = bx - ax;
      const dy = by - ay;
      let primary: number;
      let cross: number;
      if (dir === 'up') {
        if (b.bottom > a.top + 2 && dy >= -2) continue;
        primary = -dy;
        cross = Math.abs(dx);
      } else if (dir === 'down') {
        if (b.top < a.bottom - 2 && dy <= 2) continue;
        primary = dy;
        cross = Math.abs(dx);
      } else if (dir === 'left') {
        if (dx >= -2) continue;
        primary = -dx;
        cross = Math.abs(dy);
      } else {
        if (dx <= 2) continue;
        primary = dx;
        cross = Math.abs(dy);
      }
      if (primary <= 0) continue;
      const score = primary + cross * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (!best && (dir === 'down' || dir === 'up')) {
      // Wrap within the list as a last resort.
      const idx = items.indexOf(cur);
      best = dir === 'down' ? items[idx + 1] ?? null : items[idx - 1] ?? null;
    }
    if (best) this.set(best);
    return !!best;
  }

  activate(): void {
    const el = this.ensure();
    if (!el) return;
    if (isTextField(el)) {
      el.focus();
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const len = el.value.length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          // not all inputs support selection
        }
      }
      return;
    }
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      el.click();
      return;
    }
    if (el instanceof HTMLInputElement && el.type === 'range') {
      el.focus();
      return;
    }
    el.click();
  }

  /** Adjust a focused slider with left/right. Returns true if handled. */
  adjust(delta: number): boolean {
    const el = this.current;
    if (el instanceof HTMLInputElement && el.type === 'range') {
      const step = Number(el.step || 1) || 1;
      const v = Math.min(Number(el.max || 100), Math.max(Number(el.min || 0), Number(el.value) + delta * step));
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  }

  tab(delta: number): boolean {
    const root = topRoot();
    if (!root) return false;
    const tabs = Array.from(root.querySelectorAll<HTMLElement>('[data-tab]')).filter(visible);
    if (!tabs.length) return false;
    const idx = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'));
    const next = tabs[(idx + delta + tabs.length) % tabs.length];
    next.click();
    window.setTimeout(() => this.set(next), 0);
    return true;
  }

  secondary(): boolean {
    const el = this.ensure();
    const target = el?.closest<HTMLElement>('[data-secondary-target]')?.querySelector<HTMLElement>('[data-secondary]') ?? topRoot()?.querySelector<HTMLElement>('[data-secondary]');
    if (target) {
      target.click();
      return true;
    }
    return false;
  }

  scroll(dy: number): void {
    const root = topRoot();
    const el = (this.current?.closest('[data-scroll]') as HTMLElement | null) ?? root?.querySelector<HTMLElement>('[data-scroll]');
    el?.scrollBy({ top: dy });
  }
}

export const focus = new FocusManager();
