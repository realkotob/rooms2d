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
const cert_path = '/etc/letsencrypt/live/mossylogs.com/';


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

const ws = require('ws');

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

const wsServer = new ws.Server({ port: 8080 });

const CHARACTER_SPRITE_COUNT = 24;
let room_sockets = new Map();
wsServer.on('connection', socket => {

    socket.on('message', function incoming(p_data) {
        try {
            const decoded_data = decode(p_data);
            const msg_key = decoded_data.k;
            const data = decoded_data.d;

            let tmp_room = DEFAULT_ROOM;
            if (msg_key === "req_newplayer") {
                if (!!p_data && !!p_data.room && !(/[^\w.]/.test(p_data.room))) {  // only allow certain characters in room names
                    // to prevent messing with socket.io internal rooms  from https://stackoverflow.com/a/46125634
                    tmp_room = p_data.room;
                }
                // (newplayer_data && newplayer_data.room) || DEFAULT_ROOM);
                add_socket_to_room(socket, tmp_room);

                server.lastPlayderID += 1;
                let _name = p_data.username && p_data.username.length > 0 ? p_data.username : ("P" + server.lastPlayderID);
                // console.log("Player name is %s", _name);
                socket.player = {
                    room: tmp_room,
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

                send_message_to_socket(socket, "allplayers", { you: socket.player, all: get_all_players_in_room(tmp_room) });
                send_to_room(socket.player.room, "newplayer", socket.player, [socket]);

                socket.on('close', function close() {
                    try {
                        remove_socket_from_room(socket, tmp_room);
                        send_to_room(socket.player.room, "remove", socket.player.rt.id, [socket]);
                        console.log('disconnected');
                    } catch (error) {
                        logger.error(`error in socket on disconnect ${error}`);
                    }
                });
            }
            else if (msg_key === "move") {
                socket.player.rt.px = data.px;
                socket.player.rt.py = data.py;
                socket.player.rt.vx = data.vx;
                socket.player.rt.vy = data.vy;
                send_to_room(tmp_room, "moved", socket.player.rt, [socket]);
            }
            else if (msg_key === "test") {
                console.log('test received');
            } else {
                logger.info("Received message with unknown id");
            }

        } catch (error) {
            logger.error(`error in socket ${error}`);
        }

    });


});

server.listen(process.env.PORT || PORT, function () {
    // console.log('Listening on http://localhost:' + server.address().port);
    console.log(`Server running at: http://localhost:${PORT}/`);
});
// server.on('upgrade', function upgrade(request, socket, head) {
//     wsServer.handleUpgrade(request, socket, head, socket => {
//         wsServer.emit('connection', socket, request);
//     });
// });
if (SSL_FOUND) {
    httpServer.listen(80);
}

function send_message_to_socket(p_socket, p_msg_id, p_data) {
    try {
        const encoded = encode({ k: p_msg_id, d: p_data });

        p_socket.send(Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength), { binary: true, mask: true });
    } catch (error) {
        logger.error(`error in send_message_to_socket ${error}`);
    }
}

function add_socket_to_room(p_socket, p_room_id) {
    try {
        let room_array = room_sockets.get(p_room_id);
        if (!room_array) {
            room_sockets.set(p_room_id, [p_socket]);
        } else {
            room_array.push(socket);
        }
    } catch (error) {
        logger.error(`error in add_socket_to_room ${error}`);
    }
}
function remove_socket_from_room(p_socket, p_room_id) {
    try {

        let room_array = room_sockets.get(p_room_id);
        if (!!room_array) {
            let temp_index = room_array.indexOf(p_socket);
            if (temp_index != -1) {
                room_array.splice(temp_index, 1);
            }
        }
    } catch (error) {
        logger.error(`error in remove_socket_from_room ${error}`);
    }
}
function send_to_room(p_room_id, p_msg_id, p_data, p_exceptions = []) {
    try {
        let room_array = room_sockets.get(p_room_id);
        if (!!room_array) {
            room_array.forEach(p_socket => {
                if (p_socket.readyState === ws.OPEN && p_exceptions.indexOf(p_socket) == -1) { // Add extra param to check client !== socket for not pinging user back
                    send_message_to_socket(p_socket, p_msg_id, p_data);
                }
            });
        }
    } catch (error) {
        logger.error(`error in send_to_room ${error}`);
    }

}

function get_all_players_in_room(p_room_id) {
    let players = [];
    try {
        let room_array = room_sockets.get(p_room_id);
        if (!!room_array) {
            room_array.forEach(p_socket => {
                if (!!p_socket.player) {
                    // TODO Maybe check if socket is still connected? :shrug:
                    players.push(p_socket.player);
                }
            });
        }
    } catch (error) {
        logger.error(`error in get_all_players_in_room ${error}`);
    }
    return players;
}

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

// const client = new ws(`ws://localhost:${PORT}`);

// client.on('open', () => {
//     logger.info("Connected to self websocket!")
//     // Causes the server to print "Hello"
//     // client.send('Hello');
//     send_message_to_socket(client, "test", "whatever");
// });