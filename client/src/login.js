const COLOR_PRIMARY = 0x4e342e;
const COLOR_LIGHT = 0x7b5e57;
const COLOR_DARK = 0x260e04;
import Phaser from 'phaser';

import login_form from './assets/html/loginform.html';
import r_pixel from './assets/sprites/pixel.png';
import r_tilesheet from './assets/map/tilesheet.png';
import r_map from './assets/map/example_map.json';

export default class Login extends Phaser.Scene {
  constructor() {
    super();
  }

  preload() {
    // console.log("Login form HTML %s", login_form);
    // this.load.html('nameform', login_form);

    this.load.image('user', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/assets/images/person.png');
    this.load.image('password', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/assets/images/key.png');
    // this.load.image('user', 'js/rex-notes/assets/images/person.png');
    // this.load.image('password', 'js/rex-notes/assets/images/key.png');

    this.load.tilemapTiledJSON('map', r_map);
    this.load.image('tilesheet', r_tilesheet);
    this.load.image('pixel', r_pixel);
  }

  create() {
    const self = this;

    this.add_map_bg();

    let _room_name = "/r/ general";
    let pos = window.location.pathname.indexOf('/r/');
    if (pos !== -1) {
      let subname = window.location.pathname.slice(pos + 3);
      _room_name = subname ? '/r/ ' + subname : _room_name;
    }


    let form_element = this.add.dom(450, 800).createFromHTML(login_form);
    form_element.addListener('click');
    form_element.setPerspective(800);
    form_element.on('click', function (event) {

      if (event.target.name === 'loginButton') {
        var inputUsername = this.getChildByName('username');
        var inputPassword = this.getChildByName('password');

        //  Have they entered anything?
        if (inputUsername.value !== '') { //&& inputPassword.value !== '') {
          //  Turn off the click events
          this.removeListener('click');

          //  Tween the login form out
          this.scene.tweens.add({ targets: form_element.rotate3d, x: 1, w: 90, duration: 500, ease: 'Power3' });

          this.scene.tweens.add({
            targets: form_element, scaleX: 2, scaleY: 2, y: 0, duration: 500, ease: 'Power3',
            onComplete: function () {
              form_element.setVisible(false);
              self.scene.switch('MainGame');
            }
          });

          //  Populate the text with whatever they typed in as the username!
          // text.setText('Welcome ' + inputUsername.value);
          localStorage.setItem("username", inputUsername.value);
          localStorage.setItem("password", inputPassword.value);
          console.log('Welcome ' + inputUsername.value);
        }
        else {
          //  Flash the prompt
          this.scene.tweens.add({ targets: text, alpha: 0.1, duration: 200, ease: 'Power3', yoyo: true });
        }
      }

    });

    this.tweens.add({
      targets: form_element,
      y: 330,
      duration: 500,
      ease: 'Power3'
    });



    // let print = this.add.text(0, 0, '');

    // let loginDialog = CreateLoginDialog(this, {
    //   x: 400,
    //   y: 300,
    //   title: _room_name,
    //   default_username: localStorage.getItem("username"),
    //   default_password: '',
    // })
    //   .on('login', function (username, password) {
    //     print.text += `${username}:${password}\n`;
    //   })
    //   //.drawBounds(this.add.graphics(), 0xff0000);
    //   .popUp(500);

    // this.add.text(0, 560, 'Click user name or password field to edit it\nClick Login button to show user name and password');


  }

  update() { }


  add_map_bg() {
    let map = this.make.tilemap({ key: 'map', tileWidth: 32, tileHeight: 32 });
    let tileset = map.addTilesetImage('tilesheet');
    let layer;
    for (let i = 0; i < map.layers.length; i++) {
      layer = map.createLayer(i, tileset);
      if (layer.layer.name == "collision") {
        layer.visible = false;
      }
    }

    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.zoom = 1.5;
    this.bg_dim = this.add.tileSprite(
      map.widthInPixels / 2, map.heightInPixels / 2, map.widthInPixels, map.heightInPixels, 'pixel').setAlpha(0.2);
    this.bg_dim.setTint(0x000000);
  }

}

const GetValue = Phaser.Utils.Objects.GetValue;
var CreateLoginDialog = function (scene, config, onSubmit) {
  let username = GetValue(config, 'default_username', '');
  let password = GetValue(config, 'default_password', '');
  let title = GetValue(config, 'title', 'Welcome');
  let x = GetValue(config, 'x', 0);
  let y = GetValue(config, 'y', 0);
  let width = GetValue(config, 'width', undefined);
  let height = GetValue(config, 'height', undefined);

  let first_print = true;
  let font_fam = 'VT323';
  // let font_fam = 'Arial';

  let background = scene.rexUI.add.roundRectangle(0, 0, 10, 10, 10, COLOR_PRIMARY);
  // let titleField = scene.add.text(0, 0, title, { fontSize: 30, valign: 'center', fontFamily: font_fam });
  let titleField = scene.add.text(0, 0, title, { valign: 'center', fontFamily: font_fam });
  let user_image = scene.add.image(0, 0, 'user');
  let bbcode_obj = scene.rexUI.add.BBCodeText(0, 0, username || "Enter nickname", {
    fixedWidth: 150, fixedHeight: 36, fontFamily: font_fam, valign: 'center'
  });

  // user_image.texture.setFilter(0);
  // titleField.texture.setFilter(0);
  // bbcode_obj.texture.setFilter(0);

  let resolution_factor = scene.sys.game.scale.displaySize.width / scene.sys.game.scale.gameSize.width;

  titleField.setResolution(1);
  bbcode_obj.setResolution(1);
  console.log("Game size %s", scene.sys.game.scale.gameSize);
  console.log("Base size %s", scene.sys.game.scale.baseSize);
  console.log("Display size %s", scene.sys.game.scale.displaySize);
  console.log("resolution_factor %s", resolution_factor);
  // titleField.texture.setFilter(0);
  // bbcode_obj.texture.setFilter(0);

  let userNameField = scene.rexUI.add.label({
    orientation: 'x',
    background: scene.rexUI.add.roundRectangle(0, 0, 10, 10, 10).setStrokeStyle(2, COLOR_LIGHT),
    icon: user_image,
    text: bbcode_obj,
    space: { top: 5, bottom: 5, left: 5, right: 5, icon: 10, }
  })
    .setInteractive()
    .on('pointerdown', function () {
      if (first_print) {
        first_print = false;
        userNameField.text = "";
      }
      let config = {
        onTextChanged: function (textObject, text) {
          username = text;
          textObject.text = text;
        }
      }
      scene.rexUI.edit(userNameField.getform_element('text'), config);
    });

  let passwordField = scene.rexUI.add.label({
    orientation: 'x',
    background: scene.rexUI.add.roundRectangle(0, 0, 10, 10, 10).setStrokeStyle(2, COLOR_LIGHT),
    icon: scene.add.image(0, 0, 'password'),
    text: scene.rexUI.add.BBCodeText(0, 0, markPassword(password), { fixedWidth: 150, fixedHeight: 36, valign: 'center' }),
    space: { top: 5, bottom: 5, left: 5, right: 5, icon: 10, }
  })
    .setInteractive()
    .on('pointerdown', function () {
      let config = {
        type: 'password',
        text: password,
        onTextChanged: function (textObject, text) {
          password = text;
          textObject.text = markPassword(password);
        }
      };
      scene.rexUI.edit(passwordField.getform_element('text'), config);
    });

  let loginButton = scene.rexUI.add.label({
    orientation: 'x',
    background: scene.rexUI.add.roundRectangle(0, 0, 10, 10, 10, COLOR_LIGHT),
    text: scene.add.text(0, 0, 'Join', { fontFamily: font_fam }),
    space: { top: 8, bottom: 8, left: 8, right: 8 }
  })
    .setInteractive()
    .on('pointerdown', function () {
      scene.input.stopPropagation();
      localStorage.setItem("username", username);
      localStorage.setItem("password", password);
      // loginDialog.emit('login', username, password);
      scene.scene.switch('MainGame');
    });

  let loginDialog = scene.rexUI.add.sizer({
    orientation: 'y',
    x: x,
    y: y,
    width: width,
    height: height,
  })
    .addBackground(background)
    .add(titleField, 0, 'center', { top: 10, bottom: 10, left: 10, right: 10 }, false)
    .add(userNameField, 0, 'left', { bottom: 10, left: 10, right: 10 }, true)
    // .add(passwordField, 0, 'left', { bottom: 10, left: 10, right: 10 }, true)
    .add(loginButton, 0, 'center', { bottom: 10, left: 10, right: 10 }, false)
    .layout();
  return loginDialog;
};
var markPassword = function (password) {
  return new Array(password.length + 1).join('•');
};
