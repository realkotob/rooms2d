import { io } from 'socket.io-client';
import { encode, decode } from "@msgpack/msgpack";


export default class SocketClient extends Phaser.Plugins.BasePlugin {

  socket = null;

  is_connected = false;

  constructor(pluginManager) {
    super(pluginManager);

    this.init_new_socket();

  }

  init_new_socket() {

    const self = this;

    this.socket = io.connect({ rejectUnauthorized: false });


    this.socket.on('connected', function () {
      self.is_connected = true;


      //     // get path from current URL
      //     let room = window.location.pathname.slice(3);   // remove leading /chat/
      //     let pos = room.indexOf('/');
      //     if (pos !== -1) {
      //         room = room.slice(0, pos);
      //     }
      //     console.log("Room ID %s", room);
      //     self.room_id = room;
    });

    this.sendTest = function () {
      console.log("test sent");
      self.socket.emit('test');
    };

    this.askNewPlayer = function () {
      let pos = window.location.pathname.indexOf('/r/');
      if (pos !== -1) {
        self.room_id = window.location.pathname.slice(pos + 3);
      }
      // console.log("Room ID %s", self.room_id);
      let _name = localStorage.getItem("username");
      console.log("Selected name %s", _name);
      self.socket.emit('newplayer', { room: self.room_id, username: _name });
    };

    this.setPeerID = function (p_player_id, p_peer_id) {
      self.socket.emit('set_peer_id', { player_id: p_player_id, peer_id: p_peer_id });
    };

    this.sendMove = function (p_pos_x, p_pos_y, p_vel_x, p_vel_y) {
      const encoded = encode({
        px: Math.round(p_pos_x), py: Math.round(p_pos_y), vx: Math.round(p_vel_x), vy: Math.round(p_vel_y)
      });
      // TODO Send empty object of the velocity is 0 and rounded positions are same as last frame
      self.socket.emit(
        'move', Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength));
    };

    this.sendYoutubeChangeURL = function (p_new_v_id) {

      // TODO Send empty object of the velocity is 0 and rounded positions are same as last frame
      self.socket.emit(
        'yt_url', { p: self.player_id, v: p_new_v_id });
    };

    this.sendYoutubeState = function (p_new_state) {
      // TODO Send empty object of the velocity is 0 and rounded positions are same as last frame
      self.socket.emit(
        'yt_state', { p: self.player_id, s: p_new_state });
    };

  }
}