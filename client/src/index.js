//noinspection JSCheckFunctionSignatures,JSCheckFunctionSignatures,JSCheckFunctionSignatures
import MainGame from './game.js';
import Login from './login.js';
import Phaser from 'phaser';


const config = {
  type: Phaser.AUTO,
  scale: {
    parent: 'game',
    mode: Phaser.Scale.FIT, // Tried to use Resize but it wasn't good enough, might be better if I can get this example to work https://github.com/photonstorm/phaser3-examples/blob/master/public/src/scalemanager/resize%20and%20fit.js
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1068,
    height: 600
  },
  backgroundColor: '#2e3136',
  // scene: [Boot, Preloader, MainMenu, MainGame],
  scene: [Login, MainGame],
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  dom: {
    createContainer: true
  },
  pixelArt: true // from https://www.html5gamedevs.com/topic/36343-disable-antialias-in-phaser-3/
};

let game = new Phaser.Game(config);