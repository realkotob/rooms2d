

import Peer from 'peerjs';
import createAudioMeter from './lib/volume-meter.js';

var getUserMedia_ = (navigator.getUserMedia
  || navigator.webkitGetUserMedia
  || navigator.mozGetUserMedia
  || navigator.msGetUserMedia);
export default class PeerChat extends Phaser.Plugins.BasePlugin {
  peer = null;

  _can_call = false;

  muted_status = false;

  queued_peer_ids = [];

  connected_peer_ids = [];

  player_peer_map = new Map(); // This map is for updating dom volumes by distance
  peer_volume_meter_map = new Map(); // This map is for updating opacity by voice activity

  own_stream = null;
  constructor(pluginManager) {
    super(pluginManager);

    const self = this;


    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    self.audioContext = new AudioContext();

    document.body.addEventListener("click", function grab_audio_on_click(evt) {

      if (self.audioContext && self.audioContext.state === 'suspended' ||
        self.audioContext.state === 'interrupted') {
        self.audioContext.resume();
      } else {
        document.body.removeEventListener("click", grab_audio_on_click);
        self.init_new_peer();
      }

    });


  }

  callback_on_connect = null;
  init_new_peer() {
    const self = this;

    this.connected_peer_ids = [];

    // self.peer = new Peer();
    self.peer = new Peer(null, {
      host: window.location.hostname,
      // host: "mossylogs.com",
      debug: 1,
      secure: true,
      port: 443,
      path: '/peerapp',
    });

    this.peer.on('open', function () {
      // TODO Tell server about my ID
      console.log('My PeerJS ID is:', self.peer.id);
      self._can_call = true;


      self.call_next_peer();

      try {
        if (!!self.callback_on_connect) {
          self.callback_on_connect();
        }
      } catch (error) {
        console.error("Error in callback_on_connect", error);
      }

    });

    this.peer.on('close', function () {
      console.error('close in PeerChat');

    });

    this.peer.on('disconnected', function () {
      console.error('disconnected in PeerChat');

    });

    this.peer.on('error', function (err) {
      // Errors on the peer are almost always fatal and will destroy the peer
      console.error('error in PeerChat', err);

      // self._can_call = false;

      // TODO Tell the server about this
      // self.init_new_peer();

    });


    this.peer.on('call', (call) => {
      try {

        let peer_id = call.peer.toString();
        if (peer_id == self.peer.id) {
          console.warn("Cannot answer call coming from self.");
          return;
        }
        console.log("Answering player ");


        self.connected_peer_ids.push(peer_id);

        getUserMedia_({ video: false, audio: true }, (t_own_stream) => {
          self.own_stream = t_own_stream;

          call.answer(t_own_stream); // Answer the call with an A/V stream.

          if (!self.peer_volume_meter_map.get(self.peer.id)) {
            self.setup_voice_activity_meter(self.peer.id, t_own_stream.clone());
          }
        }, (err) => {
          console.error(
            'Failed to get local stream.', err);
        });
        call.on('stream', (remoteStream) => {
          // Show stream in some <video> element.

          console.log("Answered player " + peer_id);
          const remoteVideo = document.getElementById("p" + peer_id);
          if (!!remoteVideo) {
            remoteVideo.srcObject = remoteStream;
            remoteVideo.autoplay = true;
            remoteVideo.play();
            // remoteVideo.src = (URL || webkitURL || mozURL).createObjectURL(remoteStream);
          } else {
            let video = document.createElement('audio');
            video.srcObject = remoteStream;
            // video.src = (URL || webkitURL || mozURL).createObjectURL(remoteStream);
            video.autoplay = true;
            video.id = "p" + peer_id;
            video.play();
            let element = document.getElementById("media-container");
            element.appendChild(video);
          }
          self.setup_voice_activity_meter(peer_id, remoteStream.clone());


        });
      } catch (error) {
        console.error(
          'Error in peer.on(call)', error);
      }
    });
  }

  receive_all_peers(p_all_peers) {
    const self = this;
    p_all_peers.forEach(element => {
      self.player_peer_map.set(element.id, element.pid); // We need the player's peer id so mapped so we can animate their chat bubble voice activity
      if (element.pid != self.peer.id) {
        self.request_call_peer(element.pid);
      }
    });
  }

  request_call_peer(p_peer_id) {
    if (this.connected_peer_ids.indexOf(p_peer_id) != -1) {
      return;
    }

    this.queued_peer_ids.push(p_peer_id);

    if (!!this._can_call) {
      this.call_next_peer();
    }
  }

  call_next_peer() {
    try {

      if (this.queued_peer_ids.length <= 0) {
        // No more peers to call
        return;
      }

      const self = this;

      let next_peer_id = this.queued_peer_ids.shift();

      if (next_peer_id == self.peer.id) {
        console.warn("Cannot call self.");
        return;
      }

      console.log("Calling player ", next_peer_id);
      self.conn = self.peer.connect(next_peer_id);

      self.conn.on('open', function () {
        // Receive messages
        self.conn.on('data', function (data) {
          console.log('Received', data);
        });

        // Send messages
        self.conn.send(`Hello from ${self.peer.id} !`);
      });

      getUserMedia_({ video: false, audio: true }, (t_own_stream) => {
        const call = self.peer.call(next_peer_id.toString(), t_own_stream);
        self.own_stream = t_own_stream;
        call.on('stream', (remoteStream) => {
          if (!next_peer_id) {
            return;
          }
          console.log("Received stream");

          self.connected_peer_ids.push(next_peer_id);

          // Show stream in some <video> element.
          let peer_id = next_peer_id.toString();
          const remoteVideo = document.getElementById("p" + peer_id);
          if (remoteVideo) {
            remoteVideo.srcObject = remoteStream;
            remoteVideo.autoplay = true;
            remoteVideo.play();
          } else {
            let video = document.createElement('audio');
            video.srcObject = remoteStream;
            // video.src = (URL || webkitURL || mozURL).createObjectURL(remoteStream);
            video.autoplay = true;
            video.id = "p" + peer_id;
            let element = document.getElementById("media-container");
            element.appendChild(video);
            video.play();
          }
          self.setup_voice_activity_meter(peer_id, remoteStream.clone());
          self.call_next_peer();
        });

        if (!self.peer_volume_meter_map.get(self.peer.id)) {
          self.setup_voice_activity_meter(self.peer.id, t_own_stream.clone());
        }
      }, (err) => {
        console.error(
          'Failed to get local stream.', err);
      });
    } catch (error) {
      console.error(
        'Error in call_next_peer', error);
    }
  }


  //Additional methods for getting managing player data
  isAlive() {
    // TODO maybe use peer.disconnected property for this
    return this._can_call;
  }

  setup_voice_activity_meter(peer_id, stream) {
    // Use volume-meter script 
    // See https://ourcodeworld.com/articles/read/413/how-to-create-a-volume-meter-measure-the-sound-level-in-the-browser-with-javascript
    // and https://github.com/cwilso/volume-meter


    // Create an AudioNode from the stream.
    let mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
    // let mediaStreamSource = this.audioContext.createMediaElementSource(audio_element);
    // Create a new volume meter and connect it.
    let meter = createAudioMeter(this.audioContext);
    mediaStreamSource.connect(meter);
    this.peer_volume_meter_map.set(peer_id, meter);

    // var microphone = context.createMediaStreamSource(stream);
    // var backgroundMusic = context.createMediaElementSource(document.getElementById("back"));
    // var analyser = context.createAnalyser();

    // let finalStream = this.audioContext.createMediaStreamDestination();

    // microphone.connect(analyser);
    // meter.connect(finalStream);
    // backgroundMusic.connect(mixedOutput);
    // requestAnimationFrame(drawAnimation);

    // return finalStream;

    // streamRecorder = mixedOutput.stream.record();
    // peerConnection.addStream(mixedOutput.stream);
  }

  toggleMicMute() {
    this.setMicMute(!this.muted_status);

    return !!this.muted_status;
  }

  setMicMute(p_is_muted) {
    if (!this.own_stream || !this.own_stream.getAudioTracks)
      return console.error('Could not mute mic, error getting stream');

    const self = this;
    this.own_stream.getAudioTracks().forEach(function (t_track) {
      t_track.enabled = !p_is_muted;
      self.muted_status = !!p_is_muted;
    });
    console.log("Mic mute status %s", self.muted_status);
  }

}
