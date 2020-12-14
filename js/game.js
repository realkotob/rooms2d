
var Game = {};

Game.init = function () {
    game.stage.disableVisibilityChange = true;
};

Game.preload = function () {
    game.load.tilemap('map', 'assets/map/example_map.json', null, Phaser.Tilemap.TILED_JSON);
    game.load.spritesheet('tileset', 'assets/map/tilesheet.png', 32, 32);
    game.load.image('sprite', 'assets/sprites/sprite.png');
};

Game.create = function () {
    Game.playerMap = {};
    var testKey = game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
    testKey.onDown.add(Client.sendTest, this);
    var map = game.add.tilemap('map');
    map.addTilesetImage('tilesheet', 'tileset'); // tilesheet is the key of the tileset in map's JSON file
    var layer;
    for (var i = 0; i < map.layers.length; i++) {
        layer = map.createLayer(i);
    }
    layer.inputEnabled = true; // Allows clicking on the map ; it's enough to do it on the last layer
    layer.events.onInputUp.add(Game.getCoordinates, this);
    Client.askNewPlayer();
};

Math.clamp = function (val, min, max) { return Math.max(min, Math.min(max, val)); };
Game.update = function () {
    if (!Game.player_id) {
        return;
    }
    var current_player = Game.playerMap[Game.player_id];
    if (!current_player) {
        return;
    }
    var video_parent = document.querySelector('#media-container');
    for (var i = 0; i < Game.players.length; i++) {
        var p_id = Game.players[i];
        if (p_id == Game.player_id) {
            continue;
        }
        var child_video = video_parent ? video_parent.querySelector('#' + p_id) : null;
        if (!child_video) {
            continue;
        }
        var player = Game.playerMap[p_id];
        if (player) {
            var distance = Phaser.Math.distance(
                player.x, player.y, current_player.x, current_player.y);

            child_video.volume = Math.clamp(distance / 200, 0, 1);
        }
    }
}

Game.getCoordinates = function (layer, pointer) {
    Client.sendClick(pointer.worldX, pointer.worldY);
};

Game.players = [];
Game.addNewPlayer = function (p_id, p_x, p_y) {
    Game.players.append(p_id)
    Game.playerMap[p_id] = game.add.sprite(p_x, p_y, 'sprite');
};

Game.movePlayer = function (id, x, y) {
    var player = Game.playerMap[id];
    var distance = Phaser.Math.distance(player.x, player.y, x, y);
    var tween = game.add.tween(player);
    var duration = distance * 10;
    tween.to({ x: x, y: y }, duration);
    tween.start();
};

Game.removePlayer = function (id) {
    for (var i = 0; i < Game.players.length; i++) {
        if (Game.players[i] == id) { Game.players.splice(i, 1); }
    }
    Game.playerMap[id].destroy();
    delete Game.playerMap[id];
};