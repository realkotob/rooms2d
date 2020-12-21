var fs = require('fs');
var https = require('https');
var http = require('http');
var express = require('express');
var app = express();

var PORT = 8081;
const cert_path = '/etc/letsencrypt/live/testing.backend.groovyantoid.com/';


var server;
if (fs.existsSync(cert_path)) {
    PORT = 443;
    console.log("The file exists.");

    // var key = fs.readFileSync(__dirname + '/certs/server.key', 'utf8'); // Self signed
    // var cert = fs.readFileSync(__dirname + '/certs/server.cert', 'utf8');
    var key = fs.readFileSync(cert_path + 'privkey.pem', 'utf8');
    var cert = fs.readFileSync(cert_path + 'fullchain.pem', 'utf8');
    var options = {
        key: key,
        cert: cert
    };

    server = https.Server(options, app);

} else {
    console.log('The file does not exist.');
    server = http.Server(app);
}


var io = require('socket.io')(server,
    {
        cookie: false // from https://github.com/socketio/socket.io/issues/2276
    });
const { ExpressPeerServer } = require('peer');

const peerServer = ExpressPeerServer(server, {
    path: '/myapp'
});

app.use('*/peerjs', peerServer);
app.use('*/css', express.static(__dirname + '/css'));
app.use('*/js', express.static(__dirname + '/js'));
app.use('*/assets', express.static(__dirname + '/assets'));

const FORCE_ROOM_IN_URL = true;
const DEFAULT_ROOM = "general"

if (FORCE_ROOM_IN_URL) {
    app.get('/', function (req, res) {
        res.redirect('/r/' + DEFAULT_ROOM)
    });
} else {
    app.get('/', function (req, res) {
        res.sendFile(__dirname + '/index.html');
    });
}


app.get('/r/:roomid', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

server.lastPlayderID = 0;

server.listen(process.env.PORT || PORT, function () {
    // console.log('Listening on http://localhost:' + server.address().port);
    console.log(`Server running at: http://localhost:${PORT}/`);
});


const CHARACTER_SPRITE_COUNT = 24;
io.on('connection', function (socket) {

    socket.on('newplayer', async function (p_data) {
        let _room = DEFAULT_ROOM;
        if (!!p_data && !!p_data.room && !(/[^\w.]/.test(p_data.room))) {  // from https://stackoverflow.com/a/46125634
            _room = p_data.room;
        }
        // (newplayer_data && newplayer_data.room) || DEFAULT_ROOM);

        await socket.join(_room);

        server.lastPlayderID += 1;
        let _name = p_data.username && p_data.username.length > 0 ? p_data.username : ("P" + server.lastPlayderID);
        // console.log("Player name is %s", _name);
        socket.player = {
            id: server.lastPlayderID,
            room: _room,
            sprite: server.lastPlayderID % CHARACTER_SPRITE_COUNT,
            x: randomInt(100, 400),
            y: randomInt(100, 400),
            uname: _name
        };
        // console.log("Room for %s is %s", socket.player.id, socket.player.room);

        // console.log(socket.rooms); // Set { <socket.id>, "room1" }

        socket.emit('allplayers', { you: socket.player, all: await getAllPlayers(_room) });
        socket.to(_room).emit('newplayer', socket.player);

        socket.on('click', function (data) {
            // console.log('click to ' + data.x + ', ' + data.y);
            socket.player.x = data.x;
            socket.player.y = data.y;
            io.in(_room).emit('clicked', socket.player);
        });
        socket.on('move', function (data) {
            // console.log('move to ' + data.x + ', ' + data.y);
            socket.player.x = data.x;
            socket.player.y = data.y;
            io.in(_room).emit('moved', socket.player);
        });

        socket.on('disconnect', function () {
            io.in(_room).emit('remove', socket.player.id);
        });
    });

    socket.on('test', function () {
        console.log('test received');
    });
});

async function getAllPlayers(p_room) {
    // console.log("getAllPlayers in %s", p_room);

    var players = [];
    // var _sockets_ids = await io.sockets.allSockets();
    var _sockets_ids = await io.in(p_room).allSockets();
    for (const socket_id of _sockets_ids) {
        // console.log("Socket ID %s", (socket_id));
        let player_socket = io.of("/").sockets.get(socket_id);
        var player = player_socket && player_socket.player;
        if (!!player) players.push(player);
    };
    return players;
}

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}
