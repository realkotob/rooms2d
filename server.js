"use strict";

require('dotenv').config();

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
const helmet = require('helmet');

var PORT = 8081;

var server;
var SSL_FOUND = false;
var httpServer;

function ensureSecure(req, res, next) {
    if (req.secure) {
        // OK, continue
        return next();
    };
    // handle port numbers if you need non defaults
    // res.redirect('https://' + req.host + req.url); // express 3.x
    res.redirect('https://' + req.hostname + req.url); // express 4.x
}

PORT = 443;
SSL_FOUND = true;
var ssl_key;
var ssl_cert;
if (!!process.env.CERT_PATH && !!fs.existsSync(process.env.CERT_PATH)) {
    logger.info("CERT_PATH found, starting with SSL.");

    ssl_key = fs.readFileSync(process.env.CERT_PATH + 'privkey.pem', 'utf8');
    ssl_cert = fs.readFileSync(process.env.CERT_PATH + 'fullchain.pem', 'utf8');
} else {
    logger.warn("CERT_PATH not found, starting with self-signed certs.");
    // Self signed
    ssl_key = fs.readFileSync(__dirname + '/certs/server.key', 'utf8');
    ssl_cert = fs.readFileSync(__dirname + '/certs/server.cert', 'utf8');
}

let options = {
    key: ssl_key,
    cert: ssl_cert
};

server = https.Server(options, app);
httpServer = http.Server(app);

// Reroute to https internally. It's better to use nginx for this later 
// See https://stackoverflow.com/a/24015460
// See https://developer.ibm.com/languages/node-js/tutorials/make-https-the-defacto-standard/
app.all('*', ensureSecure); // at top of routing calls


// server = https.Server(app);

var io = require('socket.io')(server,
    {
        pingInterval: 5000,
        cookie: false // from https://github.com/socketio/socket.io/issues/2276
    });
const { ExpressPeerServer } = require('peer');

const peerServer = ExpressPeerServer(server, {
    port: 443,
    proxied: true,
    debug: true,
    path: '/',
    ssl: {
        key: ssl_key,
        cert: ssl_cert
    }
});

// See https://www.npmjs.com/package/helmet
app.use(helmet.expectCt());
app.use(helmet.hsts());
app.use(helmet.hidePoweredBy());

app.use('/peerapp', peerServer);

app.use(function (req, res, next) {
    res.header('Feature-Policy', "microphone https://localhost https://www.mossylogs.com https://mossylogs.com https://www.rooms2d.com https://rooms2d.com;");
    next();
});


app.set('appPath', __dirname + '/public');
// app.use(express.static(__dirname + '/public'));
app.use('*/public', express.static(__dirname + '/public'));
app.use('*/assets', express.static(__dirname + '/public/assets'));

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
    // httpServer.listen(80);
}

const { v4: uuidv4 } = require('uuid');

var room_videos = new Map();
const CHARACTER_SPRITE_COUNT = 24;
var rooms_balls = new Map();
var all_players = new Map();
var rooms_peers = new Map();
var rooms_kexp_start_index = new Map();
io.on('connection', function (socket) {
    setInterval(() => {
        socket.emit("ping", Date.now());
        // logger.info("Send ping event ");
    }, 5000);

    let _room = null;
    let _player_id = null;
    let _pic_id = null;

    socket.on('whatsUp', async function (p_data) {
        try {
            if (!_room) { // First time asking whatsUp on this connection
                _room = DEFAULT_ROOM;
                if (!!p_data && !!p_data.room && !(/[^\w.]/.test(p_data.room))) {  // from https://stackoverflow.com/a/46125634
                    _room = p_data.room;
                }
                await socket.join(_room);

                let existing_player = null;

                if (!_player_id) {
                    _player_id = p_data.id;
                    if (!_player_id) {
                        server.lastPlayderID += 1;
                        _player_id = uuidv4();
                    } else {
                        existing_player = all_players.get(_player_id);
                    }
                }
                if (!_player_id) {
                    console.error("Player ID not assigned at all, everything will be broken.");
                }

                if (!!p_data.pic_id) {
                    _pic_id = p_data.pic_id;
                } else {
                    _pic_id = server.lastPlayderID % CHARACTER_SPRITE_COUNT;
                }

                if (!!existing_player) {
                    socket.player = existing_player;
                } else {

                    let _name = p_data.username && p_data.username.length > 0 ? p_data.username : ("P" + _player_id);
                    // console.log("Player name is %s", _name);
                    let new_player = {
                        room: _room,
                        sprite: _pic_id,
                        uname: _name,
                        rt: {
                            id: _player_id,
                            px: randomInt(150, 450),
                            py: randomInt(150, 400),
                            vx: 0,
                            vy: 0,
                        }
                    };
                    all_players.set(_player_id, new_player);
                    socket.player = new_player;
                }

                socket.to(_room).emit('newplayer', socket.player);

                if (!rooms_balls.get(_room)) {
                    let room_ball_map = new Map();
                    let new_ball_ids = [1, 2];

                    new_ball_ids.forEach(t_ball_id => {
                        room_ball_map.set(t_ball_id, {
                            thrower_player_id: null,
                            holder_player_id: null,
                        })
                    });

                    rooms_balls.set(_room, room_ball_map);
                }
                if (!rooms_peers.get(_room)) {
                    let room_peer_map = new Map();
                    rooms_peers.set(_room, room_peer_map);
                }

            }

            let tmp_vid = room_videos.get(_room);
            if (!tmp_vid) {
                let room_kexp_index = Math.floor(Math.random() * 86);
                let new_playlist = "PLUh4W61bt_K6HLVHp_Z_NmXyV6SVNsg2N";
                tmp_vid = {
                    t: "list",
                    id: new_playlist,
                    index: room_kexp_index
                }
                room_videos.set(_room, tmp_vid);
            }

            const enc_room_info = encode({
                you: socket.player, all: await getAllPlayers(_room), room_data: {
                    vid_info: !!tmp_vid ? tmp_vid : {}, balls: rooms_balls.get(_room)
                }
            });

            socket.emit('room_info', Buffer.from(enc_room_info.buffer, enc_room_info.byteOffset, enc_room_info.byteLength));

        } catch (error) {
            logger.error(`error in socket on newplayer ${error}`);
        }

    });

    socket.on('move', function (p_data) {
        try {
            if (!socket.player)
                return;
            // return logger.warn(`player does not exist in move`);

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

    socket.on('set_peer_id', async function (p_data) {
        try {
            if (!p_data.player_id) {
                console.warn("Received empty Player ID when setting peer to map!");
            }
            if (!p_data.peer_id) {
                console.warn("Received empty Peer ID when setting peer to map!");
            }
            if (!rooms_peers.get(_room)) {
                let room_peer_map = new Map();
                rooms_peers.set(_room, room_peer_map);
            }

            rooms_peers.get(_room).set(p_data.player_id, p_data.peer_id)
            let all_peers = await getAllPeerIDs(_room);
            socket.emit("allpeers", all_peers);
            io.in(_room).emit('new_peer_id', { id: p_data.player_id, pid: p_data.peer_id });
            // socket.player.peer_id = p_data.peer_id;
        } catch (error) {
            logger.error(`error in socket on set_peer_id ${error}`);
        }
    });

    socket.on('catchball', async function (p_data) {
        try {
            io.in(_room).emit('catch_ball', p_data);

            const data = decode(p_data);
            let tmp_ball = rooms_balls.get(_room).get(data.b);
            if (!tmp_ball.holder_player_id) {
                tmp_ball.thrower_player_id = null;
                let other_socket = await getSocketForPlayer(_room, data.p);
                if (!!other_socket) {
                    other_socket.player.holding_ball = data.b;
                }
            } else {
                logger.warn(
                    `Player ${data.p} tried to catch ball ${data.b} already held by ${tmp_ball.holder_player_id}`)
            }

        } catch (error) {
            logger.error(`error in socket on catchball ${error}`);
        }
    });


    socket.on('startthrowball', async function (p_data) {
        try {
            io.in(_room).emit('start_throw_ball', p_data);

            const data = decode(p_data);
            let tmp_ball = rooms_balls.get(_room).get(data.b);
            if (!tmp_ball.thrower_player_id) {
                tmp_ball.holder_player_id = null;
                tmp_ball.thrower_player_id = data.p;
                socket.player.holding_ball = null;
                // NOTE Maybe update internal map of ball position/velocity
            } else {
                logger.warn(
                    `Player ${data.p} tried to throw ball ${data.b} already thrown by ${tmp_ball.thrower_player_id}`)
            }
        } catch (error) {
            logger.error(`error in socket on startthrowball ${error}`);
        }
    });

    socket.on('throwball', async function (p_data) {
        try {
            io.in(_room).emit('throw_ball', p_data);

            // const data = decode(p_data);
            // const encoded = encode(data);
            // io.in(_room).emit('throw_ball', Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength));

            // io.in(_room).emit('throw_ball', data);
            // socket.player.holding_ball = null;
            // TODO Update internal map of ball position/velocity
        } catch (error) {
            logger.error(`error in socket on throwball ${error}`);
        }
    });


    socket.on('yt_url', function (p_data) {
        try {
            room_videos.set(_room, p_data.v);
            io.in(_room).emit('yt_url', p_data);
        } catch (error) {
            logger.error(`error in socket on yt_url ${error}`);
        }
    });
    socket.on('yt_state', function (p_state) {
        try {
            io.in(_room).emit('yt_state', p_state);
        } catch (error) {
            logger.error(`error in socket on yt_state ${error}`);
        }
    });

    socket.on('muted_self', function (p_state) {
        try {
            io.in(_room).emit('muted_self', p_state);
        } catch (error) {
            logger.error(`error in socket on muted_self ${error}`);
        }
    });

    socket.on('disconnect', function () {
        try {
            if (!socket.player)
                return;
            io.in(_room).emit('remove', socket.player.rt.id);
            rooms_peers.get(_room).set(socket.player.rt.id, null)
        } catch (error) {
            logger.error(`error in socket on disconnect ${error}`);
        }
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

async function getSocketForPlayer(p_room, p_id) {
    try {
        let _sockets_ids = await io.in(p_room).allSockets();
        for (const socket_id of _sockets_ids) {
            // console.log("Socket ID %s", (socket_id));
            let player_socket = io.of("/").sockets.get(socket_id);
            let player = player_socket && player_socket.player;
            if (!!player && player.rt.id == p_id) {
                return player_socket;
            };;
        };
    } catch (error) {
        logger.error(`error in getSocketForPlayer ${error}`);
    }
    return null;
}

async function getAllPeerIDs(p_room) {
    let peer_ids = [];
    try {
        let room_peer_map = rooms_peers.get(p_room);
        if (!room_peer_map) {
            return peer_ids;
        }
        for (let [player_id, peer_id] of room_peer_map) {
            if (!!peer_id) {
                peer_ids.push({ id: player_id, pid: peer_id });
            }
        }
        // let players = await getAllPlayers(p_room);
        // players.forEach(e_player => {
        //     if (!!e_player.peer_id) {
        //         peer_ids.push({ id: e_player.rt.id, pid: e_player.peer_id });
        //     }
        // });
    } catch (error) {
        logger.error(`error in getAllPlayers ${error}`);
    }
    return peer_ids;
}

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}
