"use strict";

import { encode, decode } from "@msgpack/msgpack";
import Phaser, { Utils } from 'phaser';
import { Queue, Clamp } from "./utils.js"
import { NO_HEAR_DISTANCE } from "./constants.js"
import rexYoutubePlayerURL from "../../rex-notes/plugins/youtubeplayer-plugin.js"

import screen_controls_hint_html from './assets/html/screen_controls_hint.html';
import screen_controls_html from './assets/html/screen_controls.html';


import r_pixel from './assets/sprites/pixel.png';
import r_tilesheet from './assets/map/tilesheet.png';
import r_example_map from './assets/map/example_map.json';
import r_example_map_with_screen from './assets/map/example_map_with_screen.json';

import r_village_top_left_json from './assets/map/village_top_left.json';
import r_village_top_right_json from './assets/map/village_top_right.json';
import r_village_bot_right_json from './assets/map/village_bot_right.json';
import r_village_bot_left_json from './assets/map/village_bot_left.json';
import r_village_bot_center_json from './assets/map/village_bot_center.json';

import r_sprite from './assets/sprites/sprite.png';
import r_ball from './assets/sprites/ball.png';
import r_crosshair from './assets/sprites/crosshair.png';
import r_muted_mic from './assets/interface/muted-mic-b.png';
import r_characters from './assets/sprites/characters/other/All.png';
import r_slime from './assets/sprites/slime_monster/slime_monster_spritesheet.png';

import r_speech_bubble from './assets/sprites/speech_bubble.png';

import r_char_0 from './assets/sprites/characters/char_0.png';
import r_char_1 from './assets/sprites/characters/char_1.png';
import r_char_2 from './assets/sprites/characters/char_2.png';
import r_char_3 from './assets/sprites/characters/char_3.png';
import r_char_4 from './assets/sprites/characters/char_4.png';
import r_char_5 from './assets/sprites/characters/char_5.png';
import r_char_6 from './assets/sprites/characters/char_6.png';
import r_char_7 from './assets/sprites/characters/char_7.png';
import r_char_8 from './assets/sprites/characters/char_8.png';
import r_char_9 from './assets/sprites/characters/char_9.png';
import r_char_10 from './assets/sprites/characters/char_10.png';
import r_char_11 from './assets/sprites/characters/char_11.png';
import r_char_12 from './assets/sprites/characters/char_12.png';
import r_char_13 from './assets/sprites/characters/char_13.png';
import r_char_14 from './assets/sprites/characters/char_14.png';
import r_char_15 from './assets/sprites/characters/char_15.png';
import r_char_16 from './assets/sprites/characters/char_16.png';
import r_char_17 from './assets/sprites/characters/char_17.png';
import r_char_18 from './assets/sprites/characters/char_18.png';
import r_char_19 from './assets/sprites/characters/char_19.png';
import r_char_20 from './assets/sprites/characters/char_20.png';
import r_char_21 from './assets/sprites/characters/char_21.png';
import r_char_22 from './assets/sprites/characters/char_22.png';
import r_char_23 from './assets/sprites/characters/char_23.png';

export default class MainGame extends Phaser.Scene {
    static MOVE_CLICK_SPEED = 0.25; // pixels per frame
    static MOVE_KB_SPEED = 60 / MainGame.MOVE_CLICK_SPEED;
    Client = {};

    constructor() {
        super('MainGame');

        this.phaser_created = false;


        this.playerMap = {};
        this.tween_map = {};
        this.players = [];

    }


    init() {
        // game.stage.disableVisibilityChange = true;

        const self = this;

        this.socketClient.socket.on('yt_url', function (p_data) {
            if (self.player_id == p_data.p) {
                return;
            }
            let vid_data = p_data.v;
            self.play_youtube_thing(vid_data.t, vid_data.id, vid_data.index);
        });

        this.socketClient.socket.on('yt_state', function (p_data) {
            if (self.player_id == p_data.p) {
                return;
            }

            if (self.youtubePlayer.videoStateString != p_data.s) { // Not sure if this is the best check I can do
                if (p_data.s == "pause") {
                    console.log("Set yt video state %s", p_data.s);
                    self.youtubePlayer.pause();
                } else if (p_data.s == "playing") {
                    console.log("Set yt video state %s", p_data.s);
                    self.youtubePlayer.play();
                }
            }
        });

        this.socketClient.socket.on('muted_self', function (p_data) {
            if (self.player_id == p_data.p) {
                return;
            }

            let tmp_player = self.playerMap[p_data.p];
            if (!tmp_player)
                return console.error("No player exists for this mute state");

            tmp_player.muted_mic_sprite.setVisible(!!p_data.s);

            console.log("Recieved muted_self state %s ", p_data);
        });

        this.socketClient.socket.on('newplayer', function (data) {
            self.addNewPlayer(data.rt.id, data.rt.px, data.rt.py, data.sprite, data.uname);
            console.log("Recieved newplayer %s ", JSON.stringify(data));
        });

        // TODO Move these two callbacks to socket_client.js
        this.socketClient.socket.on('new_peer_id', function (p_data) {
            self.peerChat.player_peer_map.set(p_data.id, p_data.pid);
            // console.log("Recieved new_peer_id %s ", JSON.stringify(p_data));
        });

        this.socketClient.socket.on('allpeers', function (p_all_peers) {
            self.peerChat.receive_all_peers(p_all_peers);
        });

        this.socketClient.socket.on('catch_ball', function (p_data) {
            const data = decode(p_data);
            self.on_catch_ball(data.p, data.b);
            // console.log("Recieved catch_ball %s ", JSON.stringify(p_data));
        });
        this.socketClient.socket.on('throw_ball', function (p_data) {
            const data = decode(p_data);
            self.on_throw_ball(data.b, data.x, data.y, data.v, data.w);
            // console.log("Recieved throw_ball %s ", JSON.stringify(p_data));
        });
        this.peerChat.callback_on_ball_throw = function (p_data) {
            self.on_throw_ball(p_data.i, p_data.b, p_data.x, p_data.y, p_data.v, p_data.w);
        }
        this.peerChat.callback_on_player_move = function (p_data) {
            if (self.player_id != p_data.id) {
                // console.log("player %s moved. current player %s", p_data.id, self.player_id)
                self.updatePlayerPhysics(p_data.id, p_data);
            };
        }
        this.socketClient.socket.on('start_throw_ball', function (p_data) {
            const data = decode(p_data);
            self.on_start_throw_ball(data.p, data.b, data.x, data.y, data.v, data.w);
            // console.log("Recieved throw_ball %s ", JSON.stringify(p_data));
        });

        var send_peer_cb = () => {
            // console.log("send_peer_cb");
            self.socketClient.setPeerID(self.player_id, self.peerChat.peer.id);
        };

        this.socketClient.socket.on('room_info', function (p_data) {
            const data = decode(p_data);
            if (!self.player_id) {
                console.log("Recieved allplayers %s ", JSON.stringify(data));
                self.player_id = data.you.rt.id;
                console.log("My new player id is ", self.player_id);
            }

            if (!self.player_id) {
                console.error("Player ID not given by server!");
            }

            try {
                let vid_data = data.room_data.vid_info;
                self.play_youtube_thing(vid_data.t, vid_data.id, vid_data.index);
            } catch (error) {
                console.warn("Error setting vid from room_info", error);
            }

            self.peerChat.callback_on_connect = send_peer_cb;
            if (self.peerChat.isAlive()) {
                send_peer_cb();
            } else {
                // Maybe peer needs re-creating?
                // self.peerChat.init_new_peer();
            }

            const _all = data.all;
            let tmp_player_ids = [];
            for (let i = 0; i < _all.length; i++) {
                tmp_player_ids.push(_all[i].rt.id);
                self.addNewPlayer(_all[i].rt.id, _all[i].rt.px, _all[i].rt.py, _all[i].sprite, _all[i].uname);
                // self.peerChat.request_call_peer(_all[i].peer_id);
            }

            self.players.forEach(some_player_id => {
                if (tmp_player_ids.indexOf(some_player_id) == -1) {
                    self.removePlayer(some_player_id);
                }
            });
        });

        self.socketClient.socket.on('moved', function (p_data) {
            const data = decode(p_data);
            if (self.player_id != data.id) {
                // console.log("player %s moved. current player %s", data.id, self.player_id)
                self.updatePlayerPhysics(data.id, data);
            }
        });

        self.socketClient.socket.on('remove', function (id) {
            self.removePlayer(id);
        });


    };

    preload() {
        this.char_anims = {};

        // this.load.tilemapTiledJSON('map', r_example_map);
        this.load.tilemapTiledJSON('map_screen', r_example_map_with_screen);
        this.load.tilemapTiledJSON('village_top_left', r_village_top_left_json);
        this.load.tilemapTiledJSON('village_top_right', r_village_top_right_json);
        this.load.tilemapTiledJSON('village_bot_center', r_village_bot_center_json);
        this.load.tilemapTiledJSON('village_bot_right', r_village_bot_right_json);
        this.load.tilemapTiledJSON('village_bot_left', r_village_bot_left_json);
        this.load.image('tilesheet', r_tilesheet);
        this.load.image('pixel', r_pixel);
        this.load.image('speech_bubble', r_speech_bubble);

        this.load.image('sprite', r_sprite);
        this.load.image('ball', r_ball);
        this.load.image('crosshair', r_crosshair);
        this.load.image('muted_mic', r_muted_mic);
        this.load.spritesheet('characters', r_characters, { frameWidth: 48, frameHeight: 51 });
        this.load.spritesheet('slime', r_slime, { frameWidth: 24, frameHeight: 24 });

        try {
            // let url = 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexyoutubeplayerplugin.min.js';
            // let url = 'js/rex-notes/dist/rexyoutubeplayerplugin.min.js';
            this.load.plugin('rexyoutubeplayerplugin', rexYoutubePlayerURL, true);
        } catch (error) {
            console.error("Erorr preloading yt plugin" + error);
        }
        // for (let i = 0; i < 24; i++) {
        //     this.load_char_spritesheet(i);
        // }

        this.load.spritesheet("char_0", r_char_0, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_1", r_char_1, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_2", r_char_2, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_3", r_char_3, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_4", r_char_4, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_5", r_char_5, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_6", r_char_6, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_7", r_char_7, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_8", r_char_8, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_9", r_char_9, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_10", r_char_10, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_11", r_char_11, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_12", r_char_12, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_13", r_char_13, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_14", r_char_14, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_15", r_char_15, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_16", r_char_16, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_17", r_char_17, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_18", r_char_18, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_19", r_char_19, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_20", r_char_20, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_21", r_char_21, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_22", r_char_22, { frameWidth: 16, frameHeight: 17 });
        this.load.spritesheet("char_23", r_char_23, { frameWidth: 16, frameHeight: 17 });
    };

    // load_char_spritesheet(char_id) {
    //     // if (!this.char_sprites[char_id]) {
    //     this.load.spritesheet('char_' + char_id, './assets/sprites/characters/char_' + char_id + '.png', { frameWidth: 16, frameHeight: 17 });

    //     // }

    // }
    load_char_anims(char_id) {
        this.anims.create({
            key: 'down_' + char_id,
            frames: this.anims.generateFrameNumbers('char_' + char_id, { frames: [0, 4, 8] }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'right_' + char_id,
            frames: this.anims.generateFrameNumbers('char_' + char_id, { frames: [1, 5, 9] }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'up_' + char_id,
            frames: this.anims.generateFrameNumbers('char_' + char_id, { frames: [2, 6, 10] }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'left_' + char_id,
            frames: this.anims.generateFrameNumbers('char_' + char_id, { frames: [3, 7, 11] }),
            frameRate: 8,
            repeat: -1
        });
    }

    updateCamera() {
        // const width = this.scale.gameSize.width;
        // const height = this.scale.gameSize.height;

        // const camera = this.cameras.main;

        // camera.setViewport(0, 0, width, height);

        // this.adaptive_layer.setPosition(width / 2, height / 2);
        // this.adaptive_layer.setScale(this.scene.getZoom());
    }

    resize() {
        // this.updateCamera();
    }

    on_ball_collision(p_player, p_ball) {
        if (!!p_player.holding_ball || (!!p_ball.just_thrown && p_ball.thrower_player_id == p_player.player_id) || !!p_ball.holder_player_id) {
            // a) Player cannot catch a ball if they are holding one
            // b) Ball cannot be caught immediatly after throwing by the thrower
            // c) Ball cannot be caught if it is already being carried by someone
            return;

        }
        if (!!p_player.shooting_anim) {
            return; // Disable catching anything during kick-ball animation
        }

        console.log("on_ball_collision: Player caught ball.");

        p_ball.physics_buffer = [];

        p_ball.body.reset(
            p_player.x + Math.sign(p_player.body.velocity.x) * p_player.width, p_player.y + Math.sign(p_player.body.velocity.y) * p_player.height);

        if (p_player.player_id != this.player_id) {
            // The above is for prediction, but only the player's own client does the decision
            if (!p_ball.assuming_caught) {
                p_ball.assuming_caught = true;
                p_ball.assuming_caught_counter = 80;
            }
            return;
        }

        console.log("on_ball_collision: Player caught ball for real.");

        p_ball.start_simulation = false;
        p_ball.thrower_player_id = null;

        p_player.holding_ball = p_ball;

        p_ball.holder_player_id = p_player.player_id;

        this.socketClient.playerCatchBall(p_player.player_id, p_ball.id);
    }

    on_catch_ball(p_player_id, p_ball_id) {
        if (p_player_id == this.player_id) {
            // ignore the thrower since he is the source
            return;
        }
        let tmp_player = this.playerMap[p_player_id];
        let tmp_ball = this.ballMap.get(p_ball_id);
        if (!!tmp_player && !!tmp_ball) {
            tmp_ball.physics_buffer = [];
            tmp_ball.thrower_player_id = null;
            tmp_ball.start_simulation = false;
            tmp_ball.holder_player_id = p_player_id;
            tmp_player.holding_ball = tmp_ball;
            console.log("on_catch_ball Player %s caught ball with id %s", p_player_id, p_ball_id);
        } else {
            console.warn("Could not assign ball %s to player %s, one of their mappings broke.", p_ball_id, p_player_id);
        }
    }

    on_start_throw_ball(p_player_id, p_ball_id, p_px, p_py, p_vx, p_vy) {
        let tmp_ball = this.ballMap.get(p_ball_id);
        if (!tmp_ball) {
            console.warn("Ball with id %s does not exist.", p_ball_id);
            return;
        }
        // if (p_player_id == this.player_id) {
        //     // ignore simulation for the thrower since he is the source
        //     return;
        // }

        let tmp_player = this.playerMap[p_player_id];
        if (!tmp_player) {
            console.error("on_start_throw_ball: Player with id %s does not exist.", p_player_id);
            return;
        }

        tmp_ball.thrower_player_id = p_player_id;
        tmp_ball.just_thrown = true;
        tmp_ball.start_simulation = false;

        // This was commented out because it is possible with webrtc for the `on_throw_ball` to happen first
        // tmp_ball.physics_buffer = [{
        //     px: p_px,
        //     py: p_py,
        //     vx: p_vx,
        //     vy: p_vy
        // }];

        if (p_player_id != this.player_id) {
            var timeline = this.tweens.timeline({
                tweens: [{
                    targets: tmp_player,
                    y: tmp_player.y - 10,
                    scale: tmp_player.scale * 1.1,
                    ease: 'Power1',
                    duration: 150
                },
                {
                    targets: tmp_player,
                    y: tmp_player.y,
                    scale: tmp_player.scale,
                    ease: 'Power1',
                    duration: 150,
                }
                ]
            });
        }
    }

    on_throw_ball(p_player_id, p_ball_id, p_px, p_py, p_vx, p_vy) {
        let tmp_ball = this.ballMap.get(p_ball_id);

        if (!tmp_ball) {
            console.warn("Ball with id %s does not exist.", p_ball_id);
            return;
        }

        let tmp_player = this.playerMap[p_player_id];
        if (!tmp_player) {
            console.warn("Player with id %s does not exist", p_player_id);
            return;
        }

        if (tmp_ball.holder_player_id == this.player_id) {
            return;
        }

        if (tmp_ball.thrower_player_id != p_player_id) {
            tmp_ball.thrower_player_id = p_player_id;
            tmp_ball.just_thrown = true;
            tmp_ball.start_simulation = false;

            // This was commented out because it is possible with webrtc for the `on_throw_ball` to happen first
            tmp_ball.physics_buffer = [{
                px: p_px,
                py: p_py,
                vx: p_vx,
                vy: p_vy
            }];

            if (p_player_id != this.player_id) {
                var timeline = this.tweens.timeline({
                    tweens: [{
                        targets: tmp_player,
                        y: tmp_player.y - 10,
                        scale: tmp_player.scale * 1.1,
                        ease: 'Power1',
                        duration: 150
                    },
                    {
                        targets: tmp_player,
                        y: tmp_player.y,
                        scale: tmp_player.scale,
                        ease: 'Power1',
                        duration: 150,
                    }
                    ]
                });
            };
            return;
        }


        if (!!tmp_ball.assuming_caught) {
            if (tmp_ball.assuming_caught_counter > 0) {
                tmp_ball.assuming_caught_counter -= 1;
                return;
            } else {
                tmp_ball.assuming_caught = false;
            }
        }

        // if (tmp_ball.thrower_player_id == this.player_id) {
        //     // ignore simulation for the thrower since he is the source
        //     return;
        // }

        if (!tmp_ball.physics_buffer) {
            tmp_ball.physics_buffer = []; // This probably never happens but 🤷
        }
        tmp_ball.physics_buffer.unshift({
            px: p_px,
            py: p_py,
            vx: p_vx,
            vy: p_vy
        });

        if (!!tmp_ball.start_simulation) {
            return; // Don't bother checking to start simulation if it started
        }

        if (!!tmp_player.shooting_anim) {
            return;
        }

        if (tmp_ball.physics_buffer.length >= (10 + Clamp(this.socketClient.latency / 16, 0, 600)) && p_player_id != this.player_id) { // Only trigger this once, to avoid overriding catch signal from other players
            console.log("Started simulation on non-thrower");
            tmp_ball.holder_player_id = null;
            tmp_player.holding_ball = null;
            tmp_ball.just_thrown = true;
            let timer = this.time.delayedCall(1250, () => {
                tmp_ball.just_thrown = false;
            });
            tmp_ball.start_simulation = true;
        }
        else if (tmp_ball.physics_buffer.length >= (5 + Clamp(this.socketClient.latency / 16, 0, 600)) && p_player_id == this.player_id) {
            console.log("Started simulation on thrower");
            tmp_ball.holder_player_id = null;
            tmp_player.holding_ball = null;
            tmp_ball.just_thrown = true;
            let timer = this.time.delayedCall(1250, () => {
                tmp_ball.just_thrown = false;
            });
            tmp_ball.start_simulation = true;
        }
        // console.log("Adding ball %s data to physics buffer with size %s", p_ball_id, tmp_ball.physics_buffer.length);
    }



    create() {
        const self = this;

        for (let i = 0; i < 24; i++) {
            this.load_char_anims(i);
        }

        // this.adaptive_layer = this.add.container();

        this.phaser_created = true;

        let yt_original_config = {
            x: 1230,
            y: 130,
            width: 340,
            height: 192
        }

        this.youtubePlayer = this.add.rexYoutubePlayer(
            yt_original_config.x, yt_original_config.y, yt_original_config.width, yt_original_config.height, {
            videoId: 'DyWhFB9ijzA',
            modestBranding: true,
            loop: false,
            autoPlay: true,
            keyboardControl: false,
            controls: true,
        }).on('ready', function () {
            console.log("Youtube Video ready");
            self.load_screen_controls();
            // if (!self.current_yt_type) {
            //     let new_playlist = "PLUh4W61bt_K6HLVHp_Z_NmXyV6SVNsg2N";
            //     self.play_youtube_thing("list", new_playlist, Math.floor(Math.random() * 86));
            // }

            // self.youtubePlayer.setPosition(600, 300);
        }).on('pause', function () {

            self.socketClient.sendYoutubeState(self.player_id, "pause");
        }).on('playing', function () {

            self.socketClient.sendYoutubeState(self.player_id, "playing");
        });

        this.youtubePlayer.original_config = yt_original_config;



        this.player_group = this.physics.add.group();
        this.ball_group = this.physics.add.group();

        // this.physics.add.collider(this.player_group, this.ball_group);


        // let testKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        let map_top_left = this.make.tilemap({ key: 'village_top_left', tileWidth: 32, tileHeight: 32 });
        let map_screen = this.make.tilemap({ key: 'map_screen', tileWidth: 32, tileHeight: 32 });
        let map_bot_left = this.make.tilemap({ key: 'village_bot_left', tileWidth: 32, tileHeight: 32 });
        let map_bot_center = this.make.tilemap({ key: 'village_bot_center', tileWidth: 32, tileHeight: 32 });
        let map_top_right = this.make.tilemap({ key: 'village_top_right', tileWidth: 32, tileHeight: 32 });
        let map_bot_right = this.make.tilemap({ key: 'village_bot_right', tileWidth: 32, tileHeight: 32 });
        let tileset = map_top_left.addTilesetImage('tilesheet');

        let col_layers = [];
        this.col_layers = col_layers;

        let layer;

        var add_physics_to_layer = function (p_layer, p_self, p_col_layers) {
            p_layer.setCollisionByProperty({ collides: true });
            // p_layer.setCollisionBetween(22, 24);
            p_self.physics.add.collider(p_self.player_group, p_layer);
            p_layer.visible = false;
            p_col_layers.push(p_layer);
        }

        for (let i = 0; i < map_top_left.layers.length; i++) {
            layer = map_top_left.createLayer(i, tileset);
            if (layer.layer.name == "collision") {
                add_physics_to_layer(layer, this, col_layers);
            }
        }
        for (let i = 0; i < map_screen.layers.length; i++) {
            layer = map_screen.createLayer(i, tileset, map_screen.widthInPixels);
            if (layer.layer.name == "collision") {
                add_physics_to_layer(layer, this, col_layers);
            }
            if (layer.layer.name == "screen_control_trigger") {
                layer.setCollisionByProperty({ collides: true });
                layer.visible = false;
                this.screen_control_collision_layer = layer;
            }
        }
        for (let i = 0; i < map_bot_left.layers.length; i++) {
            layer = map_bot_left.createLayer(i, tileset, 0, map_bot_left.heightInPixels);
            if (layer.layer.name == "collision") {
                add_physics_to_layer(layer, this, col_layers);
            }
        }
        for (let i = 0; i < map_bot_center.layers.length; i++) {
            layer = map_bot_center.createLayer(i, tileset, map_bot_center.widthInPixels, map_bot_center.heightInPixels);
            if (layer.layer.name == "collision") {
                add_physics_to_layer(layer, this, col_layers);
            }
        }
        for (let i = 0; i < map_bot_center.layers.length; i++) {
            layer = map_top_right.createLayer(i, tileset, map_top_right.widthInPixels * 2, 0);
            if (layer.layer.name == "collision") {
                add_physics_to_layer(layer, this, col_layers);
            }
        }
        for (let i = 0; i < map_bot_center.layers.length; i++) {
            layer = map_bot_right.createLayer(i, tileset, map_bot_right.widthInPixels * 2, map_bot_right.heightInPixels);
            if (layer.layer.name == "collision") {
                add_physics_to_layer(layer, this, col_layers);
            }
        }

        // this.adaptive_layer.add(map);

        //  Set the camera and physics bounds to be the size of 4x4 bg images
        this.cameras.main.setBounds(0, 0, map_top_left.widthInPixels * 3, map_top_left.heightInPixels * 2);
        this.physics.world.setBounds(0, 0, map_top_left.widthInPixels * 3, map_top_left.heightInPixels * 2);
        this.cameras.main.zoom = 1.5;
        this.youtubePlayer.original_config.zoom = this.cameras.main.zoom;


        // this.input.on('wheel', function (pointer, gameObjects, deltaX, deltaY, deltaZ) {
        //     let _new_zoom = Clamp(self.cameras.main.zoom - deltaY * 0.025, 1.2, 1.6);
        //     self.cameras.main.zoom = _new_zoom;
        //     let _zoom_change = (self.youtubePlayer.original_config.zoom - _new_zoom) / self.youtubePlayer.original_config.zoom;
        //     self.youtubePlayer.x = self.youtubePlayer.original_config.x - _zoom_change * 130;
        //     self.youtubePlayer.y = self.youtubePlayer.original_config.y - _zoom_change * 70;
        // });

        this.stored_name = localStorage.getItem("username");
        this.stored_pic_id = localStorage.getItem("pic_id");

        // layer.inputEnabled = true; // Allows clicking on the map ; it's enough to do it on the last layer
        this.socketClient.whatsUp(this.stored_name, this.stored_pic_id, this.player_id);

        setInterval(() => {
            self.socketClient.whatsUp(self.stored_name, self.stored_pic_id, self.player_id);
        }, 10000);

        this.crosshair = this.add.sprite(-100, -100, 'crosshair');
        this.crosshair.setVisible(false);
        // this.adaptive_layer.add(this.crosshair);

        this.ballMap = new Map();

        var add_new_ball = function (p_ball_id, p_x, p_y, p_col_layers, p_self) {
            let new_ball = p_self.physics.add.sprite(p_x, p_y, 'slime', 6);

            p_self.ballMap.set(p_ball_id, new_ball);

            new_ball.scale = 2;
            new_ball.id = p_ball_id;
            new_ball.setCollideWorldBounds(true);
            // new_ball.body.setVelocity(100, 100);
            // new_ball.setImmovable(false);
            new_ball.setBounce(1, 1);
            new_ball.setCircle(10, 2, 2);
            new_ball.setPushable(true);
            new_ball.setDamping(true)
            new_ball.setDrag(0.999);
            new_ball.setMaxVelocity(1000);
            // this.ball_group.add(new_ball);
            // const self = this;
            p_col_layers.forEach(layer => {
                p_self.physics.add.collider(new_ball, layer);
            });

            // The invis ball needs to have identical physical properties for the simulation to work
            let invis_ball = p_self.physics.add.sprite(p_x, p_y, 'slime', 6);
            invis_ball.alpha = 0;

            new_ball.fake = invis_ball;

            invis_ball.scale = 2;
            invis_ball.id = p_ball_id;
            invis_ball.setCollideWorldBounds(true);
            // invis_ball.body.setVelocity(100, 100);
            // invis_ball.setImmovable(false);
            invis_ball.setBounce(1, 1);
            invis_ball.setCircle(10, 2, 2);
            invis_ball.setPushable(true);
            invis_ball.setDamping(true)
            invis_ball.setDrag(0.999);
            invis_ball.setMaxVelocity(1000);
            // this.ball_group.add(invis_ball);
            // const self = this;
            p_col_layers.forEach(layer => {
                p_self.physics.add.collider(invis_ball, layer);
            });
        }

        add_new_ball(1, 300, 400, col_layers, this);
        add_new_ball(2, 600, 400, col_layers, this);


        this.input.mouse.disableContextMenu();

        let raycast_offset = 4;

        this.input.on('pointerdown', function (pointer) {
            if (!self.current_player)
                return;

            if (pointer.leftButtonDown()) {
                let world_pointer = self.cameras.main.getWorldPoint(pointer.x, pointer.y);
                let test_point = self.cameras.main.getWorldPoint(pointer.x, pointer.y);

                // Stretch the click point a bit for better raycasting
                let end_vec = new Phaser.Math.Vector2(test_point.x - self.current_player.x, test_point.y - self.current_player.y);
                let t_mag = end_vec.length();
                end_vec = end_vec.normalize();
                end_vec = end_vec.scale(t_mag + 32);
                test_point.x = self.current_player.x + end_vec.x;
                test_point.y = self.current_player.y + end_vec.y;

                let t_line_center = new Phaser.Geom.Line(self.current_player.x, self.current_player.y + 10, test_point.x, test_point.y);
                let t_line_top = new Phaser.Geom.Line(self.current_player.x, self.current_player.y + 10 - raycast_offset, test_point.x, test_point.y);
                let t_line_bot = new Phaser.Geom.Line(self.current_player.x, self.current_player.y + 10 + raycast_offset, test_point.x, test_point.y);
                let t_line_left = new Phaser.Geom.Line(self.current_player.x + raycast_offset, self.current_player.y + 10, test_point.x, test_point.y);
                let t_line_right = new Phaser.Geom.Line(self.current_player.x - raycast_offset, self.current_player.y + 10, test_point.x, test_point.y);
                let all_test_lines = [t_line_center, t_line_top, t_line_bot, t_line_left, t_line_right];
                let closest_tile = null;
                let closest_distance = Number.POSITIVE_INFINITY;
                let closest_pos = null;
                all_test_lines.forEach(test_line => {
                    self.col_layers.forEach(t_layer => {
                        let overlappingTiles = t_layer.getTilesWithinShape(test_line, { isColliding: true });
                        if (!!overlappingTiles && overlappingTiles.length > 0) {
                            overlappingTiles.forEach(t_tile => {
                                let tmp_pos = t_layer.tileToWorldXY(t_tile.x, t_tile.y);
                                let new_dist = Phaser.Math.Distance.Between(
                                    self.current_player.x, self.current_player.y, tmp_pos.x, tmp_pos.y);
                                if (new_dist < closest_distance) {
                                    closest_tile = t_tile;
                                    closest_distance = new_dist;
                                    closest_pos = tmp_pos;
                                }
                            });

                        }
                    });
                });
                if (!!closest_tile) {
                    let closest_vec = new Phaser.Math.Vector2(closest_pos.x - self.current_player.x, closest_pos.y - self.current_player.y);
                    let t_mag = closest_vec.length();
                    closest_vec = closest_vec.normalize();
                    closest_vec = closest_vec.scale(t_mag - 48);
                    world_pointer.x = self.current_player.x + closest_vec.x;
                    world_pointer.y = self.current_player.y + closest_vec.y;
                    // world_pointer.y = closest_pos.y;
                }
                // console.log("Pressed local: %s %s world: %s %s", pointer.x, pointer.y, world_pointer.x, world_pointer.y);
                let _player = self.movePlayerToPos(self.player_id, world_pointer.x, world_pointer.y);
                if (_player)
                    self.peerChat.sendMove(_player.x, _player.y, _player.body.velocity.x, _player.body.velocity.y, self.player_id);
            }
            else if (pointer.rightButtonDown()) {
                // Throw ball if present
                // console.log("Player try throw");

                if (!!self.current_player && !!self.current_player.holding_ball && !self.current_player.holding_ball.thrower_player_id) {
                    // TODO Add animation delay? 
                    let tmp_ball = self.current_player.holding_ball;
                    tmp_ball.physics_buffer = [];
                    tmp_ball.thrower_player_id = self.player_id;
                    console.log("Player %s throwing %s", tmp_ball.thrower_player_id, tmp_ball.id);
                    let world_pointer = self.cameras.main.getWorldPoint(pointer.x, pointer.y);
                    let direction = new Phaser.Math.Vector2(world_pointer.x - self.current_player.x, world_pointer.y - self.current_player.y);
                    direction = direction.normalize();
                    let pos_x = self.current_player.x + Math.sign(direction.x) * self.current_player.width;
                    let pos_y = self.current_player.y + Math.sign(direction.y) * self.current_player.height;
                    tmp_ball.fake.setPosition(pos_x, pos_y);
                    self.peerChat.playerThrowBall(self.player_id, tmp_ball.id, pos_x, pos_y, direction.x * 200, direction.y * 200);
                    tmp_ball.fake.setVelocity(direction.x * 200, direction.y * 200);
                    tmp_ball.holder_player_id = null;

                    self.current_player.shooting_anim = true;
                    var timeline = this.tweens.timeline({
                        tweens: [{
                            targets: self.current_player,
                            y: self.current_player.y - 10,
                            scale: self.current_player.scale * 1.1,
                            ease: 'Power1',
                            duration: 150
                        },
                        {
                            targets: self.current_player,
                            y: self.current_player.y,
                            scale: self.current_player.scale,
                            ease: 'Power1',
                            duration: 150,
                            onComplete: function () { self.current_player.shooting_anim = false; },
                        }
                        ]
                    });
                    tmp_ball.just_thrown = true;
                    self.current_player.body.reset(self.current_player.x, self.current_player.y); // Stop player movement?
                } else if (!!self.current_player.holding_ball && self.current_player.holding_ball.thrower_player_id) {
                    console.error("Cannot throw ball because it has thrower_player_id. holding_ball was nullified");
                    self.current_player.holding_ball = null;
                }
            }

        }, self);

        this.keys_arrows = this.input.keyboard.createCursorKeys();
        this.keys_wasd = this.input.keyboard.addKeys({
            'up': Phaser.Input.Keyboard.KeyCodes.W,
            'left': Phaser.Input.Keyboard.KeyCodes.A,
            'down': Phaser.Input.Keyboard.KeyCodes.S,
            'right': Phaser.Input.Keyboard.KeyCodes.D
        });

        this.current_move_input = new Phaser.Math.Vector2(0, 0);

        // this.scene.launch('GameScene');

        // this.gameScene = this.scene.get('GameScene');

        this.setup_game_focus();

        this.events.on('postupdate', this.postUpdate, this);
        this.events.on('preupdate', this.preUpdate, this);
    }

    postUpdate() {
        this.updatePlayerYSort();
        this.handle_ball_follow();
    }
    preUpdate() {
        this.handleSimulationSync();
    }

    updatePlayerYSort() {
        const self = this;
        this.players.forEach(_index => {
            let tmp_player = this.playerMap[_index];
            if (!!tmp_player) {
                tmp_player.depth = tmp_player.y + (tmp_player.height * tmp_player.scale) / 2;

                // console.log("Update label: %s", t_player.name_label.text);
                tmp_player.name_label.setPosition(tmp_player.x - + tmp_player.name_label.width / 2, tmp_player.y + (tmp_player.height * tmp_player.scale) / 2); //Phaser.Math.Linear(tmp_player.name_label.x, tmp_player.x - + tmp_player.name_label.width / 2, 0.9);
                // tmp_player.name_label.y =; //Phaser.Math.Linear(tmp_player.name_label.y, tmp_player.y + (tmp_player.height * tmp_player.scale) / 2, 0.9);
                tmp_player.chat_bubble.setPosition(tmp_player.x, tmp_player.y - (tmp_player.height * tmp_player.scale) / 2 - tmp_player.chat_bubble.height / 2);
                tmp_player.muted_mic_sprite.setPosition(tmp_player.chat_bubble.x, tmp_player.chat_bubble.y - 3);

            }
        });
        for (let [_ball_id, tmp_ball] of self.ballMap) {
            if (!!tmp_ball) { // FIXME This should iterate over all balls
                tmp_ball.depth = tmp_ball.y + (tmp_ball.height * tmp_ball.scale) / 2;
            }
        }
        // if (!!this.crosshair)
        //     this.crosshair.depth = this.crosshair.y + this.crosshair.height / 2;

    }

    static COUNTER_DOM_UPDATE = 0;
    static INTERVAL_DOM_UPDATE = 10;
    static COUNTER_FOCUS_UPDATE = 0;
    static INTERVAL_FOCUS_UPDATE = 60;
    update(time, delta) {
        this.handle_player_anims();

        this.handle_player_controls(delta);

        if (!this.player_id || !this.current_player) {
            return;
        }
        this.handleVideoPan();

        if (MainGame.COUNTER_DOM_UPDATE >= MainGame.INTERVAL_DOM_UPDATE) {
            MainGame.COUNTER_DOM_UPDATE = 0;
            this.peerChat.handle_voice_proximity(this.current_player, this.playerMap);
            this.handle_video_proximity();
        }
        if (MainGame.COUNTER_FOCUS_UPDATE >= MainGame.INTERVAL_FOCUS_UPDATE) {
            MainGame.COUNTER_FOCUS_UPDATE = 0;
            this.focus_game();
        }
        this.peerChat.handle_talk_activity(this.playerMap);

        MainGame.COUNTER_DOM_UPDATE += 1;
        MainGame.COUNTER_FOCUS_UPDATE += 1;
    }

    handle_ball_follow() {

        this.players.forEach(_index => {
            let tmp_player = this.playerMap[_index];
            if (!tmp_player || !tmp_player.holding_ball) {
                return;
            }
            if (!!tmp_player.holding_ball.start_simulation) {
                console.error("handle_ball_follow should not happen when ball is replaying simulation. holding_ball was nullified to reduce error logs.");
                tmp_player.holding_ball = null;
                return;
            }
            let direction_walk = new Phaser.Math.Vector2(tmp_player.body.velocity.x, tmp_player.body.velocity.y);
            direction_walk = direction_walk.normalize();
            tmp_player.holding_ball.setPosition(
                tmp_player.x + direction_walk.x * tmp_player.width, tmp_player.y + direction_walk.y * tmp_player.height);
        });

    }



    setup_game_focus() {
        let game_dom = document.querySelector('#game');
        game_dom = game_dom ? game_dom.querySelector('canvas') : null;
        if (game_dom) {
            game_dom.setAttribute("tabindex", "6");
            console.log("Found element %s", game_dom);
            game_dom.focus();
            this.game_dom_canvas = game_dom;
        }

    }

    focus_game() {
        // TESTME This needs to be disabled when other UI is shown
        if (this.game_dom_canvas && !this.showing_focused_ui) {
            this.game_dom_canvas.focus();
        }
    }
    handle_video_proximity() {
        let _distance_vid = Phaser.Math.Distance.Between(
            this.youtubePlayer.x, this.youtubePlayer.y, this.current_player.x, this.current_player.y);
        this.youtubePlayer.setVolume(1 - Clamp(_distance_vid / (NO_HEAR_DISTANCE * 2), 0, 1));
    }

    static WHY_IS_VIDEO_NOT_CENTERED_X = 45;
    // The pan range needs to be proportional to the MAX_HEAR_DISTANCE but since the video positioing is mysterious I would rather have the flexibility of fine-tunining
    static VIDEO_PAN_RANGE_X = 325;
    static VIDEO_PAN_RANGE_Y = 240;
    handleVideoPan() {
        // let _distance_vid = Phaser.Math.Distance.Between(
        //     this.youtubePlayer.x, this.youtubePlayer.y, this.current_player.x, this.current_player.y);
        let _dist_x = this.current_player.x - this.youtubePlayer.x;
        let _dist_y = this.current_player.y - this.youtubePlayer.y;

        if (Math.abs(_dist_x + MainGame.WHY_IS_VIDEO_NOT_CENTERED_X) < MainGame.VIDEO_PAN_RANGE_X && _dist_y < MainGame.VIDEO_PAN_RANGE_Y) {
            if (!!this.cameras.main.following_player) {
                this.cameras.main.following_player = false;
                this.cameras.main.stopFollow();
                this.cameras.main.startFollow(this.youtubePlayer, false, 0.1, 0.1, -_dist_x + (this.cameras.main.followOffset.x * 1), -_dist_y + (this.cameras.main.followOffset.y * 1));
            } else {
                this.cameras.main.followOffset.x = Phaser.Math.Linear(this.cameras.main.followOffset.x, MainGame.WHY_IS_VIDEO_NOT_CENTERED_X, 0.1);
                this.cameras.main.followOffset.y = Phaser.Math.Linear(this.cameras.main.followOffset.y, 0, 0.1);
            }
        } else {
            if (!this.cameras.main.following_player) {
                this.cameras.main.following_player = true;
                this.screen_controls.node.style.visibility = "hidden"; // Player cannot access screen controls outside of view area (temp fix until desk is implemented)
                this.cameras.main.stopFollow();
                this.cameras.main.startFollow(
                    this.current_player, false, 1, 1, _dist_x + (this.cameras.main.followOffset.x * 1), _dist_y + (this.cameras.main.followOffset.y * 1)
                );
            } else {
                this.cameras.main.followOffset.x = Phaser.Math.Linear(this.cameras.main.followOffset.x, 0, 0.1);
                this.cameras.main.followOffset.y = Phaser.Math.Linear(this.cameras.main.followOffset.y, 0, 0.1);
            }
        }
    }


    handle_player_controls(delta) {
        if (!this.player_id || !this.current_player) {
            return;
        }

        if (!!this.current_player.shooting_anim) {
            return; // Disable movement during kick-ball animation
        }


        if (Phaser.Input.Keyboard.JustDown(this.keys_arrows.space)) {
            let new_mute_state = this.peerChat.toggleMicMute();
            this.current_player.muted_mic_sprite.setVisible(new_mute_state);
            this.socketClient.sendMutedSelfState(this.player_id, new_mute_state);

            // This check was a temporary hack until the desk collisions were added
            // if (!this.cameras.main.following_player) { // The camera is following the player at all times except when in range of a video
            //     console.log("Open video controls");
            //     this.show_video_controls();
            // }
        }

        let current_move_input = new Phaser.Math.Vector2(0, 0);
        if (this.keys_arrows.up.isDown || this.keys_wasd.up.isDown) {
            current_move_input.y = -1;
        }
        if (this.keys_arrows.down.isDown || this.keys_wasd.down.isDown) {
            current_move_input.y = +1;
        }
        if (this.keys_arrows.right.isDown || this.keys_wasd.right.isDown) {
            current_move_input.x = +1;
        }
        if (this.keys_arrows.left.isDown || this.keys_wasd.left.isDown) {
            current_move_input.x = -1;
        }

        let move_vector = current_move_input.normalize().scale(MainGame.MOVE_KB_SPEED);
        // let just_stopped_input = false;
        if (move_vector.lengthSq() > 0) {
            // this.doing_input = true;
            this.current_player.click_move_target = null;
            this.crosshair.setVisible(false);
            this.current_player.body.setVelocity(move_vector.x, move_vector.y);
        } else {
            // if (this.doing_input) {
            //     just_stopped_input = true;
            // }
            // this.doing_input = false;
            if (!this.current_player.click_move_target) {
                // Only stop player movement when both input AND point-click input is not active
                this.current_player.body.setVelocity(move_vector.x, move_vector.y);
                // if (!just_stopped_input) {
                //     // Don't send empty data when player is not using keyboard or mouse
                //     return;
                // }
            }
        }

        // TODO Send less data
        // if (this.player_movement_changed(this.current_player.last_input, current_move_input)) {
        this.peerChat.sendMove(
            this.current_player.x, this.current_player.y, this.current_player.body.velocity.x, this.current_player.body.velocity.y, this.player_id);
        // }
        // this.current_player.last_input = current_move_input;

    }
    player_movement_changed(p_old_input, p_new_input) {
        if (!p_old_input)
            return true;
        return p_old_input.x != p_new_input.x || p_old_input.y != p_new_input.y;
    }
    static ANIM_VEL_CUTOFF = 0.01;
    handle_player_anims() {
        this.players.forEach(p_id => {
            let tmp_player = this.playerMap[p_id];
            if (!!tmp_player) { // Animate based on velocity
                let _p_vel = tmp_player.body.velocity;
                if (Math.abs(_p_vel.x) >= Math.abs(_p_vel.y)) {
                    if (_p_vel.x > MainGame.ANIM_VEL_CUTOFF) {
                        if (!tmp_player.anims.isPlaying || !tmp_player.anims.currentAnim.key.startsWith("right"))
                            tmp_player.play("right_" + tmp_player.sprite_id);
                    } else if (_p_vel.x < -MainGame.ANIM_VEL_CUTOFF) {
                        if (!tmp_player.anims.isPlaying || !tmp_player.anims.currentAnim.key.startsWith("left"))
                            tmp_player.play("left_" + tmp_player.sprite_id);
                    } else {
                        if (!!tmp_player.anims.currentAnim) {
                            // console.log("Stop anim");
                            let first_frame = tmp_player.anims.currentAnim.getFrameAt(0);
                            tmp_player.anims.pause(first_frame);
                            // player.anims.stopOnFrame(first_frame);
                        }
                        // player.anims.isPlaying = false;
                        // player.anims.repeat = 0;
                        // player.anims.stopAfterRepeat(1);
                    }
                } else {
                    if (_p_vel.y > MainGame.ANIM_VEL_CUTOFF) {
                        if (!tmp_player.anims.isPlaying || !tmp_player.anims.currentAnim.key.startsWith("down"))
                            tmp_player.play("down_" + tmp_player.sprite_id);
                    } else if (_p_vel.y < -MainGame.ANIM_VEL_CUTOFF) {
                        if (!tmp_player.anims.isPlaying || !tmp_player.anims.currentAnim.key.startsWith("up"))
                            tmp_player.play("up_" + tmp_player.sprite_id);
                    } else {
                        if (!!tmp_player.anims.currentAnim) {
                            // console.log("Stop anim");
                            let first_frame = tmp_player.anims.currentAnim.getFrameAt(0);
                            tmp_player.anims.pause(first_frame);
                            // player.anims.stopOnFrame(first_frame);
                        }
                        // player.anims.repeat = 0;
                        // player.anims.stopAfterRepeat(1);
                    }
                }
            }
        });
    }




    handleSimulationSync() {
        // This should be moved to physics loop callback
        this.players.forEach(p_id => {
            let tmp_player = this.playerMap[p_id];
            if (!tmp_player) {
                return;
            }
            if (p_id == this.player_id) {
                if (!!tmp_player.click_move_target) {
                    let distance = Phaser.Math.Distance.Between(tmp_player.x, tmp_player.y, tmp_player.click_move_target.x, tmp_player.click_move_target.y);

                    //  The distance tolerance is half the tile size (8), i.e. how close the source can get to the target
                    //  before it is considered as being there. The faster it moves, the more tolerance is required.
                    if (distance < 8) {
                        tmp_player.body.reset(tmp_player.x, tmp_player.y);
                        tmp_player.click_move_target = null;
                        this.crosshair.setVisible(false);
                    }
                }
            } else {
                // if (!tmp_player.enough_buffer) {
                //     if (tmp_player.received_frames.size > 5) {
                //         tmp_player.enough_buffer = true;
                //     } else {
                //         return;
                //     }
                // }

                let next_frame_target = tmp_player.received_frames.dequeue();
                if (!!next_frame_target) {
                    // tmp_player.sync_dirty = true;
                    tmp_player.sync_target.x = next_frame_target.px;
                    tmp_player.sync_target.y = next_frame_target.py;
                    tmp_player.body.setVelocity(next_frame_target.vx, next_frame_target.vy);
                }

                // if (!!tmp_player.sync_dirty) {
                // TODO Reduce allocations
                // tmp_player.sync_dirty = false;
                // let _new_pos = Phaser.Math.Vector2.prototype.lerp.apply(_player, _player.sync_target, 0.1);
                let _old_pos = new Phaser.Math.Vector2(tmp_player.x, tmp_player.y);
                let _new_pos = _old_pos.lerp(tmp_player.sync_target, 0.1);

                tmp_player.x = _new_pos.x;
                tmp_player.y = _new_pos.y;
                // }
            }
        });
        for (let [ball_id, tmp_ball] of this.ballMap) {
            if (!!tmp_ball) {
                if (!!tmp_ball.thrower_player_id && tmp_ball.thrower_player_id == this.player_id) {
                    this.peerChat.playerThrowBall(this.player_id,
                        ball_id, tmp_ball.fake.x, tmp_ball.fake.y, tmp_ball.fake.body.velocity.x, tmp_ball.fake.body.velocity.y);
                    this.on_throw_ball(this.player_id, ball_id, tmp_ball.fake.x, tmp_ball.fake.y, tmp_ball.fake.body.velocity.x, tmp_ball.fake.body.velocity.y);
                }

                if (!!tmp_ball.start_simulation && !tmp_ball.holder_player_id) {
                    // a) Only simulate after the buffer has been filled (start_simulation set to true)
                    // b) Ignore the throw simulation when ball is held

                    let next_frame_target = tmp_ball.physics_buffer.pop();
                    // console.log("Maybe replay ball from buffer %s", JSON.stringify(next_frame_target));
                    if (!!next_frame_target) {
                        tmp_ball.body.setVelocity(next_frame_target.vx, next_frame_target.vy);

                        let sync_target = new Phaser.Math.Vector2(next_frame_target.px, next_frame_target.py);
                        let _old_pos = new Phaser.Math.Vector2(tmp_ball.x, tmp_ball.y);
                        let _new_pos = _old_pos.lerp(sync_target, 0.5);
                        // console.log("Replaying ball from physics buffer");
                        tmp_ball.x = _new_pos.x;
                        tmp_ball.y = _new_pos.y;
                    }

                }
            }

        }
    }



    addNewPlayer(p_id, p_pos_x, p_pos_y, p_sprite_id, p_username) {
        if (!!this.playerMap[p_id]) {
            // Player already exists in array, we're good
            return;
        }
        console.log("Setting new player %s", p_id);

        this.players.push(p_id);
        let _new_player = this.physics.add.sprite(p_pos_x, p_pos_y, 'char_' + p_sprite_id, 0);
        // _new_player.body.velocity.x = p_vel_x;
        // _new_player.body.velocity.y = p_vel_y;
        // this.adaptive_layer.add(_new_player);
        this.playerMap[p_id] = _new_player;
        _new_player.player_id = p_id;
        _new_player.scale = 3;
        _new_player.sprite_id = p_sprite_id;
        _new_player.username = p_username;
        _new_player.setCircle(3, 5, 10);
        _new_player.sync_target = new Phaser.Math.Vector2(p_pos_x, p_pos_y);
        _new_player.sync_dirty = false;
        _new_player.received_frames = new Queue();
        this.player_group.add(_new_player);
        for (let [_ball_id, tmp_ball] of this.ballMap) {
            if (!!tmp_ball) { // FIXME This should iterate over all balls
                this.physics.add.overlap(_new_player, tmp_ball, this.on_ball_collision, null, this);
            }
        }
        if (p_id == this.player_id) {
            this.current_player = _new_player;
            this.current_player.player_id = this.player_id;

            this.cameras.main.startFollow(_new_player, false, 1, 1);
            this.cameras.main.following_player = true;
            // NOTE Second parameter of startFollow is for rounding pixel jitter. 
            // Setting it to true will fix the jitter of world tiles but add jitter for the player sprite.

            this.physics.add.overlap(_new_player, this.screen_control_collision_layer, this.entered_screen_control_trigger, this.process_overlap_screen_control, this);
        }
        _new_player.setPushable(false);
        // _new_player.setImmovable(true);
        _new_player.setBounce(0);
        // Add label
        let style = { font: "14px Arial", fill: "#000000", wordWrap: false, wordWrapWidth: (_new_player.width * _new_player.scale), align: "center" };//, backgroundColor: "#ffff00" };
        _new_player.name_label = this.add.text(
            _new_player.x + (_new_player.width * _new_player.scale) / 2, _new_player.y + (_new_player.height * _new_player.scale) / 2, _new_player.username, style);
        _new_player.name_label.texture.setFilter(0);

        _new_player.chat_bubble = this.add.sprite(0, 0, "speech_bubble");
        _new_player.chat_bubble.alpha = 0;
        _new_player.muted_mic_sprite = this.add.sprite(0, 0, 'muted_mic');
        _new_player.muted_mic_sprite.alpha = 0.8;
        _new_player.muted_mic_sprite.scale = 0.25;
        _new_player.muted_mic_sprite.setVisible(false);

    };

    entered_screen_control_trigger(p_player, p_area_layer) {
        if (!!p_player.ignore_open_screen_control) {
            return;
        }
        p_player.ignore_open_screen_control = true;
        this.show_video_controls();
    }

    process_overlap_screen_control(p_player, p_area_layer) {
        p_player.inside_screen_control_area = !!(this.screen_control_collision_layer.getTileAtWorldXY(p_player.x, p_player.y));
        if (!p_player.inside_screen_control_area) {
            if (!!p_player.ignore_open_screen_control) {
                p_player.ignore_open_screen_control = false;
                return false;
            }
        }
        return p_player.inside_screen_control_area;
    }



    updatePlayerPhysics(p_id, p_data) {

        let tmp_player = this.playerMap[p_id];
        if (!tmp_player) {
            // console.warn("updatePlayerPhysics Player is null");
            return;
        }
        tmp_player.received_frames.enqueue(p_data);
        while (tmp_player.received_frames.size > 10) {
            tmp_player.received_frames.dequeue();
        }
    }


    movePlayerToPos(p_id, p_pos_x, p_pos_y) {

        let tmp_player = this.playerMap[p_id];
        if (!tmp_player) {
            // console.log("movePlayerToPos Player is null");
            return;
        }

        tmp_player.click_move_target = new Phaser.Math.Vector2(p_pos_x, p_pos_y);

        let distance = Phaser.Math.Distance.Between(tmp_player.x, tmp_player.y, p_pos_x, p_pos_y);

        this.physics.moveToObject(tmp_player, tmp_player.click_move_target, null,
            distance / MainGame.MOVE_CLICK_SPEED);

        if (this.player_id == p_id) {
            this.crosshair.setPosition(p_pos_x, p_pos_y);
            this.crosshair.setVisible(true);
        }
        return tmp_player;
    }

    removePlayer(p_id) {
        try {
            if (p_id == this.player_id) {
                // console.warn("Refused to delete own player. wtf is happening on the server?");
                return;
            }
            let index_thing = this.players.indexOf(p_id);
            if (index_thing != -1) { this.players.splice(index_thing, 1); }

            // this.peerChat.peer_volume_meter_map.delete(this.peerChat.player_peer_map.get(p_id));
            // this.peerChat.player_peer_map.delete(p_id);
            this.playerMap[p_id].name_label.destroy();
            this.playerMap[p_id].chat_bubble.destroy();
            this.playerMap[p_id].muted_mic_sprite.destroy();
            this.playerMap[p_id].destroy();
            delete this.playerMap[p_id];
        } catch (error) {
            console.error("Error in removePlayer", error);
        }
    };

    load_screen_controls() {
        if (!!this.screen_controls_hint)
            return console.log("Refuse to load_screen_controls repeatedly");


        // TODO Maybe animate alpha for this
        this.screen_controls_hint = this.add.dom(1425, 80).createFromHTML(screen_controls_hint_html);

        this.screen_controls = this.add.dom(625, 400).createFromHTML(screen_controls_html);
        this.screen_controls.setScrollFactor(0);

        this.screen_controls.node.style.visibility = "hidden";

        this.videolink = this.screen_controls.getChildByID('videolink');
        // this.videolink.value = `https://www.youtube.com/watch?v=${this.current_video_id}`;
        this.videolink_validhint = this.screen_controls.getChildByID('validhint');
    }

    show_video_controls() {
        try {


            if (!this.screen_controls)
                return;

            const self = this;
            this.showing_focused_ui = true;
            this.screen_controls.node.style.visibility = "visible";

            // self.videolink.value = `https://www.youtube.com/watch?v=${self.current_video_id}`;

            try {
                if (this.current_yt_type == "list") {
                    this.videolink.value = `https://www.youtube.com/playlist?list=${this.current_playlist_id}`;
                }
                else if (this.current_yt_type == "video") {
                    this.videolink.value = `https://www.youtube.com/watch?v=${this.current_video_id}`;
                };
            } catch (error) {
                console.error("Error setting videolink.value");
            }
            let string_before_open = self.videolink.value;

            var on_change_fn = function (event) {
                let new_entered = self.videolink.value;
                if (new_entered !== '') {
                    // From https://stackoverflow.com/questions/6903823/regex-for-youtube-id
                    // and https://stackoverflow.com/questions/2936467/parse-youtube-video-id-using-preg-match/6382259#6382259

                    let videoId = get_yt_id_from_link(new_entered);
                    if (!!videoId) {
                        self.videolink_validhint.innerHTML = "☑"
                        self.videolink_validhint.style.color = "#00c569";
                    } else {
                        self.videolink_validhint.innerHTML = "✖"
                        self.videolink_validhint.style.color = "#f01c63";
                    }
                    // console.log("Changed hint for valid url.");
                }
            };

            this.videolink.addEventListener("change", on_change_fn);
            this.videolink.addEventListener("input", on_change_fn);
            this.videolink.addEventListener("paste", on_change_fn);
            this.videolink.addEventListener("keypress", on_change_fn);

            this.screen_controls.addListener('click');
            // this.screen_controls.setPerspective(800);
            this.screen_controls.on('click', function (event) {

                if (event.target.name === 'applyButton') {
                    self.screen_controls.node.style.visibility = "hidden";
                    this.removeListener('click');
                    self.showing_focused_ui = false;

                    let new_entered = self.videolink.value;
                    if (new_entered !== '') {
                        // From https://stackoverflow.com/questions/6903823/regex-for-youtube-id
                        // and https://stackoverflow.com/questions/2936467/parse-youtube-video-id-using-preg-match/6382259#6382259

                        let videoId = get_yt_id_from_link(new_entered);
                        if (!videoId || !(videoId.length > 0)) {
                            // matched nothing
                            return;
                        }
                        if (videoId[0] == "video") {
                            let new_vid = videoId[1];
                            if (!!new_vid && self.current_video_id != new_vid) {
                                console.log("Apply loading video with ID %s", new_vid);
                                self.play_youtube_thing("video", new_vid);
                                self.socketClient.sendYoutubeChangeURL(self.player_id, { t: "video", id: new_vid });
                            } else {
                                if (self.current_video_id == videoId) {
                                    console.log("Video already loaded");
                                }
                            }
                        }
                        else if (videoId[0] == "list") {
                            let new_playlist = videoId[1];
                            if (!!new_playlist && self.current_playlist_id != new_playlist) {
                                self.play_youtube_thing("list", new_playlist);
                                self.socketClient.sendYoutubeChangeURL(self.player_id, { t: "list", id: new_playlist });
                            } else {
                                if (self.current_playlist_id == new_playlist) {
                                    console.log("Video already loaded");
                                }
                            }
                        } else {
                            console.log("Did not match any type in link.");
                        }

                    }

                }
                else if (event.target.name === 'cancelButton') {
                    self.screen_controls.node.style.visibility = "hidden";
                    this.removeListener('click');
                    self.showing_focused_ui = false;

                    self.videolink.value = string_before_open; //`https://www.youtube.com/watch?v=${self.current_video_id}`;

                    // self.scene.tweens.add({ targets: text, alpha: 0.1, duration: 200, ease: 'Power3', yoyo: true });
                }

            });


        } catch (error) {
            console.error("Error in show_video_controls %s", error);
        }
    }

    play_youtube_thing(p_type, p_id, p_index = 0) {
        try {
            if (p_type == "list" && this.current_playlist_id != p_id) {
                this.current_yt_type = p_type;
                let t_index = !!p_index && Number(p_index) > 0 ? Number(p_index) : 0;
                this.youtubePlayer.loadPlaylist(p_id, t_index);
                this.current_playlist_id = p_id;
                this.current_video_id = null;
                if (!!this.videolink)
                    this.videolink.value = `https://www.youtube.com/playlist?list=${p_id}`;
            }
            else if (p_type == "video" && this.current_video_id != p_id) {
                this.current_yt_type = p_type;
                this.youtubePlayer.load(p_id);
                this.current_video_id = p_id;
                this.current_playlist_id = null;
                if (!!this.videolink)
                    this.videolink.value = `https://www.youtube.com/watch?v=${p_id}`;
            };
        } catch (error) {
            console.error("Error in play_youtube_thing", error);
        };

    }
}



// This one is pure wizardry courtesy of my friend  https://regex101.com/r/qCDoob/1
var regexep_youtube = /^(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/(.*?)\??(?:v|list)=(.*?)(?:&|$)|^(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?(?:(?!=).)*\/(.*)$/;
var get_yt_id_from_link = function (url) {
    // console.log("Regexing url %s", url);
    var code = url.match(regexep_youtube);
    // console.log(JSON.stringify(code));
    if (!code)
        return null;

    if ((typeof code[1] == 'string') && code[1].length > 0) {
        if (code[1] != 'playlist' && code[1] != 'embed/videoseries') {
            return ["video", code[2]];
        } else {
            // link is for a playlist
            // TODO Queue playlist
            return ["list", code[2]];
        }
    } else {
        return ["video", code[3]];
    }
}


// This one works well for the regular case
// var regexep_youtube_fallback = /(?:https?:\/\/)?(?:www\.)?(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([\w-]{11})(?:.+)?/;
// var get_yt_id_from_link = function (url) {
//     // console.log("Regexing url %s", url);
//     var code = url.match(regexep_youtube_fallback);
//     console.log(JSON.stringify(code));

//     return (!!code && (typeof code[1] == 'string')) ? code[1] : false;
// }

// This one works very well for rare links
// var regexep_youtube = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
//This one is best for capturing list id, or vid id if available
// ^ (?: https ?: \/\/)?(?:www\.)?youtu\.?be(?:\.com)?.*?(?:v|list)=(.*?)(?:&|$)|^(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?(?:(?!=).)*\/(.*)$

// /youtu(?:.*\/v\/|.*v\=|\.be\/)([A-Za-z0-9_\-]{11})/;