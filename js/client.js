var Client = {};

Client.socket = io.connect();

Client.sendTest = function () {
    console.log("test sent");
    Client.socket.emit('test');
};

Client.askNewPlayer = function () {
    Client.socket.emit('newplayer');
};

Client.sendClick = function (x, y) {
    Client.socket.emit('click', { x: x, y: y });
};

Client.socket.on('newplayer', function (data) {
    Game.addNewPlayer(data.id, data.x, data.y);




});


Client.socket.on('allplayers', function (data) {
    console.log("My new player id is ", data.you.id);
    Game.peer = new Peer(data.you.id.toString());
    Game.peer.on('open', function () {
        console.log('My PeerJS ID is:', Game.peer.id);

        const _all = data.all;
        for (var i = 0; i < _all.length; i++) {
            if (_all[i].id != Game.peer.id)
                call_player(_all[i].id);
        }
    });


    Game.peer.on('call', (call) => {
        console.log("Answering player ");
        var getUserMedia_ = (navigator.getUserMedia
            || navigator.webkitGetUserMedia
            || navigator.mozGetUserMedia
            || navigator.msGetUserMedia);
        getUserMedia_({ video: false, audio: true }, (stream) => {
            call.answer(stream); // Answer the call with an A/V stream.
            call.on('stream', (remoteStream) => {
                // Show stream in some <video> element.
                const remoteVideo = document.getElementById("remote-video");
                if (remoteVideo) {
                    remoteVideo.srcObject = stream;
                }
            });
        }, (err) => {
            console.error('Failed to get local stream', err);
        });
    });


    const _all = data.all;
    for (var i = 0; i < _all.length; i++) {
        Game.addNewPlayer(_all[i].id, _all[i].x, _all[i].y);
    }


    Client.socket.on('move', function (data) {
        Game.movePlayer(data.id, data.x, data.y);
    });

    Client.socket.on('remove', function (id) {
        Game.removePlayer(id);
    });
});

function call_player(p_id) {
    console.log("Calling player ", p_id);
    Game.conn = Game.peer.connect(p_id);

    Game.conn.on('open', function () {
        // Receive messages
        Game.conn.on('data', function (data) {
            console.log('Received', data);
        });

        // Send messages
        Game.conn.send('Hello!');
    });

    var getUserMedia_ = (navigator.getUserMedia
        || navigator.webkitGetUserMedia
        || navigator.mozGetUserMedia
        || navigator.msGetUserMedia);
    getUserMedia_({ video: false, audio: true }, (stream) => {
        console.log("Got media stream to call player ", p_id);
        const call = Game.peer.call(p_id.toString(), stream);
        call.on('stream', (remoteStream) => {
            // Show stream in some <video> element.
            const remoteVideo = document.getElementById("local-video");
            if (remoteVideo) {
                remoteVideo.srcObject = stream;
            }
        });
    }, (err) => {
        console.error('Failed to get local stream', err);
    });
}

