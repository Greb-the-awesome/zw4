var divisDownKeys = {};
var mouseDown = false; // lmb
var rmb = false; // rmb

var arrowKeySensitivity = 20;
function onKeyDown(event) {
	var keyCode = event.code;
	if (true) {
		divisDownKeys[keyCode] = true;
		if (keyCode == "Digit6") {
			showDebug = !showDebug;
		}
		if (keyCode == "KeyB") {
			IHP.drawLines = !IHP.drawLines;
		}
		if (keyCode == "KeyG") {
			showGUI = !showGUI;
		}
		if (keyCode == "KeyC") {
			document.getElementById("changelog").classList.toggle("changelog-hidden");
			document.getElementById("changelog").classList.toggle("changelog-show");
		}
	}
}
function onKeyUp(event) {
	keyCode = event.code;
	divisDownKeys[keyCode] = false;
}
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
function processArrowKeys() {
	if (divisDownKeys["ArrowUp"]) {onCameraTurn({movementX: 0, movementY: -arrowKeySensitivity});}
	if (divisDownKeys["ArrowDown"]) {onCameraTurn({movementX: 0, movementY: arrowKeySensitivity});}
	if (divisDownKeys["ArrowLeft"]) {onCameraTurn({movementX: -arrowKeySensitivity, movementY: 0});}
	if (divisDownKeys["ArrowRight"]) {onCameraTurn({movementX: arrowKeySensitivity, movementY: 0});}
}

addEventListener("mousedown", function(e) {
	if (e.button == 0) {
		mouseDown = true;
	} else if (e.button == 2) {
		rmb = true;
	}
});
addEventListener("mouseup", function(e) {
	if (e.button == 0) {
		mouseDown = false;
	} else if (e.button == 2) {
		rmb = false;
	}
});

setInterval(processArrowKeys, 20);
