// proudly created by Major League Game Development (i.e myself)

var canvas, player;
var mousepos = [0, 0];
var debugDispNow = {}; var showDebug = false, showGUI = true;
var firstTime = 0;
var oW, oH;
var globalSkybox, currentLevel;
var creativeMode = false;
var generalWorker;
var paused = false;
var firstTimePlaying = true; // whether it's the first time playing or the user died and restarted

// creative mode interval
setInterval(function() {
	if (creativeMode) {
		// PhysicsObject.GlobalGravity[1] = 0;
		if (player) player.ignoresGravity = true;
		if (window.player) {
			player.health = 100;
		}
		if (window.divisDownKeys?.Comma) {
			player.pos[1] -= 0.05;
		}
		if (window.divisDownKeys?.Period) {
			player.pos[1] += 0.05;
		}
	}
}, 20);

function vec3_avg(a, b, c, d) {return [(a[0]+b[0]+c[0]+d[0])/2, (a[1]+b[1]+c[1]+d[1])/2, (a[2]+b[2]+c[2]+d[2])/2];}
function vec3_cross(a, b) {
	var out = glMatrix.vec3.create(); glMatrix.vec3.cross(out, a, b);
	glMatrix.vec3.normalize(out, out); return out;}

function debugUpdate() {
	var res = "<strong>Debug Display</strong><br>";
	var props = Object.keys(debugDispNow);
	props.sort();
	for (var prop of props) {
		res += prop;
		res += ": ";
		if (typeof debugDispNow[prop] == "number") {
			res += debugDispNow[prop].toFixed(4); // prevent massive decimal chains
		} else {
			res += JSON.stringify(debugDispNow[prop]);
		}
		res += "<br>";
	}
	document.getElementById("debugStuff").innerHTML = res;
	document.getElementById("debugStuff").style.display = (showGUI && showDebug)?"block":"none";
}
setInterval(debugUpdate, 20);


var assetsReady = function() {
	console.log("all things loaded");
	document.getElementById("startBtn").innerHTML = "Start!";
	document.getElementById("startBtn").disabled = false;
	noise.seed(6969);
	// size the canvas
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	gl.viewport(0, 0, canvas.width, canvas.height);

	overlay = document.getElementById("overlay");
	overlay.width = canvas.width;
	overlay.height = canvas.height;
	oCtx = overlay.getContext("2d");
	oCtx.fillStyle = "rgb(0, 0, 0)";
	oCtx.font = "190px Open Sans";
	oW = overlay.width; oH = overlay.height;

	canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
	overlay.onclick = function() {canvas.requestPointerLock();};
	document.exitPointerLock = document.exitPointerLock ||
						document.mozExitPointerLock;
	canvas.addEventListener("mousemove", onCameraTurn);
	overlay.addEventListener("mousemove", function(e) {mousepos = [e.clientX, e.clientY];});
	canvas.addEventListener("wheel", e=>{
		if (e.deltaY > 0) {
			if (player.selected == 3) {player.selected = 0;}
			else if (player.inv[player.selected + 1]) {player.selected += 1;}
		}
		if (e.deltaY < 0) {
			if (player.selected == 0) {player.selected = 3;}
			else if (player.inv[player.selected - 1]) {player.selected -= 1;}
		}
	});
	gl.enable(gl.DEPTH_TEST);
}

function gameHelp() {
	document.getElementById("helpDiv").style.display = "block";
}

function startGame() {
	if (firstTimePlaying) {
		generalWorker = new Worker("./static/zw4/worker.js?randNum="+Math.random());
	}
	player = new Player();
	if (firstTimePlaying) {
		Gun.init();
		Bullet.init();
		IHP.init();
		PathfinderInterface.init();
	}
	oCtx.fillText("Loading...", 100, 100);
	requestAnimationFrame(function(t) {firstTime = t;});
    requestAnimationFrame(gameLoop);
    document.getElementById("homeDiv").style.display = "none";
	canvas.requestPointerLock();
	IHP.debugLine = debugLine;

	globalSkybox = new SkyBox(models.skybox, createRenderBuffer("shaderProgram"));
	canvas.style.backgroundColor = "black"; // cause alpha is not working gr

	currentLevel = new Level(models.level1, 1);
	currentLevel.load();

	menuSongAudioObject.pause();
}
var deadSong = new Audio("/static/worldgentest/songs/pressure.mp3");
deadSong.currentTime = 40.37;
function ded(reason) {
	document.getElementById("deadDiv").style.display = "block";
	document.getElementById("deadReason").innerHTML = reason;
	running = false;
	deadSong.play();
	firstTimePlaying = false;
	SFXhandler.stopAll();
	setTimeout(function() { // buy us some time to finish the current frame before stopping everything
		// reset everything in preparation for the restart
		// but not really reset everything, for example, we won't reset the render buffers and also won't call init() again
		// WARNING: ^^^ may cause dumb behavior in the future when I add more features that rely on init() being called for every restart
		lastTime = -1;
		items = []; zombies = []; bullets = []; particles = []; physicsObjects = [];
		IHP.regenerateKinematics();
		clearAllBuffers();
	}, 100);
	document.exitPointerLock();
}

function restartButton() {
	deadSong.pause();
	deadSong.currentTime = 40.37;
	menuSongAudioObject.currentTime = 0;
	menuSongAudioObject.play();
	document.getElementById("deadDiv").style.display = "none";
	document.getElementById("homeDiv").style.display = "block";
}

function onCameraTurn(e) {
	mousepos = [e.clientX, e.clientY];
	player.yaw   += e.movementX * 0.1;
	player.pitch -= e.movementY * 0.1;
	if (player.pitch > 89) { player.pitch = 89; }
	if (player.pitch < -89) { player.pitch = -89; }
}

var lastTime = -1;
var DAYLENGTH = 30000;
var COLORLENGTH = DAYLENGTH/8;
function mix(a, b, amount) {
	return a * (1 - amount) + b * amount;
}

var __frameNum = 0, __ptime = 0, framesPassed = 0;

function renderProgressCircle(msg, remaining, total) {
	// renders a surviv-like progress circle
	var dTheta = (1 - remaining / total) * 2 * Math.PI;
	oCtx.strokeStyle = "white"; oCtx.lineWidth = 10;
	oCtx.globalAlpha = 1;
	oCtx.beginPath();
	oCtx.arc(oW * 0.5, oH * 0.5, oW * 0.03, -Math.PI/2, -Math.PI/2 + dTheta);
	oCtx.stroke();
	oCtx.lineWidth = 2;
	oCtx.fillStyle = "black";
	oCtx.fillRect(oW * 0.45, oH * 0.6, oW * 0.1, oH * 0.05);
	oCtx.font = (oH * 0.03) + "px Impact";
	oCtx.textAlign = "center";
	oCtx.fillStyle = "white";
	oCtx.fillText(msg, oW * 0.5, oH * 0.635);
}

function renderInteractionPrompt(text) {
	// used to render prompts like "F - MAC M10"
	oCtx.fillStyle = "black";
	oCtx.fillRect(oW * 0.4, oH * 0.03, oW * 0.2, oH * 0.07);
	oCtx.textAlign = "center";
	oCtx.fillStyle = "white";
	oCtx.font = (oH * 0.06) + "px Impact";
	oCtx.fillText(text, oW * 0.5, oH * 0.08);
}

function gameLoop(_t) {

	if (paused) {
		lastTime = _t;
		requestAnimationFrame(gameLoop);
		return;
	}

	framesPassed++;
	var _startTime = performance.now();
	var _finishedLastTask = performance.now();
	if (lastTime == -1) {lastTime = _t;}
	var dt = _t - lastTime;
	lastTime = _t;
	dt = Math.min(dt, 100);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	oCtx.clearRect(0, 0, oW, oH);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	globalFogColor = glMatrix.vec4.fromValues(0, 0, 0, 0);
	globalFogAmount = levelSpecs[currentLevel.levelNum].fogAmount;
	lightingInfo = [...levelSpecs[currentLevel.levelNum].lighting.lightDirection, ...levelSpecs[currentLevel.levelNum].lighting.color, ...levelSpecs[currentLevel.levelNum].lighting.ambient];

	// movement
	if (divisDownKeys["ShiftLeft"]) {
		player.actualSpeed = player.sprintSpeed;
	} else {
		player.actualSpeed = player.speed;
	}
	var scaledFront = glMatrix.vec3.create();
	scaledFront[0] = player.cameraFront[0]; scaledFront[2] = player.cameraFront[2];
	glMatrix.vec3.normalize(scaledFront, scaledFront);
	glMatrix.vec3.scale(scaledFront, scaledFront, player.actualSpeed * dt/1000);
	var right = glMatrix.vec3.create();
	glMatrix.vec3.cross(right, scaledFront, player.cameraUp);
	glMatrix.vec3.normalize(right, right);
	glMatrix.vec3.scale(right, right, player.actualSpeed * dt/1000);

	player.userInputVelocity = glMatrix.vec3.create();
	if (divisDownKeys["KeyW"]) {
		glMatrix.vec3.add(player.pos, player.pos, scaledFront);
		glMatrix.vec3.add(player.userInputVelocity, player.userInputVelocity, scaledFront);
	}
	if (divisDownKeys["KeyS"]) {
		glMatrix.vec3.subtract(player.pos, player.pos, scaledFront);
		glMatrix.vec3.subtract(player.userInputVelocity, player.userInputVelocity, scaledFront);
	}
	if (divisDownKeys["KeyA"]) {
		glMatrix.vec3.subtract(player.pos, player.pos, right);
		glMatrix.vec3.subtract(player.userInputVelocity, player.userInputVelocity, right);
	}
	if (divisDownKeys["KeyD"]) {
		glMatrix.vec3.add(player.pos, player.pos, right);
		glMatrix.vec3.add(player.userInputVelocity, player.userInputVelocity, right);
	}
	if (divisDownKeys["KeyR"] && player.selected.constructor.name == "Gun") {
		player.selected.attemptReload();
	}
	if (divisDownKeys["Digit1"]) {player.invIndex = 0;}
	if (divisDownKeys["Digit2"]) {player.invIndex = 1;}
	if (divisDownKeys["Digit3"]) {player.invIndex = 2;}
	if (divisDownKeys["Digit4"]) {player.invIndex = 3;}

	// scale up the userInputVelocity since the velocity is the movement per frame but IHP runs in movement per second
	glMatrix.vec3.scale(player.userInputVelocity, player.userInputVelocity, 1000/dt);

	IHP.simulationCenter = player.pos;

	debugDispNow["[p] movement headers "] = performance.now() - _finishedLastTask;
	_finishedLastTask = performance.now();
	

	// updates
	player.materialStandingOn = false; // set it to false, then physicsUpdate may set it to a material if it detects that player is colliding with the ground
	IHP.physicsUpdate(dt, 16.666);
	GUIeffects.update(dt);
	debugDispNow["[p] physics "] = performance.now() - _finishedLastTask;
	_finishedLastTask = performance.now();


	player.update(dt);
	Bullet.update(dt);
	Item.update(dt);
	Zombie.update(dt);
	Gun.update(dt);
	currentLevel.particleEffect.update();
	SFXhandler.update();
	SFXhandler.earPos = player.pos;
	
	// firing
	debugDispNow["lmb"] = mouseDown;
	debugDispNow["rmb"] = rmb;
	if (player.selected.type == "gun") {
		player.selected.update(dt, true, player.pos);
		if (mouseDown && player.selected.canShoot(player.pos)) {
			player.selected.recoil();
			var scaledFront = glMatrix.vec3.create();
			var distanceFromPlayer = player.selected.specs.barrelLength;
			var spawnPos = glMatrix.vec3.create();
			glMatrix.vec3.scale(scaledFront, player.cameraFront, distanceFromPlayer);
			glMatrix.vec3.add(spawnPos, player.cameraPos, scaledFront);
			Bullet.fireBullet(spawnPos, player.yaw, player.pitch,
				player.selected.specs.spread, player.selected.specs.bulletColor,
				player.selected.specs.bulletWidth, player.selected.specs.bulletLength,
				player.selected.specs.bulletSpeed, player.selected.specs.damage, 5, [player.vel[0], player.vel[1], player.vel[2]]);
			Gun.muzzleFlash(spawnPos, 0.175, 5, 1);
			var cartridgeScaledFront = glMatrix.vec3.create(), cartridgePos = glMatrix.vec3.create();
			glMatrix.vec3.scale(cartridgeScaledFront, player.cameraFront, player.selected.specs.ejectionDistance);
			glMatrix.vec3.add(cartridgePos, player.cameraPos, cartridgeScaledFront);
			var ejected = Gun.ejectCartridge(cartridgePos, player.selected.specs.cartridge, glMatrix.glMatrix.toRadian(-player.yaw));

			// add player's velocity to the cartridge so it moves with the player somewhat
			glMatrix.vec3.add(ejected.vel, ejected.vel, player.userInputVelocity);
			glMatrix.vec3.add(ejected.vel, ejected.vel, player.vel);
		}
	}

	debugDispNow["[p] updates "] = performance.now() - _finishedLastTask;
	_finishedLastTask = performance.now();

	// rendering
	__ptime = performance.now();
	flushUniforms();
	globalSkybox.render(player.cameraFront, player.cameraUp);

	useShader("shaderProgram");
	gl.drawArrays(gl.TRIANGLES, 0, buffers_d.shaderProgram.data.aVertexPosition.length/3);

	Bullet.renderAll();
	Item.renderAll();
	Zombie.renderAll();
	Gun.render();

	if (showGUI) {
		player.selected.render(mouseDown || rmb);
	}

	updateParticles(dt);

	IHP.drawAllBoxes();
	// player.pathfinder.renderGrid();

	debugDispNow["[p] rendering "] = performance.now() - _finishedLastTask;
	_finishedLastTask = performance.now();

	// GUI
	if (showGUI) {
		__ptime = performance.now();
		// crosshair
		var crosshairSize = oW * 0.07;
		if (!( (mouseDown || rmb) && player.selected.type == "gun")) { // when the player is sighting with the gun, no crosshair
			oCtx.drawImage(oTex.crosshair, oW * 0.5-crosshairSize/2, oH * 0.5-crosshairSize/2, crosshairSize, crosshairSize);
		}

		// health bar
		oCtx.strokeStyle = "lime";
		oCtx.strokeRect(oW * 0.3, oH * 0.9, oW * 0.4, oH * 0.05);
		var healthRatio = player.health / player.maxHealth;
		if (healthRatio == 1) oCtx.fillStyle = "grey";
		else if (healthRatio > 0.7) oCtx.fillStyle = "lightgrey";
		else if (healthRatio > 0.4) oCtx.fillStyle = "pink";
		else if (healthRatio > 0.25) oCtx.fillStyle = "purple";
		else oCtx.fillStyle = "red";
		oCtx.fillRect(oW * 0.3, oH * 0.9, oW * 0.4 * healthRatio, oH * 0.05);

		// ammo remaining
		if (player.selected.name != "empty") {
			oCtx.fillStyle = "black";
			oCtx.globalAlpha = 0.5;
			oCtx.fillRect(oW * 0.46, oH * 0.8, oW * 0.08, oH * 0.07);
			if (true) { // later, replace this with the ammo in the player's bag
				oCtx.fillRect(oW * 0.55, oH * 0.82, oW * 0.05, oH * 0.05);
			}
			oCtx.globalAlpha = 1;
			oCtx.textAlign = "center";
			if (player.selected.roundsRemaining > 0) {
				oCtx.fillStyle = "white";
			} else {
				oCtx.fillStyle = "red";
			}
			oCtx.font = "40px Impact";
			oCtx.fillText(player.selected.roundsRemaining, oW * 0.5, oH * 0.85);
			if (true) { // same here as ^^^
				oCtx.font = "30px Impact";
				oCtx.fillStyle = "white";
				oCtx.fillText(100, oW * 0.575, oH * 0.86);
			}
		}

		oCtx.fillStyle = "black";
		oCtx.globalAlpha = 0.5;
		// inventory
		for (var i=0; i<4; i++) {
			var y = i * oH * 0.1 + oH * 0.6;
			oCtx.fillRect(oW * 0.85, y, oW * 0.14, oH * 0.09);
		}
		oCtx.fillStyle = "white";
		oCtx.globalAlpha = 1;
		oCtx.font = (oH * 0.03) + "px Impact";
		oCtx.textAlign = "right";
		for (var i=0; i<4; i++) {
			var y = i * oH * 0.1 + oH * 0.6;
			oCtx.fillText(player.inv[i].name, oW * 0.98, y + oH * 0.07);
		}

		// zombies killed and timer (speedrun stuff)
		oCtx.globalAlpha = 0.5;
		oCtx.fillStyle = "black";
		oCtx.fillRect(oW * 0.7, oH * 0.03, oW * 0.27, oH * 0.2);
		oCtx.globalAlpha = 1.0;
		oCtx.fillStyle = "white";
		oCtx.textAlign = "left";
		oCtx.font = "" + (oW * 0.02) + "px Impact";
		oCtx.fillText("Zombies Killed: " + player.zombiesKilled, oW * 0.71, oH * 0.08);
		oCtx.fillText("Time: " + Math.floor((_t - firstTime)/100)/10, oW * 0.71, oH * 0.15);

		// effects
		GUIeffects.render();

		// reloading
		if (player.selected.type == "gun" && player.selected.reloadRemaining > 0) {
			renderProgressCircle("Reloading", player.selected.reloadRemaining, player.selected.specs.reloadTime);
		}
	}

	if (player.health <= 0) {
		return;
	}

	debugDispNow["hitboxes shown"] = IHP.drawLines;
	debugDispNow["player yaw"] = player.yaw;
	debugDispNow["player pitch"] = player.pitch;
	debugDispNow["player pos"] = "(" + Math.round(player.pos[0] * 100)/100 + ", " + Math.round(player.pos[1] * 100)/100 + ", " + Math.round(player.pos[2] * 100)/100 + ")";

	if (framesPassed % 200 == 0) {
		debugDispNow["frame time"] = performance.now() - _startTime;
	}
	debugDispNow["[p] GUI"] = performance.now() - _finishedLastTask;
	_finishedLastTask = performance.now();
    requestAnimationFrame(gameLoop);
}