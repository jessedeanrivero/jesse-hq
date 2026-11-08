import Phaser from 'phaser';
import { audio } from './audio';
import { drawBackground, T } from './art/background';
import { PLAYER_LOOK, type Dir } from './art/characters';
import { THEMES } from './art/themes';
import { bus, inputState, type GameButton } from './bus';
import { ensureAnim, ensureBasics, ensureBuilding, ensureCharacter, ensureGlow, ensureSign, ensureSprite } from './textures';
import { buildRoom, type Action, type ObjDef, type RoomDef } from './world';
import { getBadges, getWorld } from './worldState';
import { npcById } from '@/npc/npcs';

export interface RoomData {
  roomId: string;
  spawn?: string;
  pos?: { x: number; y: number; dir?: Dir };
}

interface Target {
  kind: 'obj' | 'npc';
  id: string;
  label: string;
  verb: string;
  action?: Action;
  secondary?: { label: string; action: Action };
  x: number;
  y: number;
  topY: number;
  zone: Phaser.Geom.Rectangle;
  hit: Phaser.Geom.Rectangle;
}

interface NpcActor {
  id: string;
  key: string;
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  shadow: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Image;
  dir: Dir;
  wander?: { x: number; y: number; w: number; h: number };
  target?: { x: number; y: number };
  wait: number;
  talking: boolean;
  stuck: number;
}

const DIR_INDEX: Record<Dir, number> = { down: 0, left: 1, right: 2, up: 3 };

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class RoomScene extends Phaser.Scene {
  private def!: RoomDef;
  private data0!: RoomData;
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private playerShadow!: Phaser.GameObjects.Image;
  private facing: Dir = 'down';
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private targets: Target[] = [];
  private npcs: NpcActor[] = [];
  private current: Target | null = null;
  private pointer!: Phaser.GameObjects.Image;
  private travelling = false;
  private spawnGrace = 0;
  private lockedNoticeAt = 0;
  private unsubs: (() => void)[] = [];
  private lastSave = 0;
  private stepClock = 0;
  private click: { x: number; y: number; then?: Target } | null = null;
  private stuckMs = 0;
  private roomW = 0;
  private roomH = 0;

  constructor() {
    super('room');
  }

  init(data: RoomData): void {
    this.data0 = data;
    this.targets = [];
    this.npcs = [];
    this.current = null;
    this.travelling = false;
    this.click = null;
  }

  create(): void {
    ensureBasics(this);
    const world = getWorld();
    let def = buildRoom(this.data0.roomId, world);
    if (!def) def = buildRoom('command', world)!;
    this.def = def;
    const theme = THEMES[def.theme] ?? THEMES.generic;
    this.roomW = Math.max(...def.rows.map((r) => r.length)) * T;
    this.roomH = def.rows.length * T;

    // Background
    const bg = drawBackground(def.rows, theme, hashStr(def.id));
    if (def.decorate) def.decorate(bg.getContext('2d')!, this.roomW, this.roomH);
    const bgKey = `bg:${def.id}`;
    if (this.textures.exists(bgKey)) this.textures.remove(bgKey);
    this.textures.addCanvas(bgKey, bg);
    this.add.image(0, 0, bgKey).setOrigin(0).setDepth(-10);

    this.physics.world.setBounds(0, 0, this.roomW, this.roomH);
    this.solids = this.physics.add.staticGroup();
    this.buildWalls(def.rows);

    // Objects
    for (const obj of def.objects) this.addObject(obj);

    // Signs
    for (const s of def.signs) {
      const key = ensureSign(this, s.text, s.color, s.bg);
      this.add.image(Math.round(s.x), Math.round(s.y), key).setOrigin(0.5, 0).setDepth(3);
    }

    // Player
    const pkey = ensureCharacter(this, 'player', PLAYER_LOOK);
    const spawn = this.data0.pos ?? def.spawns[this.data0.spawn ?? 'default'] ?? def.spawns.default;
    this.facing = spawn.dir ?? 'down';
    this.player = this.physics.add.sprite(spawn.x, spawn.y, pkey, DIR_INDEX[this.facing] * 3).setOrigin(0.5, 1);
    this.player.body.setSize(10, 6).setOffset(3, 18);
    this.player.setCollideWorldBounds(true);
    this.playerShadow = this.add.image(spawn.x, spawn.y - 1, 'shadow').setDepth(spawn.y - 2);
    this.physics.add.collider(this.player, this.solids);

    // Coworkers
    for (const place of def.npcs) this.addNpc(place.id, place.x, place.y, place.dir ?? 'down', place.wander);

    this.pointer = this.add.image(0, 0, 'pointer').setDepth(9600).setVisible(false);

    // Lighting
    this.add.rectangle(0, 0, this.roomW, this.roomH, theme.ambient[0], theme.ambient[1]).setOrigin(0).setDepth(9000);
    this.addParticles(def.id);

    // Camera
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    this.fitCamera();
    cam.startFollow(this.player, true, 0.14, 0.14);
    cam.fadeIn(220, 5, 6, 10);
    this.scale.on('resize', this.fitCamera, this);

    // Input
    this.input.on('pointerdown', this.onPointer, this);
    this.unsubs.push(bus.on<GameButton>('input:action', (b) => this.onButton(b)));
    this.unsubs.push(bus.on<{ to: string; spawn?: string }>('ui:travel', (t) => this.travel(t.to, t.spawn)));
    this.unsubs.push(bus.on('ui:world', () => this.onWorldChanged()));
    this.unsubs.push(bus.on<string>('ui:npc-done', (id) => this.npcs.filter((n) => n.id === id).forEach((n) => (n.talking = false))));
    this.unsubs.push(bus.on('ui:badges', () => this.refreshBadges()));
    this.events.once('shutdown', () => {
      this.unsubs.forEach((u) => u());
      this.unsubs = [];
      this.scale.off('resize', this.fitCamera, this);
      this.input.off('pointerdown', this.onPointer, this);
    });

    this.spawnGrace = 450;
    audio.setAmbience(def.ambience);
    this.refreshBadges();
    bus.emit('game:room', {
      id: def.id,
      name: def.name,
      blurb: def.blurb,
      theme: def.theme,
      floor: def.floor,
      phoneOk: def.phoneOk,
      things: this.targets.filter((t) => t.kind === 'obj').map((t) => t.label),
      exits: def.exits.map((e) => e.label),
      size: { w: this.roomW, h: this.roomH },
    });
    this.savePosition(true);
  }

  private fitCamera(): void {
    const cam = this.cameras.main;
    if (!cam) return;
    const w = this.scale.width;
    const h = this.scale.height;
    // Keep the room clear of the HUD bar at the top and the prompt/hints at the bottom.
    const topPad = 56;
    const bottomPad = w < 700 ? 24 : 44;
    const zoom = Phaser.Math.Clamp(Math.floor(Math.min(w / 300, (h - topPad - bottomPad) / 215)), 2, 6);
    cam.setZoom(zoom);
    const vw = w / zoom;
    const vh = h / zoom;
    const tp = topPad / zoom;
    const bp = bottomPad / zoom;
    const usable = vh - tp - bp;
    const bx = this.roomW < vw ? -(vw - this.roomW) / 2 : 0;
    const by = this.roomH < usable ? -(tp + (usable - this.roomH) / 2) : -tp;
    const bh = this.roomH < usable ? vh : this.roomH + tp + bp;
    cam.setBounds(bx, by, Math.max(this.roomW, vw), bh);
  }

  private buildWalls(rows: string[]): void {
    for (let y = 0; y < rows.length; y++) {
      let x = 0;
      while (x < rows[y].length) {
        if (rows[y][x] === '#' || rows[y][x] === ' ') {
          let x2 = x;
          while (x2 < rows[y].length && (rows[y][x2] === '#' || rows[y][x2] === ' ')) x2++;
          const r = this.add.rectangle(x * T, y * T, (x2 - x) * T, T).setOrigin(0).setVisible(false);
          this.solids.add(r);
          x = x2;
        } else x++;
      }
    }
    this.solids.refresh();
  }

  private addObject(obj: ObjDef): void {
    let key: string;
    let frames = 1;
    let w: number;
    let h: number;
    if (obj.generated) {
      key = ensureBuilding(this, obj.generated.laneId, obj.generated.name, obj.generated.theme, !!obj.generated.locked);
      w = 80;
      h = 64;
    } else {
      const s = ensureSprite(this, obj.sprite, this.def.theme);
      key = s.key;
      frames = s.frames;
      w = s.w;
      h = s.h;
    }
    const sprite = this.add.sprite(Math.round(obj.x), Math.round(obj.y), key, 0).setOrigin(0.5, 1);
    if (obj.flipX) sprite.setFlipX(true);
    sprite.setDepth(obj.wall ? 1 + obj.y / 10000 : obj.y);
    if (frames > 1) sprite.play(ensureAnim(this, key, frames, obj.fps ?? 2));

    if (!obj.wall && obj.solid) {
      const sz = obj.solid === true ? { w: Math.max(6, w - 6), h: Math.min(12, Math.max(6, Math.floor(h / 3))) } : obj.solid;
      const r = this.add.rectangle(obj.x - sz.w / 2, obj.y - sz.h, sz.w, sz.h).setOrigin(0).setVisible(false);
      this.solids.add(r);
      this.solids.refresh();
    }
    if (obj.glow) {
      const g = this.add
        .image(obj.x, obj.y + (obj.glow.dy ?? -h / 2), ensureGlow(this, obj.glow.color))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(obj.glow.alpha ?? 0.4)
        .setScale((obj.glow.radius * 2) / 128)
        .setDepth(9001);
      if (obj.glow.flicker) this.tweens.add({ targets: g, alpha: (obj.glow.alpha ?? 0.4) * 0.72, duration: 160 + Math.random() * 220, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    if (obj.interact) {
      const zone = obj.wall
        ? new Phaser.Geom.Rectangle(obj.x - w / 2, obj.y - 6, w, 30)
        : new Phaser.Geom.Rectangle(obj.x - w / 2 - 10, obj.y - Math.min(h, 22) - 8, w + 20, Math.min(h, 22) + 26);
      this.targets.push({
        kind: 'obj',
        id: obj.id,
        label: obj.interact.label,
        verb: obj.interact.verb,
        action: obj.interact.action,
        secondary: obj.interact.secondary,
        x: obj.x,
        y: obj.y,
        topY: obj.y - h,
        zone,
        hit: new Phaser.Geom.Rectangle(obj.x - w / 2, obj.y - h, w, h),
      });
    }
  }

  private addNpc(id: string, x: number, y: number, dir: Dir, wander?: { x: number; y: number; w: number; h: number }): void {
    const def = npcById(id);
    if (!def) return;
    const key = ensureCharacter(this, `npc:${id}`, def.look);
    const sprite = this.physics.add.sprite(x, y, key, DIR_INDEX[dir] * 3).setOrigin(0.5, 1);
    sprite.body.setSize(10, 6).setOffset(3, 18);
    sprite.body.setImmovable(true);
    sprite.setCollideWorldBounds(true);
    this.physics.add.collider(sprite, this.solids);
    this.physics.add.collider(this.player, sprite);
    const shadow = this.add.image(x, y - 1, 'shadow');
    const badge = this.add.image(x, y - 30, 'bang').setVisible(false).setDepth(9500);
    this.tweens.add({ targets: badge, y: '-=3', duration: 380, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const actor: NpcActor = { id, key, sprite, shadow, badge, dir, wander, wait: 1000 + Math.random() * 2000, talking: false, stuck: 0 };
    this.npcs.push(actor);
    this.targets.push({
      kind: 'npc',
      id,
      label: `${def.name}, ${def.role}`,
      verb: 'Talk',
      x,
      y,
      topY: y - 24,
      zone: new Phaser.Geom.Rectangle(x - 22, y - 30, 44, 44),
      hit: new Phaser.Geom.Rectangle(x - 8, y - 24, 16, 24),
    });
  }

  private refreshBadges(): void {
    const b = getBadges();
    for (const n of this.npcs) n.badge.setVisible(!!b[n.id]);
  }

  private addParticles(roomId: string): void {
    const motes = (count: number, area: { x: number; y: number; w: number; h: number }, color: number, rise: boolean) => {
      for (let i = 0; i < count; i++) {
        const m = this.add
          .image(area.x + Math.random() * area.w, area.y + Math.random() * area.h, 'mote')
          .setTint(color)
          .setAlpha(0)
          .setScale(0.5)
          .setDepth(9002)
          .setBlendMode(Phaser.BlendModes.ADD);
        const loop = () => {
          m.setPosition(area.x + Math.random() * area.w, area.y + Math.random() * area.h).setAlpha(0);
          this.tweens.add({
            targets: m,
            x: m.x + (Math.random() - 0.5) * 24,
            y: m.y + (rise ? -18 - Math.random() * 20 : (Math.random() - 0.5) * 20),
            alpha: { from: 0, to: 0.9 },
            duration: 1400 + Math.random() * 1800,
            yoyo: !rise,
            ease: 'Sine.inOut',
            onComplete: loop,
          });
        };
        this.time.delayedCall(Math.random() * 2000, loop);
      }
    };
    if (roomId === 'lounge') motes(10, { x: 11 * T - 10, y: 1 * T + 24, w: 40, h: 10 }, 0xffa040, true);
    if (roomId === 'garden') motes(14, { x: 16, y: 40, w: this.roomW - 32, h: this.roomH - 60 }, 0xd8ff7a, false);
    if (roomId === 'library') motes(8, { x: 40, y: 40, w: this.roomW - 80, h: this.roomH - 80 }, 0xffe0a0, false);
    if (roomId === 'warroom') motes(6, { x: 7 * T, y: 3 * T, w: 6 * T, h: 2 * T }, 0xb8f28c, false);
  }

  private onWorldChanged(): void {
    if (this.travelling) return;
    const id = this.def.id;
    if (id === 'work' || id.startsWith('lane:') || id === 'hall') {
      this.scene.restart({ roomId: id, pos: { x: this.player.x, y: this.player.y, dir: this.facing } });
    }
  }

  travel(to: string, spawn?: string): void {
    if (this.travelling) return;
    const dest = buildRoom(to, getWorld());
    if (!dest) {
      bus.emit('game:notice', { text: 'That room is not available yet.', tone: 'warn' });
      audio.sfx('error');
      return;
    }
    const w = getWorld();
    if (w.phoneMode && !dest.phoneOk && !(to.startsWith('lane:') && w.phoneLanes.includes(to.slice(5)))) {
      bus.emit('game:notice', { text: `${dest.name} is laptop-only while phone mode is on.`, tone: 'warn' });
      audio.sfx('error');
      return;
    }
    this.travelling = true;
    this.player.setVelocity(0, 0);
    audio.sfx('door');
    bus.emit('game:travel', { from: this.def.id, to });
    this.cameras.main.fadeOut(200, 5, 6, 10);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ roomId: to, spawn: spawn ?? 'default' });
    });
  }

  private onButton(b: GameButton): void {
    if (this.travelling || inputState.mode !== 'game') return;
    if (b === 'confirm' && this.current) this.interact(this.current, false);
    else if (b === 'secondary' && this.current) this.interact(this.current, true);
  }

  private interact(t: Target, secondary: boolean): void {
    if (t.kind === 'npc' && !secondary) {
      const actor = this.npcs.find((n) => n.id === t.id);
      if (actor) {
        actor.talking = true;
        actor.sprite.setVelocity(0, 0);
        const dx = this.player.x - actor.sprite.x;
        const dy = this.player.y - actor.sprite.y;
        actor.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        actor.sprite.anims.stop();
        actor.sprite.setFrame(DIR_INDEX[actor.dir] * 3);
      }
      audio.sfx('blip');
      bus.emit('game:npc', { npcId: t.id });
      return;
    }
    const action = secondary ? t.secondary?.action : t.action;
    if (!action) {
      audio.sfx('error');
      return;
    }
    audio.sfx('blip');
    if (action.type === 'travel') return this.travel(action.to, action.spawn);
    if (action.type === 'music') {
      const on = audio.toggleMusic();
      bus.emit('game:notice', { text: on ? 'Lounge music on' : 'Lounge music off' });
      bus.emit('game:music', on);
      return;
    }
    bus.emit('game:interact', { action, objectId: t.id, roomId: this.def.id, label: secondary ? t.secondary?.label : t.label });
  }

  private onPointer(p: Phaser.Input.Pointer): void {
    if (inputState.mode !== 'game' || this.travelling) return;
    const wx = p.worldX;
    const wy = p.worldY;
    const hit = [...this.targets].reverse().find((t) => t.hit.contains(wx, wy) || t.zone.contains(wx, wy));
    if (hit) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, hit.x, hit.y);
      if (d < 40 || hit.zone.contains(this.player.x, this.player.y)) {
        this.interact(hit, false);
        return;
      }
      this.click = { x: hit.zone.centerX, y: Math.min(this.roomH - T - 2, hit.zone.bottom - 4), then: hit };
    } else this.click = { x: wx, y: wy };
    this.stuckMs = 0;
  }

  update(_time: number, delta: number): void {
    if (!this.player?.body) return;
    this.spawnGrace = Math.max(0, this.spawnGrace - delta);
    let mx = 0;
    let my = 0;
    const active = inputState.mode === 'game' && !this.travelling;
    if (active) {
      mx = inputState.moveX;
      my = inputState.moveY;
      if (mx !== 0 || my !== 0) this.click = null;
      else if (this.click) {
        const dx = this.click.x - this.player.x;
        const dy = this.click.y - this.player.y;
        const d = Math.hypot(dx, dy);
        const reach = this.click.then ? this.click.then.zone.contains(this.player.x, this.player.y) : d < 3;
        if (reach) {
          const then = this.click.then;
          this.click = null;
          if (then) this.interact(then, false);
        } else {
          mx = dx / d;
          my = dy / d;
        }
      }
    }
    const mag = Math.min(1, Math.hypot(mx, my));
    const speed = (inputState.run ? 150 : 88) * (mag > 0 ? Math.max(0.45, mag) : 0);
    if (mag > 0) {
      const nx = mx / Math.hypot(mx, my);
      const ny = my / Math.hypot(mx, my);
      this.player.setVelocity(nx * speed, ny * speed);
      this.facing = Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'right' : 'left') : ny > 0 ? 'down' : 'up';
      this.player.anims.play(`player-walk-${this.facing}`, true);
      if (this.player.anims.currentAnim) this.player.anims.timeScale = inputState.run ? 1.6 : 1;
      this.stepClock += delta;
      if (this.stepClock > (inputState.run ? 210 : 300)) {
        this.stepClock = 0;
        audio.sfx('step');
      }
      if (this.click) {
        const moving = this.player.body.velocity.length() > 10 && (Math.abs(this.player.body.deltaX()) + Math.abs(this.player.body.deltaY()) > 0.2);
        this.stuckMs = moving ? 0 : this.stuckMs + delta;
        if (this.stuckMs > 350) this.click = null;
      }
    } else {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.player.setFrame(DIR_INDEX[this.facing] * 3);
    }
    this.player.setDepth(this.player.y);
    this.playerShadow.setPosition(this.player.x, this.player.y - 1).setDepth(this.player.y - 2);

    this.updateNpcs(delta);
    this.updateTarget();
    if (active && this.spawnGrace <= 0) this.checkExits(mx, my);

    this.lastSave += delta;
    if (this.lastSave > 1200) this.savePosition(false);
  }

  private updateNpcs(delta: number): void {
    for (const n of this.npcs) {
      const s = n.sprite;
      const nearPlayer = Phaser.Math.Distance.Between(s.x, s.y, this.player.x, this.player.y) < 34;
      if (n.talking || nearPlayer) {
        s.setVelocity(0, 0);
        const dx = this.player.x - s.x;
        const dy = this.player.y - s.y;
        n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        s.anims.stop();
        s.setFrame(DIR_INDEX[n.dir] * 3);
      } else if (n.wander) {
        if (!n.target) {
          n.wait -= delta;
          if (n.wait <= 0) {
            n.target = { x: n.wander.x + 8 + Math.random() * (n.wander.w - 16), y: n.wander.y + 12 + Math.random() * (n.wander.h - 12) };
            n.stuck = 0;
          } else {
            s.setVelocity(0, 0);
            s.anims.stop();
            s.setFrame(DIR_INDEX[n.dir] * 3);
          }
        }
        if (n.target) {
          const dx = n.target.x - s.x;
          const dy = n.target.y - s.y;
          const d = Math.hypot(dx, dy);
          if (d < 3 || n.stuck > 600) {
            n.target = undefined;
            n.wait = 1800 + Math.random() * 3800;
            s.setVelocity(0, 0);
          } else {
            s.setVelocity((dx / d) * 34, (dy / d) * 34);
            n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
            s.anims.play(`${n.key}-walk-${n.dir}`, true);
            const moved = Math.abs(s.body.deltaX()) + Math.abs(s.body.deltaY());
            n.stuck = moved < 0.05 ? n.stuck + delta : 0;
          }
        }
      }
      s.setDepth(s.y);
      n.shadow.setPosition(s.x, s.y - 1).setDepth(s.y - 2);
      n.badge.setPosition(s.x, n.badge.y + (s.y - 30 - n.badge.y) * 0.3);
      n.badge.x = s.x;
      const t = this.targets.find((x) => x.kind === 'npc' && x.id === n.id);
      if (t) {
        t.x = s.x;
        t.y = s.y;
        t.topY = s.y - 24;
        t.zone.setPosition(s.x - 22, s.y - 30);
        t.hit.setPosition(s.x - 8, s.y - 24);
      }
    }
  }

  private updateTarget(): void {
    const fx = this.player.x + (this.facing === 'left' ? -12 : this.facing === 'right' ? 12 : 0);
    const fy = this.player.y - 3 + (this.facing === 'up' ? -12 : this.facing === 'down' ? 10 : 0);
    let best: Target | null = null;
    let bestD = Infinity;
    for (const t of this.targets) {
      if (!t.zone.contains(fx, fy) && !t.zone.contains(this.player.x, this.player.y - 3)) continue;
      const d = Phaser.Math.Distance.Between(fx, fy, t.x, t.y - 6);
      const bias = t.kind === 'npc' ? -8 : 0;
      if (d + bias < bestD) {
        bestD = d + bias;
        best = t;
      }
    }
    if (best !== this.current) {
      this.current = best;
      bus.emit('game:prompt', best ? { verb: best.verb, label: best.label, secondary: best.secondary?.label, kind: best.kind } : null);
    }
    if (best) this.pointer.setVisible(true).setPosition(best.x, Math.max(4, best.topY - 7) + Math.round(Math.sin(this.time.now / 140) * 1.5));
    else this.pointer.setVisible(false);
  }

  private checkExits(mx: number, my: number): void {
    const px = this.player.x;
    const py = this.player.y - 2;
    for (const e of this.def.exits) {
      if (px < e.x || px > e.x + e.w || py < e.y || py > e.y + e.h + 4) continue;
      const ok =
        e.dir === 'any' ||
        (e.dir === 'up' && my < -0.3) ||
        (e.dir === 'down' && my > 0.3) ||
        (e.dir === 'left' && mx < -0.3) ||
        (e.dir === 'right' && mx > 0.3);
      if (!ok) continue;
      if (e.locked) {
        if (this.time.now - this.lockedNoticeAt > 2500) {
          this.lockedNoticeAt = this.time.now;
          bus.emit('game:notice', { text: e.locked, tone: 'warn' });
          audio.sfx('error');
        }
        return;
      }
      this.travel(e.to, e.spawn);
      return;
    }
  }

  private savePosition(force: boolean): void {
    this.lastSave = 0;
    if (!this.player) return;
    bus.emit('game:position', { room: this.def.id, x: Math.round(this.player.x), y: Math.round(this.player.y), dir: this.facing, force });
  }
}
