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


var io = require('socket.io').listen(server);
const { ExpressPeerServer } = require('peer');

const peerServer = ExpressPeerServer(server, {
    path: '/myapp'
});

app.use('/peerjs', peerServer);
app.use('/css', express.static(__dirname + '/css'));
app.use('/js', express.static(__dirname + '/js'));
app.use('/assets', express.static(__dirname + '/assets'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

server.lastPlayderID = 1;

server.listen(process.env.PORT || PORT, function () {
    // console.log('Listening on http://localhost:' + server.address().port);
    console.log(`Server running at: http://localhost:${PORT}/`);
});

io.on('connection', function (socket) {

    socket.on('newplayer', function () {
        socket.player = {
            id: server.lastPlayderID++,
            x: randomInt(100, 400),
            y: randomInt(100, 400)
        };
        socket.emit('allplayers', { you: socket.player, all: getAllPlayers() });
        socket.broadcast.emit('newplayer', socket.player);

        socket.on('click', function (data) {
            // console.log('click to ' + data.x + ', ' + data.y);
            socket.player.x = data.x;
            socket.player.y = data.y;
            io.emit('clicked', socket.player);
        });
        socket.on('move', function (data) {
            // console.log('move to ' + data.x + ', ' + data.y);
            socket.player.x = data.x;
            socket.player.y = data.y;
            io.emit('moved', socket.player);
        });

        socket.on('disconnect', function () {
            io.emit('remove', socket.player.id);
        });
    });

    socket.on('test', function () {
        console.log('test received');
    });
});

function getAllPlayers() {
    var players = [];
    Object.keys(io.sockets.connected).forEach(function (socketID) {
        var player = io.sockets.connected[socketID].player;
        if (player) players.push(player);
    });
    return players;
}

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}
