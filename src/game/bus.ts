// Event bus between the Phaser world and the React interface.
type Handler = (payload: never) => void;

class Bus {
  private handlers = new Map<string, Set<Handler>>();

  on<T>(event: string, handler: (payload: T) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler);
    return () => set!.delete(handler as Handler);
  }

  emit<T>(event: string, payload?: T): void {
    this.handlers.get(event)?.forEach((h) => (h as (p: T | undefined) => void)(payload));
  }
}

export const bus = new Bus();

/** Shared, frame-polled input state written by the input router and read by the world. */
export const inputState = {
  moveX: 0,
  moveY: 0,
  run: false,
  /** 'game': the world gets input. 'ui': a panel is open. 'text': a text field has focus. */
  mode: 'game' as 'game' | 'ui' | 'text',
  device: 'keyboard' as 'keyboard' | 'gamepad' | 'touch',
};

export type GameButton = 'confirm' | 'cancel' | 'secondary' | 'prevRoom' | 'nextRoom';
