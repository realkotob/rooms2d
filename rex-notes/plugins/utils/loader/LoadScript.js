var LoadScript = function (url, onload) {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0, cnt = scripts.length; i < cnt; i++) {
        if (scripts[i].src.indexOf(url) != -1) {
            if (onload) {
                onload();
            }
            console.log("For loop return in LoadScript");
            return;
        }
    }

    var newScriptTag = document.createElement('script');
    newScriptTag.setAttribute('src', url);

    if (onload) {
        newScriptTag.onload = onload;
    }
    console.log("Set src with new script in LoadScript.");

    document.head.appendChild(newScriptTag);
};
export default LoadScript;