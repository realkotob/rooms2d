

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

        this.Client.sendTest = function () {
            console.log("test sent");
            self.Client.socket.emit('test');
        };

        this.Client.askNewPlayer = function () {
            self.Client.socket.emit('newplayer');
        };

        this.Client.sendClick = function (x, y) {
            self.Client.socket.emit('click', { x: x, y: y });
        };
        this.Client.sendMove = function (x, y) {
            self.Client.socket.emit('move', { x: x, y: y });
        };

        this.Client.socket.on('newplayer', function (data) {
            self.addNewPlayer(data.id, data.x, data.y);
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
                self.addNewPlayer(_all[i].id, _all[i].x, _all[i].y);
            }


            self.Client.socket.on('clicked', function (data) {
                if (self.player_id != data.id) {
                    // console.log("player %s clicked. current player %s", data.id, self.player_id)
                    self.movePlayerTo(data.id, data.x, data.y);
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
        this.load.image('crosshair', 'assets/sprites/crosshair.png');
    };

    create() {
        const self = this;

        this.phaser_created = true;



        // var testKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        // testKey.onDown.add(this.Client.sendTest, this);
        var map = this.make.tilemap({ key: 'map', tileWidth: 32, tileHeight: 32 });
        var tileset = map.addTilesetImage('tilesheet');
        // var layer = map.createLayer(0, tileset, 100, 200);
        // var layer = map.createLayer("layer 1", tileset);
        var layer;
        for (var i = 0; i < map.layers.length; i++) {
            layer = map.createLayer(i, tileset);
        }

        //  Set the camera and physics bounds to be the size of 4x4 bg images
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.zoom = 2;

        // layer.inputEnabled = true; // Allows clicking on the map ; it's enough to do it on the last layer
        this.Client.askNewPlayer();

        this.crosshair = this.add.sprite(-100, -100, 'crosshair');
        this.crosshair.setVisible(false);


        this.input.mouse.disableContextMenu();

        this.input.on('pointerdown', function (pointer) {

            if (pointer.leftButtonDown()) {
                var world_pointer = self.cameras.main.getWorldPoint(pointer.x, pointer.y);
                self.movePlayerTo(this.player_id, world_pointer.x, world_pointer.y);
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

        // Alternatives
        // this.keys_wasd = this.input.keyboard.addKeys('W,S,A,D');
        // this.key_down = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        // this.key_up = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        // this.key_left = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
        // this.key_right = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

    }

    update(time, delta) {
        if (!this.player_id || !this.current_player) {
            return;

        }
        this.handle_player_controls(delta);
        this.handle_voice_proxomity();
        this.updatePlayerYSort();
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



    addNewPlayer(p_id, p_x, p_y) {
        this.players.push(p_id);
        var _new_player = this.physics.add.sprite(p_x, p_y, 'sprite');
        this.playerMap[p_id] = _new_player;
        if (p_id == this.player_id) {
            this.current_player = _new_player;
            _new_player.body.collideWorldBounds = true;

            this.cameras.main.startFollow(_new_player, false, 1, 1);
            // NOTE Second parameter of startFollow is for rounding pixel jitter. 
            // Setting it to true will fix the jitter of world tiles but add jitter for the player sprite.
        }
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
        this.players.forEach(_index => {
            var player = this.playerMap[_index];
            if (!!player) {
                player.depth = player.y + player.height / 2;
            }
        });
        // if (!!this.crosshair)
        //     this.crosshair.depth = this.crosshair.y + this.crosshair.height / 2;

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
        this.playerMap[id].destroy();
        delete this.playerMap[id];
    };


}


