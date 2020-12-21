

export default class MainGame extends Phaser.Scene {
    static MAX_HEAR_DISTANCE = 400;
    static MOVE_TWEEN_SPEED = 0.25;
    static MOVE_SPEED = 0.25;
    Client = {};

    constructor() {
        super('MainGame');

        this.phaser_created = false;


        this.playerMap = {};
        this.tween_map = {};
        this.players = [];

    }

    static clamp(val, min, max) { return Math.max(min, Math.min(max, val)); };

    init() {
        // game.stage.disableVisibilityChange = true;

        const self = this;


        this.Client.socket = io.connect();

        // this.Client.socket.on('connected', function () {
        //     // get path from current URL
        //     let room = window.location.pathname.slice(3);   // remove leading /chat/
        //     let pos = room.indexOf('/');
        //     if (pos !== -1) {
        //         room = room.slice(0, pos);
        //     }
        //     console.log("Room ID %s", room);
        //     self.room_id = room;
        // });

        this.Client.sendTest = function () {
            console.log("test sent");
            self.Client.socket.emit('test');
        };

        this.Client.askNewPlayer = function () {
            let pos = window.location.pathname.indexOf('/r/');
            if (pos !== -1) {
                self.room_id = window.location.pathname.slice(pos + 3);
            }
            // console.log("Room ID %s", self.room_id);
            self.Client.socket.emit('newplayer', { room: self.room_id });
        };

        this.Client.sendClick = function (x, y) {
            self.Client.socket.emit('click', { x: x, y: y });
        };
        this.Client.sendMove = function (x, y) {
            self.Client.socket.emit('move', { x: x, y: y });
        };

        this.Client.socket.on('newplayer', function (data) {
            self.addNewPlayer(data.id, data.x, data.y, data.sprite);
        });


        this.Client.socket.on('allplayers', function (data) {
            self.player_id = data.you.id.toString();
            console.log("My new player id is ", self.player_id);
            self.peer = new Peer(self.player_id);
            self.peer.on('open', function () {
                console.log('My PeerJS ID is:', self.peer.id);

                const _all = data.all;
                for (var i = 0; i < _all.length; i++) {
                    if (_all[i].id != self.player_id)
                        call_player(_all[i].id);
                }
            });


            self.peer.on('call', (call) => {
                console.log("Answering player ");
                var getUserMedia_ = (navigator.getUserMedia
                    || navigator.webkitGetUserMedia
                    || navigator.mozGetUserMedia
                    || navigator.msGetUserMedia);
                getUserMedia_({ video: false, audio: true }, (stream) => {
                    call.answer(stream); // Answer the call with an A/V stream.
                    call.on('stream', (remoteStream) => {
                        // Show stream in some <video> element.
                        var peer_id = call.peer.toString();
                        console.log("Answered player " + peer_id);
                        const remoteVideo = document.getElementById("p" + peer_id);
                        if (remoteVideo) {
                            remoteVideo.srcObject = remoteStream;
                        } else {
                            var video = document.createElement('video');
                            video.srcObject = remoteStream;
                            video.autoplay = true;
                            video.id = "p" + peer_id;
                            var element = document.getElementById("media-container");
                            element.appendChild(video);
                        }
                    });
                }, (err) => {
                    console.error('Failed to get local stream', err);
                });
            });


            const _all = data.all;
            for (var i = 0; i < _all.length; i++) {
                self.addNewPlayer(_all[i].id, _all[i].x, _all[i].y, _all[i].sprite);
            }


            self.Client.socket.on('clicked', function (data) {
                if (self.player_id != data.id) {
                    // console.log("player %s clicked. current player %s", data.id, self.player_id)
                    self.movePlayerPhysics(data.id, data.x, data.y);
                }
            });

            self.Client.socket.on('moved', function (data) {
                if (self.player_id != data.id) {
                    // console.log("player %s moved. current player %s", data.id, self.player_id)
                    self.setPlayerPos(data.id, data.x, data.y, true);
                }
            });

            self.Client.socket.on('remove', function (id) {
                self.removePlayer(id);
            });
        });

        function call_player(p_id) {
            console.log("Calling player ", p_id);
            self.conn = self.peer.connect(p_id);

            self.conn.on('open', function () {
                // Receive messages
                self.conn.on('data', function (data) {
                    console.log('Received', data);
                });

                // Send messages
                self.conn.send('Hello!');
            });

            var getUserMedia_ = (navigator.getUserMedia
                || navigator.webkitGetUserMedia
                || navigator.mozGetUserMedia
                || navigator.msGetUserMedia);
            getUserMedia_({ video: false, audio: true }, (stream) => {
                console.log("Got media stream to call player ", p_id);
                const call = self.peer.call(p_id.toString(), stream);
                call.on('stream', (remoteStream) => {
                    // Show stream in some <video> element.
                    var peer_id = p_id.toString();
                    const remoteVideo = document.getElementById("p" + peer_id);
                    if (remoteVideo) {
                        remoteVideo.srcObject = remoteStream;
                    } else {
                        var video = document.createElement('video');
                        video.srcObject = remoteStream;
                        video.autoplay = true;
                        video.id = "p" + peer_id;
                        var element = document.getElementById("media-container");
                        element.appendChild(video);
                    }
                });
            }, (err) => {
                console.error('Failed to get local stream', err);
            });
        }

    };

    preload() {
        this.load.tilemapTiledJSON('map', 'assets/map/example_map.json');
        this.load.image('tilesheet', 'assets/map/tilesheet.png');
        this.load.image('sprite', 'assets/sprites/sprite.png');
        this.load.image('ball', 'assets/sprites/ball.png');
        this.load.image('crosshair', 'assets/sprites/crosshair.png');
        this.load.spritesheet('characters', 'assets/sprites/32_Characters/All.png', { frameWidth: 48, frameHeight: 51 });
        this.load.spritesheet('slime', 'assets/sprites/slime_monster/slime_monster_spritesheet.png', { frameWidth: 24, frameHeight: 24 });

        var url = 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexyoutubeplayerplugin.min.js';
        this.load.plugin('rexyoutubeplayerplugin', url, true);
    };

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

    on_hit_ball() {
        console.log("Player hit ball");
    }

    create() {
        const self = this;

        // this.adaptive_layer = this.add.container();

        this.phaser_created = true;

        let yt_original_config = {
            x: 1300,
            y: 160,
            width: 426,
            height: 240
        }

        this.youtubePlayer = this.add.rexYoutubePlayer(
            yt_original_config.x, yt_original_config.y, yt_original_config.width, yt_original_config.height, {
            videoId: 'OkQlrIQhUMQ',
            modestBranding: true,
            loop: false,
            autoPlay: false,
        }).on('ready', function () {
            console.log("Video ready");
            // self.youtubePlayer.setPosition(600, 300);
        });

        this.youtubePlayer.original_config = yt_original_config;



        // var testKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        var map = this.make.tilemap({ key: 'map', tileWidth: 32, tileHeight: 32 });
        var map1 = this.make.tilemap({ key: 'map', tileWidth: 32, tileHeight: 32 });
        var map2 = this.make.tilemap({ key: 'map', tileWidth: 32, tileHeight: 32 });
        var map3 = this.make.tilemap({ key: 'map', tileWidth: 32, tileHeight: 32 });
        var tileset = map.addTilesetImage('tilesheet');
        var layer;
        for (var i = 0; i < map.layers.length; i++) {
            layer = map.createLayer(i, tileset);
        }
        for (var i = 0; i < map1.layers.length; i++) {
            layer = map1.createLayer(i, tileset, map.widthInPixels);
        }
        for (var i = 0; i < map2.layers.length; i++) {
            layer = map2.createLayer(i, tileset, 0, map.heightInPixels);
        }
        for (var i = 0; i < map3.layers.length; i++) {
            layer = map3.createLayer(i, tileset, map.widthInPixels, map.heightInPixels);
        }

        // this.adaptive_layer.add(map);

        //  Set the camera and physics bounds to be the size of 4x4 bg images
        this.cameras.main.setBounds(0, 0, map.widthInPixels * 2, map.heightInPixels * 2);
        this.physics.world.setBounds(0, 0, map.widthInPixels * 2, map.heightInPixels * 2);
        this.cameras.main.zoom = 1.5;
        this.youtubePlayer.original_config.zoom = this.cameras.main.zoom;


        // this.input.on('wheel', function (pointer, gameObjects, deltaX, deltaY, deltaZ) {
        //     let _new_zoom = MainGame.clamp(self.cameras.main.zoom - deltaY * 0.025, 1.2, 1.6);
        //     self.cameras.main.zoom = _new_zoom;
        //     let _zoom_change = (self.youtubePlayer.original_config.zoom - _new_zoom) / self.youtubePlayer.original_config.zoom;
        //     self.youtubePlayer.x = self.youtubePlayer.original_config.x - _zoom_change * 130;
        //     self.youtubePlayer.y = self.youtubePlayer.original_config.y - _zoom_change * 70;
        // });


        // layer.inputEnabled = true; // Allows clicking on the map ; it's enough to do it on the last layer
        this.Client.askNewPlayer();

        this.crosshair = this.add.sprite(-100, -100, 'crosshair');
        this.crosshair.setVisible(false);
        // this.adaptive_layer.add(this.crosshair);


        this.ball = this.physics.add.sprite(400, 200, 'slime', 6);
        this.ball.scale = 2;
        // this.ball.body.bounce = new Phaser.Math.Vector2(1, 1);
        this.ball.body.setVelocity(100, 100);
        this.ball.setCollideWorldBounds(true);
        this.ball.setImmovable(false);
        this.ball.setBounce(1);
        this.ball.setCircle(12);
        this.ball.setPushable(true);
        this.ball.setDrag(40);
        this.ball.setMaxVelocity(1000);


        this.player_group = this.physics.add.group();
        this.physics.add.collider(this.player_group, this.ball, this.on_hit_ball);



        this.input.mouse.disableContextMenu();

        this.input.on('pointerdown', function (pointer) {
            if (pointer.leftButtonDown()) {
                var world_pointer = self.cameras.main.getWorldPoint(pointer.x, pointer.y);
                // console.log("Pressed local: %s %s world: %s %s", pointer.x, pointer.y, world_pointer.x, world_pointer.y);
                self.movePlayerPhysics(this.player_id, world_pointer.x, world_pointer.y);
                self.Client.sendClick(world_pointer.x, world_pointer.y);
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
    }

    update(time, delta) {
        if (!this.player_id || !this.current_player) {
            return;

        }
        this.handle_player_controls(delta);
        this.handle_voice_proxomity();
        this.updatePlayerYSort();
        this.handleVideo();
    }
    handleVideo() {
        var _distance_vid = Phaser.Math.Distance.Between(
            this.youtubePlayer.x, this.youtubePlayer.y, this.current_player.x, this.current_player.y);
        this.youtubePlayer.setVolume(1 - MainGame.clamp(_distance_vid / (MainGame.MAX_HEAR_DISTANCE * 2), 0, 1));
        let _dist_y = this.youtubePlayer.y - this.current_player.y;
        if (_distance_vid < MainGame.MAX_HEAR_DISTANCE * 0.75 && -_dist_y < MainGame.MAX_HEAR_DISTANCE / 2) {
            this.cameras.main.followOffset.y = Phaser.Math.Linear(this.cameras.main.followOffset.y, -_dist_y, 0.05);
        } else {
            this.cameras.main.followOffset.y = Phaser.Math.Linear(this.cameras.main.followOffset.y, 0, 0.05);
        }
    }

    handle_player_controls(delta) {
        this.current_move_input.set(0, 0);
        if (this.keys_arrows.up.isDown || this.keys_wasd.up.isDown) {
            this.current_move_input.y = -1;
        }
        if (this.keys_arrows.down.isDown || this.keys_wasd.down.isDown) {
            this.current_move_input.y = +1;
        }
        if (this.keys_arrows.right.isDown || this.keys_wasd.right.isDown) {
            this.current_move_input.x = +1;
        }
        if (this.keys_arrows.left.isDown || this.keys_wasd.left.isDown) {
            this.current_move_input.x = -1;
        }

        var move_vector = this.current_move_input.scale(delta * MainGame.MOVE_SPEED);
        if (move_vector.lengthSq() == 0) {
            return null;
        }

        if (!!this.tween_map[this.player_id]) {
            this.tween_map[this.player_id].stop();
            this.crosshair.setVisible(false);

        }

        var _player = this.incrementPlayerPos(this.player_id, move_vector);
        if (!!_player) {
            this.Client.sendMove(_player.x, _player.y);
        }


    }

    handle_voice_proxomity() {
        try {
            // let yt_pos = this.youtubePlayer.getPosition();

            var video_parent = document.querySelector('#media-container');
            for (var i = 0; i < this.players.length; i++) {
                var p_id = this.players[i];
                if (p_id == this.player_id) {
                    continue;
                }
                var child_video = video_parent ? video_parent.querySelector('#p' + p_id) : null;
                if (!child_video) {
                    continue;
                }
                var player = this.playerMap[p_id];
                if (!!player) {
                    var _distance = Phaser.Math.Distance.Between(
                        player.x, player.y, this.current_player.x, this.current_player.y);

                    var _volume = 1 - MainGame.clamp(_distance / MainGame.MAX_HEAR_DISTANCE, 0, 1);

                    child_video.volume = _volume;
                }
            }

        } catch (error) {
            console.warn(error);
        }
    }



    addNewPlayer(p_id, p_x, p_y, p_sprite_id) {
        this.players.push(p_id);
        var _new_player = this.physics.add.sprite(p_x, p_y, 'characters', p_sprite_id);
        // this.adaptive_layer.add(_new_player);
        this.playerMap[p_id] = _new_player;
        if (p_id == this.player_id) {
            this.current_player = _new_player;
            _new_player.body.collideWorldBounds = true;
            _new_player.setPushable(false);
            _new_player.setImmovable(true);
            _new_player.setBounce(0);
            this.cameras.main.startFollow(_new_player, false, 1, 1);
            // NOTE Second parameter of startFollow is for rounding pixel jitter. 
            // Setting it to true will fix the jitter of world tiles but add jitter for the player sprite.
            this.player_group.add(_new_player);
        }

        // Add label
        var style = { font: "14px Arial", fill: "#000000", wordWrap: true, wordWrapWidth: _new_player.width, align: "center" };//, backgroundColor: "#ffff00" };
        _new_player.name_label = this.add.text(_new_player.x + _new_player.width / 2, _new_player.y + _new_player.height / 2, "P" + p_id, style);
    };

    incrementPlayerPos(p_id, p_vector) {
        var player = this.playerMap[p_id];
        if (!player) {
            console.log("Warning! Player is null");
            return null;
        }
        player.x += p_vector.x;
        player.y += p_vector.y;
        return player;
    }

    setPlayerPos(p_id, p_x, p_y, lerp = false) {
        var player = this.playerMap[p_id];
        if (!player) {
            console.log("Warning! Player is null");
            return;
        }
        if (!!this.tween_map[p_id]) {
            this.tween_map[p_id].stop();
        }
        if (!!lerp) {
            var distance = Phaser.Math.Distance.Between(player.x, player.y, p_x, p_y);

            var _duration = distance / MainGame.MOVE_TWEEN_SPEED;

            this.tween_map[p_id] = this.tweens.add({
                targets: player,
                x: p_x,
                y: p_y,
                // ease: 'Sine.easeIn',
                duration: _duration,
                paused: false
            });

            // this.tween_map[p_id].play();
        } else {
            player.x = p_x;
            player.y = p_y;
        }
    }

    updatePlayerYSort() {
        const self = this;
        this.players.forEach(_index => {
            var player = this.playerMap[_index];
            if (!!player) {
                player.depth = player.y + player.height / 2;


                player.name_label.x = player.x - + player.name_label.width / 2;
                player.name_label.y = player.y + player.height / 2;




                if (player.body.speed > 0) {
                    var distance = Phaser.Math.Distance.Between(player.x, player.y, player.current_target.x, player.current_target.y);

                    //  4 is our distance tolerance, i.e. how close the source can get to the target
                    //  before it is considered as being there. The faster it moves, the more tolerance is required.
                    if (distance < 10) {
                        player.body.reset(player.current_target.x, player.current_target.y);
                        if (_index == self.player_id) {
                            self.crosshair.setVisible(false);

                        }
                    }
                }
            }
        });
        // if (!!this.crosshair)
        //     this.crosshair.depth = this.crosshair.y + this.crosshair.height / 2;

    }

    movePlayerPhysics(p_id, p_x, p_y) {
        const self = this;

        var player = this.playerMap[p_id];
        if (!player) {
            console.log("Warning! Player is null");
            return;
        }

        player.current_target = new Phaser.Math.Vector2(p_x, p_y);

        var distance = Phaser.Math.Distance.Between(player.x, player.y, p_x, p_y);


        this.physics.moveToObject(player, player.current_target, null,
            distance / MainGame.MOVE_TWEEN_SPEED);

        if (this.player_id == p_id) {
            this.crosshair.setPosition(p_x, p_y);
            this.crosshair.setVisible(true);
        }
    }

    movePlayerTo(p_id, p_x, p_y) {
        const self = this;

        var player = this.playerMap[p_id];
        if (!player) {
            console.log("Warning! Player is null");
            return;
        }
        var distance = Phaser.Math.Distance.Between(player.x, player.y, p_x, p_y);
        if (distance <= 0) {
            console.log("Warning! Distance is 0. Move ignored.");
            return;
        }
        var _duration = distance / MainGame.MOVE_TWEEN_SPEED;

        // this.physics.moveToObject(player, pointer, _duration);

        if (!!this.tween_map[p_id]) {
            this.tween_map[p_id].stop();
        }

        this.tween_map[p_id] = this.tweens.add({
            targets: player,
            x: p_x,
            y: p_y,
            // ease: 'Sine.easeIn',
            duration: _duration,
            paused: false,
            onComplete: function () {
                self.crosshair.setVisible(false);
            },
        });

        if (this.player_id == p_id) {
            this.crosshair.setPosition(p_x, p_y);
            this.crosshair.setVisible(true);
        }

        // this.tween_map[p_id].play();

    };

    removePlayer(id) {
        for (var i = 0; i < this.players.length; i++) {
            if (this.players[i] == id) { this.players.splice(i, 1); }
        }
        this.playerMap[id].name_label.destroy();
        this.playerMap[id].destroy();
        delete this.playerMap[id];
    };


}


