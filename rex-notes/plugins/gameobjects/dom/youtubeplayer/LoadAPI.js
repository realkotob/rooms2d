import LoadScript from '../../../utils/loader/LoadScript.js';

var IsAPIReady = false;
var LoadAPI = function (onLoaded) {
    if (IsAPIReady) {
        console.log("YT Api already ready.");
        onLoaded();
    } else {
        if (!window.onYouTubeIframeAPIReady) {
            window.onYouTubeIframeAPIReady = function () {
                IsAPIReady = true;
                for (var i = 0, cnt = CallbackQueue.length; i < cnt; i++) {
                    CallbackQueue[i]();
                }
                CallbackQueue = undefined;
            };
            console.log("Try call LoadScript");
            LoadScript('https://www.youtube.com/iframe_api');
            // Function onYouTubeIframeAPIReady() should be defined before loading 
        } else {
            console.log("window.onYouTubeIframeAPIReady already defined");
        }
        CallbackQueue.push(onLoaded);
    }
}
var CallbackQueue = [];

export default LoadAPI;