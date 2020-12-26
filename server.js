const pino = require('pino');
const logger = require('pino')();


// Log loss prevention from https://github.com/pinojs/pino/blob/master/docs/asynchronous.md#log-loss-prevention
const handler = pino.final(logger, (err, finalLogger, evt) => {
    finalLogger.info(`${evt} caught`);
    if (err) finalLogger.error(err, 'error caused exit');
    process.exit(err ? 1 : 0);
})
process.on('beforeExit', () => handler(null, 'beforeExit'))
process.on('exit', () => handler(null, 'exit'))
process.on('uncaughtException', (err) => handler(err, 'uncaughtException'))
process.on('SIGINT', () => handler(null, 'SIGINT'))
process.on('SIGQUIT', () => handler(null, 'SIGQUIT'))
process.on('SIGTERM', () => handler(null, 'SIGTERM'))

const { encode, decode } = require("@msgpack/msgpack");
var fs = require('fs');

var https = require('https');
var http = require('http');
var express = require('express');
var app = express();

var PORT = 8081;
const cert_path = '/etc/letsencrypt/live/testing.backend.groovyantoid.com/';


var server;
var SSL_FOUND = false;
var httpServer = http.Server(app);
if (fs.existsSync(cert_path)) {
    PORT = 443;
    SSL_FOUND = true;
    logger.info("cert_path found, starting with SSL.");

    // var key = fs.readFileSync(__dirname + '/certs/server.key', 'utf8'); // Self signed
    // var cert = fs.readFileSync(__dirname + '/certs/server.cert', 'utf8');
    let key = fs.readFileSync(cert_path + 'privkey.pem', 'utf8');
    let cert = fs.readFileSync(cert_path + 'fullchain.pem', 'utf8');
    let options = {
        key: key,
        cert: cert
    };

    server = https.Server(options, app);

    // Reroute to https internally. It's better to use nginx for this later 
    // See https://stackoverflow.com/a/24015460
    // See https://developer.ibm.com/languages/node-js/tutorials/make-https-the-defacto-standard/
    app.all('*', ensureSecure); // at top of routing calls

    function ensureSecure(req, res, next) {
        if (req.secure) {
            // OK, continue
            return next();
        };
        // handle port numbers if you need non defaults
        // res.redirect('https://' + req.host + req.url); // express 3.x
        res.redirect('https://' + req.hostname + req.url); // express 4.x
    }


} else {
    logger.warn("cert_path not found, starting unsecure http.");
    server = httpServer;
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


app.set('appPath', __dirname + '/public');
// app.use(express.static(__dirname + '/public'));
app.use('*/public', express.static(__dirname + '/public'));

const FORCE_ROOM_IN_URL = true;
const DEFAULT_ROOM = "general"

if (FORCE_ROOM_IN_URL) {
    app.get('/', function (req, res) {
        try {
            res.redirect('/r/' + DEFAULT_ROOM);
        } catch (error) {
            logger.error(`error in app get redirect /r/ ${error}`);
        }
    });
} else {
    app.get('/', function (req, res) {
        try {
            res.sendFile(app.get('appPath') + '/index.html');

        } catch (error) {
            logger.error(`error in app get / ${error}`);
        }
    });
}

app.get('/r/:roomid', function (req, res) {
    try {
        res.sendFile(app.get('appPath') + '/index.html');
    } catch (error) {
        logger.error(`error in app get /r/:roomid ${error}`);
    }
});

server.lastPlayderID = 0;

server.listen(process.env.PORT || PORT, function () {
    // console.log('Listening on http://localhost:' + server.address().port);
    console.log(`Server running at: http://localhost:${PORT}/`);
});
if (SSL_FOUND) {
    httpServer.listen(80);
}


const CHARACTER_SPRITE_COUNT = 24;
io.on('connection', function (socket) {

    socket.on('newplayer', async function (p_data) {
        try {
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
                room: _room,
                sprite: server.lastPlayderID % CHARACTER_SPRITE_COUNT,
                uname: _name,
                rt: {
                    id: server.lastPlayderID,
                    px: randomInt(100, 400),
                    py: randomInt(100, 400),
                    vx: 0,
                    vy: 0,
                }
            };
            // console.log("Room for %s is %s", socket.player.id, socket.player.room);

            // console.log(socket.rooms); // Set { <socket.id>, "room1" }

            socket.emit('allplayers', { you: socket.player, all: await getAllPlayers(_room) });
            socket.to(_room).emit('newplayer', socket.player);

            socket.on('move', function (p_data) {
                try {
                    // console.log('move to ' + data.x + ', ' + data.y);
                    const data = decode(p_data);
                    socket.player.rt.px = data.px;
                    socket.player.rt.py = data.py;
                    socket.player.rt.vx = data.vx;
                    socket.player.rt.vy = data.vy;
                    const encoded = encode(socket.player.rt);
                    io.in(_room).emit('moved', Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength));
                } catch (error) {
                    logger.error(`error in socket on move ${error}`);
                }
            });

            socket.on('disconnect', function () {
                try {
                    io.in(_room).emit('remove', socket.player.rt.id);
                } catch (error) {
                    logger.error(`error in socket on disconnect ${error}`);
                }
            });
        } catch (error) {
            logger.error(`error in socket on newplayer ${error}`);
        }

    });

    socket.on('test', function () {
        console.log('test received');
    });
});

async function getAllPlayers(p_room) {
    let players = [];
    try {
        // console.log("getAllPlayers in %s", p_room);

        // let _sockets_ids = await io.sockets.allSockets();
        let _sockets_ids = await io.in(p_room).allSockets();
        for (const socket_id of _sockets_ids) {
            // console.log("Socket ID %s", (socket_id));
            let player_socket = io.of("/").sockets.get(socket_id);
            let player = player_socket && player_socket.player;
            if (!!player) players.push(player);
        };
        // console.log("Sending players %s", JSON.stringify(players));
    } catch (error) {
        logger.error(`error in getAllPlayers ${error}`);
    }
    return players;
}

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}
