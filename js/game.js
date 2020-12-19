

export default class MainGame extends Phaser.Scene {
    static MAX_HEAR_DISTANCE = 400;
    Client = {};

    constructor() {
        super('MainGame');

        this.phaser_created = false;


        this.playerMap = {};
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
            console.log("My new player id is ", data.you.id);
            self.player_id = data.you.id.toString();
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
                if (this.player_id != data.id)
                    self.movePlayerTo(data.id, data.x, data.y);
            });

            self.Client.socket.on('moved', function (data) {
                if (this.player_id != data.id)
                    self.setPlayerPos(data.id, data.x, data.y);
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
    };

    create() {
        const self = this;

        this.phaser_created = true;

        // FIXME This part is not good, because it means it overwrites anything that was recieved before phaser loaded


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

        // layer.inputEnabled = true; // Allows clicking on the map ; it's enough to do it on the last layer
        this.Client.askNewPlayer();


        this.input.mouse.disableContextMenu();

        this.input.on('pointerdown', function (pointer) {

            if (pointer.leftButtonDown()) {
                self.movePlayerTo(this.player_id, pointer.x, pointer.y);
                self.Client.sendClick(pointer.x, pointer.y);
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

        this.MOVE_SPEED = 0.5;
    }

    update(time, delta) {
        if (!this.player_id) {
            return;
        }
        this.current_player = this.playerMap[this.player_id];
        if (!this.current_player) {
            return;
        }
        this.handle_player_controls(delta);
        this.handle_voice_proxomity();
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

        // this.incrementPlayerPos(this.player_id, this.current_move_input.x * delta * this.MOVE_SPEED, this.current_move_input.y * delta  * this.MOVE_SPEED);
        var _player = this.incrementPlayerPos(this.player_id, this.current_move_input.scale(delta * this.MOVE_SPEED));
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
            console.log(error);
        }
    }



    addNewPlayer(p_id, p_x, p_y) {
        this.players.push(p_id);
        this.playerMap[p_id] = this.add.sprite(p_x, p_y, 'sprite');
    };

    incrementPlayerPos(p_id, p_vector) {
        if (p_vector.lengthSq() == 0) {
            return null;
        }
        var player = this.playerMap[p_id];
        if (!player) {
            console.log("Warning! Player is null");
            return null;
        }
        player.x += p_vector.x;
        player.y += p_vector.y;
        return player;
    }

    setPlayerPos(p_id, p_x, p_y) {
        var player = this.playerMap[p_id];
        if (!player) {
            console.log("Warning! Player is null");
        }
        player.x = p_x;
        player.y = p_y;
    }

    movePlayerTo(p_id, p_x, p_y) {
        var player = this.playerMap[p_id];
        if (!player) {
            console.log("Warning! Player is null");
        }
        var distance = Phaser.Math.Distance.Between(player.x, player.y, p_x, p_y);
        if (distance <= 0) {
            console.log("Warning! Distance is 0");
            return;
        }
        var _duration = distance * 10;

        if (!!this.tween) {
            this.tween.stop();
        }

        this.tween = this.tweens.add({
            targets: player,
            x: p_x,
            y: p_y,
            // ease: 'Sine.easeIn',
            duration: _duration,
            paused: true
        });

        this.tween.play();

    };

    removePlayer(id) {
        for (var i = 0; i < this.players.length; i++) {
            if (this.players[i] == id) { this.players.splice(i, 1); }
        }
        this.playerMap[id].destroy();
        delete this.playerMap[id];
    };


}


