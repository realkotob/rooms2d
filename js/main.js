//noinspection JSCheckFunctionSignatures,JSCheckFunctionSignatures,JSCheckFunctionSignatures
import MainGame from './game.js';

const config = {
  type: Phaser.AUTO,
  scale: {
    parent: 'game',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 600
  },
  backgroundColor: '#2e3136',
  // scene: [Boot, Preloader, MainMenu, MainGame],
  scene: [MainGame],
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  pixelArt: true // from https://www.html5gamedevs.com/topic/36343-disable-antialias-in-phaser-3/
};

let game = new Phaser.Game(config);