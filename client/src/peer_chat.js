"use strict";

import Peer from 'peerjs';
import createAudioMeter from './lib/volume-meter.js';
import { Clamp } from "./utils.js"
import { NO_HEAR_DISTANCE, FULL_HEAR_DISTANCE, PAN_DISTANCE_START, PAN_ROLLOF } from "./constants.js"

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
  timeout_count_map = new Map(); // This map is for updating dom volumes by distance
  peer_volume_meter_map = new Map(); // This map is for updating opacity by voice activity
  media_gain_map = new Map(); // This map is for updating opacity by voice activity
  media_pan_map = new Map(); // This map is for updating opacity by voice activity

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
    console.log("init_new_peer");

    const self = this;

    // When the peer is recreated, call everyone again
    this.connected_peer_ids = [];

    // self.peer = new Peer();
    self.peer = new Peer(null, {
      host: window.location.hostname,
      // host: "mossylogs.com",
      debug: 1,
      secure: true,
      port: 443,
      path: '/peerapp',
      config: {
        // Test with https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
        'iceServers': [ // Followed this guide to setup coturn service 
          //https://ourcodeworld.com/articles/read/1175/how-to-create-and-configure-your-own-stun-turn-server-with-coturn-in-ubuntu-18-04
          { url: 'stun:stun.mossylogs.com:5349' },
          { url: 'stun:stun.l.google.com:19302' },
          { url: 'turn:p2p.rambly.app:3478', username: 'rambly', credential: 'rambly' },
          { url: 'turn:turn.mossylogs.com:5349', username: 'mossylogs', credential: 'mossylogs' }
        ]
      }
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
      // where backoff is a value in seconds which I increment everytime I try up to a maximum.
      // this.disconnectBackoff = 1;
      // this.retrySocketConnection();
      self.init_new_peer();

    });

    // Non-Fatal error:
    // 'peer-unavailable' = maybe they left?
    // 'disconnected' = this means the Peering server disconnected, we have a seperate retry for that on('disconnect')
    // pretty much all of the rest are fatal.
    // Error handling adapted from https://github.com/peers/peerjs/issues/650
    const FATAL_ERRORS = ['invalid-id', 'invalid-key', 'network', 'ssl-unavailable', 'server-error', 'socket-error', 'socket-closed', 'unavailable-id', 'webrtc'];
    this.peer.on('error', function (err) {
      try {
        // console.warn('error in PeerChat', err);

        // Errors on the peer are almost always fatal and will destroy the peer
        if (FATAL_ERRORS.includes(err.type)) {
          // TODO Add increasing timeout here to avoid thrashing the browser
          self.init_new_peer();
          // this.reconnectTimeout(e); // this function waits then tries the entire connection over again
        } else {
          console.log('Non fatal error: ', e.type);
        }

        // self._can_call = false;

        // TODO Tell the server about this
        // self.init_new_peer();
      } catch (error) {
        console.warn('error in peer.on.error', err);

      }
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

          self.add_stream_to_html(peer_id, remoteStream.clone());

          self.setup_voice_activity_meter(peer_id, remoteStream.clone());

        });

        call.on('error', (e) => {
          console.warn('error with stream', e);
          // if (initiator) { // initiator is a value I set myself
          let index_peer = self.connected_peer_ids.indexOf(peer_id);
          if (index_peer != -1)
            self.connected_peer_ids.splice(index_peer, 1);

          if (!!self._can_call) {
            self.reconnectTimeout(next_peer_id);
          }
          // else {
          // self.queued_peer_ids.push(next_peer_id);
          // }

        });
      } catch (error) {
        console.error(
          'Error in peer.on(call)', error);
      }
    });
  }

  add_stream_to_html(peer_id, remoteStream) {
    let splitStream = this.split_media_stream(peer_id, remoteStream);

    let media_container = document.getElementById("media-container");

    let remoteVideo = document.getElementById("p" + peer_id);
    let volumeControl = document.getElementById("v" + peer_id);
    if (!!remoteVideo) {
      remoteVideo.srcObject = remoteStream;
      remoteVideo.autoplay = true;
      remoteVideo.play();
      remoteVideo.volume = 0;
      // remoteVideo.src = (URL || webkitURL || mozURL).createObjectURL(split_stream);
    } else {
      remoteVideo = document.createElement('audio');
      remoteVideo.srcObject = remoteStream;
      // video.src = (URL || webkitURL || mozURL).createObjectURL(split_stream);
      remoteVideo.autoplay = true;
      remoteVideo.id = "p" + peer_id;
      remoteVideo.volume = 0;
      remoteVideo.play();
      media_container.appendChild(remoteVideo);
    }
    if (!!volumeControl) {
      volumeControl.srcObject = splitStream;
      volumeControl.autoplay = true;
      volumeControl.play();
      volumeControl.volume = 1;
    } else {
      volumeControl = document.createElement('audio');
      volumeControl.srcObject = splitStream;
      // video.src = (URL || webkitURL || mozURL).createObjectURL(split_stream);
      volumeControl.autoplay = true;
      volumeControl.id = "v" + peer_id;
      volumeControl.volume = 1;
      volumeControl.play();
      media_container.appendChild(volumeControl);
    }
  }

  reconnectTimeout(p_peer_id) {
    let last_timeout = this.timeout_count_map.get(p_peer_id) || 3;
    if (last_timeout > 30) {
      // Give up on calling player
      return;
    }
    setTimeout(self.call_next_peer, last_timeout * 1000);
    this.timeout_count_map.set(p_peer_id, last_timeout + 5);
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

      let options_call = {
        'constraints': {
          'mandatory': {
            'OfferToReceiveAudio': true,
            'OfferToReceiveVideo': false
          },
          offerToReceiveAudio: 1,
          offerToReceiveVideo: 0,
        }
      };

      getUserMedia_({ video: false, audio: true }, (t_own_stream) => {
        const call = self.peer.call(next_peer_id.toString(), t_own_stream, options_call);
        self.own_stream = t_own_stream;
        call.on('stream', (remoteStream) => {
          if (!next_peer_id) {
            return;
          }
          console.log("Received stream");

          self.connected_peer_ids.push(next_peer_id);
          let peer_id = next_peer_id.toString();

          self.add_stream_to_html(peer_id, remoteStream.clone());

          self.setup_voice_activity_meter(peer_id, remoteStream.clone());
          self.call_next_peer();
        });

        if (!self.peer_volume_meter_map.get(self.peer.id)) {
          self.setup_voice_activity_meter(self.peer.id, t_own_stream.clone());
        }

        call.on('error', (e) => {
          console.warn('error with stream', e);
          // if (initiator) { // initiator is a value I set myself
          let index_peer = self.connected_peer_ids.indexOf(next_peer_id);
          if (index_peer != -1)
            self.connected_peer_ids.splice(index_peer, 1);

          if (!!self._can_call) {
            self.reconnectTimeout(next_peer_id);
          }
          // else {
          // self.queued_peer_ids.push(next_peer_id);
          // }
        });
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
  }

  split_media_stream(p_peer_id, p_stream) {
    try {
      let mediaStreamSource = this.audioContext.createMediaStreamSource(p_stream);

      let panNode = this.audioContext.createStereoPanner();
      let destination = this.audioContext.createMediaStreamDestination();
      let gainNode = this.audioContext.createGain();

      mediaStreamSource.connect(panNode);
      panNode.connect(gainNode);
      // gainNode.connect(this.audioContext.destination);


      gainNode.connect(destination);

      this.media_pan_map.set(p_peer_id, panNode);
      this.media_gain_map.set(p_peer_id, gainNode);

      // destination.connect(this.audioContext.destination);

      // return p_stream; 
      return destination.stream;

    } catch (error) {
      console.warn("Could not split media stream %s", error);
      return p_stream;
    }
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


  handle_talk_activity(p_player_map) {
    if (this.player_peer_map.size <= 0) {
      // console.warn(`player_peer_map is empty, skipping handle_talk_activity.`);
      return;
    }
    const self = this;
    for (let [player_id, peer_id] of self.player_peer_map) {
      let player = p_player_map[player_id];
      if (!!player) {
        let meter = self.peer_volume_meter_map.get(peer_id);
        if (!!meter) {
          // console.log(`Volume of ${player.username} is ${meter.volume}`);
          player.chat_bubble.alpha = Clamp(0.1 + meter.volume * 5, 0, 1);
        } else {
          // This usually happens while waiting for the peer to answer the call. No need for logs unless debugging.
          // if (this.peerChat.player_peer_map.size > 1) { // Don't show this error if player is alone
          //     console.warn(`Meter object is null but peer  ${peer_id} is in the player_peer_map.`);
          // }
        }
      } else {
        // console.warn(`Player object is null but player_id ${player_id} is in the player_peer_map.`);
      }
    }
  }

  calc_gain_for_pos(base_pos_x, base_pos_y, stream_pos_x, stream_pos_y) {
    // NOTE Constants might need to be 1.5x
    let BASE_PAN_DIST = 50;
    let ROLL_OFF = 8;
    let BASE_HEAR_DIST = 170;
    let MAX_HEAR_DIST = 400;

    let new_dist = Phaser.Math.Distance.Between(
      base_pos_x, base_pos_y, stream_pos_x, stream_pos_y);

    let clamped_dist = Math.max(new_dist, BASE_PAN_DIST);
    let final_gain = BASE_PAN_DIST / (BASE_PAN_DIST + ROLL_OFF * (clamped_dist - BASE_PAN_DIST));
    if (new_dist > BASE_HEAR_DIST) {
      let prox_volume = (MAX_HEAR_DIST - new_dist) / (MAX_HEAR_DIST - BASE_HEAR_DIST);
      if (prox_volume < 0) (prox_volume = 0);
      if (prox_volume > 1) (prox_volume = 1);
      final_gain *= prox_volume;
    }
    return final_gain;
  }

  handle_voice_proximity(p_current_player, p_player_map) {
    try {
      if (this.player_peer_map.size <= 0) {
        console.warn("Empty player peer map");
        return;
      }
      const self = this;
      // let video_parent = document.getElementById("media-container");
      // for (let [player_id, gain_array] of self.media_gain_map) {
      for (let [t_player_id, t_peer_id] of self.player_peer_map) {

        if (t_player_id != p_current_player.player_id) { // peer_id is null when player disconnects
          let tmp_player = p_player_map[t_player_id];
          if (!!tmp_player) {
            let distance_to_other_player = Phaser.Math.Distance.Between(
              tmp_player.x, tmp_player.y, p_current_player.x, p_current_player.y);
            // TESTME Need to check if this is ok.
            // I can optimize this by storing the DOMS in a map.
            let volume_controller = document.getElementById('v' + t_peer_id);
            let gain_node = self.media_gain_map.get(t_peer_id);
            let _volume = 1 - Clamp((distance_to_other_player - FULL_HEAR_DISTANCE) / (NO_HEAR_DISTANCE - FULL_HEAR_DISTANCE), 0, 1);
            console.log(`Set volume for ${tmp_player.username} to ${_volume}`);
            if (!!gain_node) {
              gain_node.gain.value = _volume;
            }
            if (!!volume_controller) {
              volume_controller.volume = _volume;
            }

            let pan_node = self.media_pan_map.get(t_peer_id);
            if (!!pan_node) {

              // let _volume = 1 - Clamp(_distance / MAX_HEAR_DISTANCE, 0, 1);
              if (distance_to_other_player < PAN_DISTANCE_START) {
                pan_node.pan.value = 0;
              } else {
                // let left_ear = {
                //   x: p_current_player.x - 8,
                //   y: p_current_player.y
                // };
                // let right_ear = {
                //   x: p_current_player.x + 8,
                //   y: p_current_player.y
                // };
                // let left_dist = Phaser.Math.Distance.Between(
                //   tmp_player.x, tmp_player.y, left_ear.x, left_ear.y);
                // let right_dist = Phaser.Math.Distance.Between(
                //   tmp_player.x, tmp_player.y, right_ear.x, right_ear.y);
                let end_vec = new Phaser.Math.Vector2(tmp_player.x - p_current_player.x, tmp_player.y - p_current_player.y);
                let final_pan = Math.cos(end_vec.angle());
                final_pan = Phaser.Math.Linear(0, final_pan, Clamp(
                  (distance_to_other_player - PAN_DISTANCE_START) / PAN_ROLLOF, 0, 1));
                final_pan = Clamp(final_pan, -0.75, 0.75);
                console.log(`Set final_pan ${final_pan} for ${t_player_id}`);
                pan_node.pan.value = final_pan;
              }

            }
          } else {
            // console.warn(`Could not find player obj for peer audio ${t_peer_id}`)
          }
        }
      };

    } catch (error) {
      console.warn("handle_voice_proximity", error);
    }
  }


  handle_voice_proximity_old(p_current_player, p_player_map) {
    try {
      if (this.player_peer_map.size <= 0) {
        return;
      }
      const self = this;
      // let video_parent = document.getElementById("media-container");
      for (let [player_id, peer_id] of self.player_peer_map) {
        if (player_id != p_current_player.player_id) { // peer_id is null when player disconnects
          // TESTME Need to profile this and make sure it's ok. 
          // I can optimize this by storing the DOMS in a map.
          let child_video = document.getElementById('p' + peer_id);
          if (child_video) {
            let tmp_player = p_player_map[player_id];
            if (!!tmp_player) {
              let _distance = Phaser.Math.Distance.Between(
                tmp_player.x, tmp_player.y, p_current_player.x, p_current_player.y);

              let _volume = 1 - Clamp(_distance / NO_HEAR_DISTANCE, 0, 1);
              // TODO I can store the last volume separately if the getter here is costly
              // console.log(`Set volume for ${tmp_player.username} to ${_volume}`);
              child_video.volume = _volume;
            } else {
              // console.warn(`Could not find player obj for peer audio ${peer_id}`)
            }
          } else {
            // console.warn(`Could not find the DOM element for peer audio ${peer_id}`)
          }
        }
      };

    } catch (error) {
      console.warn("handle_voice_proxomity", error);
    }
  }

  handle_voice_proximity_nogain(p_current_player, p_other_player) {
    try {
      let player_id = p_other_player.player_id;
      let peer_id = this.player_peer_map.get(player_id);
      // let video_parent = document.getElementById("media-container");
      if (player_id == p_current_player.player_id) { // peer_id is null when player disconnects
        return;
      }
      if (!p_other_player) {
        return;
      }
      // TESTME Need to profile this and make sure it's ok.
      // I can optimize this by storing the DOMS in a map.
      let child_video = document.getElementById('p' + peer_id);
      if (child_video) {
        let tmp_player = p_other_player;
        let _distance = Phaser.Math.Distance.Between(
          tmp_player.x, tmp_player.y, p_current_player.x, p_current_player.y);

        let _volume = 1 - Clamp(_distance / NO_HEAR_DISTANCE, 0, 1);
        // TODO I can store the last volume separately if the getter here is costly
        // console.log(`Set volume for ${tmp_player.username} to ${_volume}`);
        child_video.volume = _volume;
      } else {
        // console.warn(`Could not find the DOM element for peer audio ${peer_id}`)
      }

    } catch (error) {
      console.warn("handle_voice_proxomity", error);
    }
  }
}
