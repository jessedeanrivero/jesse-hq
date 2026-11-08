import Phaser from 'phaser';
import { RoomScene, type RoomData } from './RoomScene';

export function createGame(parent: HTMLElement, start: RoomData): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#05060a',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth || window.innerWidth, height: parent.clientHeight || window.innerHeight },
    physics: { default: 'arcade', arcade: { debug: false } },
    // Keyboard and gamepad are handled by the app's input router so panels and world never both react.
    input: { keyboard: false, gamepad: false, mouse: true, touch: true },
    audio: { noAudio: true },
    banner: false,
    fps: { target: 60 },
  });
  game.scene.add('room', RoomScene, true, start);
  return game;
}
