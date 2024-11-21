Array.prototype.removeElement = function(el) {
    for (var i=0; i<this.length; i++) {
        if (this[i] === el) {this.splice(i, 1);}
    }
}
Array.prototype.alist = function(n) {
    var ret  = [];
    for (var x of this) {
        ret.push(x + n);
    }
    return ret;
}

var bullets = [], items = [], zombies = [];

class SFXhandler {
    static nowPlaying = [];
    
    static earPos = [0,0,0];
    static categoryVolume = {
        ambience: 1,
        SFX: 1,
        music: 1,
        default: 1
    };
    static internalMasterVolume = 1; // meant to be set by the code
    static userMasterVolume = 1; // meant to be set by the user
    static distanceDropoff(dist) {
        // returns [0, 1] depending on distance
        return Math.max(0, Math.pow(0.9, dist));
    }
    static newSound(url, _pos, volume, category, ambient = false, loop = false, customDropOff = false) {
        // ambient = it is played at full volume regardless of where you are at
        if (!this.categoryVolume[category]) {
            category = "default";
        }
        var pos = [_pos[0], _pos[1], _pos[2]]; // copy it
        let toPush = {
            url: url, pos: pos, volume: volume, category: category, ambient: ambient, loop: loop,
            dropOff: (customDropOff?customDropOff:this.distanceDropoff),
            obj: new Audio(url)
        };
        toPush.obj.loop = loop;
        toPush.obj.volume = volume * this.categoryVolume[category] * SFXhandler.internalMasterVolume * SFXhandler.userMasterVolume * toPush.dropOff(glMatrix.vec3.dist(pos, this.earPos));
        if (ambient) {toPush.obj.volume = volume * this.categoryVolume[category];}
        toPush.obj.play();
        if (!loop) toPush.obj.addEventListener("ended", function() {toPush.removed = true;});
        this.nowPlaying.push(toPush);
        return toPush;
    }
    static update() {
        this.nowPlaying = this.nowPlaying.filter(p=>!p.removed);
        for (var s of this.nowPlaying) {
            if (s.ambient) {s.obj.volume = s.volume * this.categoryVolume[s.category] * SFXhandler.internalMasterVolume * SFXhandler.userMasterVolume;}
            else {s.obj.volume = s.volume * SFXhandler.internalMasterVolume * SFXhandler.userMasterVolume * this.categoryVolume[s.category] * s.dropOff(glMatrix.vec3.dist(s.pos, this.earPos));}
        }
    }
    static stopAll() {
        // stops all audio and deletes them
        for (var a of SFXhandler.nowPlaying) {
            a.obj.pause();
        }
        SFXhandler.nowPlaying = [];
    }
    static cancelPlayback(x) {
        // cancels the playback of x
        x.removed = true;
        x.obj.pause();
    }
}

class GUIeffects {
    // like the hit markers, the little numbers that appear when you do damage etc
    static effects = [];
    static update(dt) {
        // presumably dt in ms
        GUIeffects.effects = GUIeffects.effects.filter((e)=>e.timeRemaining>0);
        for (var e of GUIeffects.effects) {
            e.timeRemaining -= dt/1000;
            glMatrix.vec3.add(e.velocity, e.velocity, glMatrix.vec2.scale([0,0], e.gravity, dt/1000));
            glMatrix.vec2.add(e.pos, e.pos, glMatrix.vec2.scale([0,0], e.velocity, dt/1000));
        }
    }
    static render() {
        for (var e of GUIeffects.effects) {
            oCtx.globalAlpha = Math.max(0, e.timeRemaining/e.fadeTime);
            oCtx.save();
            oCtx.translate(e.pos[0], e.pos[1]);
            oCtx.rotate(e.angle);
            if (e.text) {
                oCtx.font = e.fontsize + "px Impact";
                oCtx.fillStyle = e.fillColor;
                oCtx.fillText(e.text, 0, 0);
                oCtx.strokeStyle = e.strokeColor;
                oCtx.strokeWidth = e.strokeWidth;
                oCtx.strokeText(e.text, 0, 0);
            } else {
                var w = e.width;
                var h = e.image.height * e.width / e.image.width;
                oCtx.drawImage(e.image, -w/2, -h/2, w, h);
            }
            oCtx.restore();
        }
        oCtx.globalAlpha = 1;
    }
    static newTextEffect(text, fontsize, fillColor, strokeColor, strokeWidth, fadeTime, startPos, velocity, gravity, angle=0) {
        // velocity is in pixels/s and gravity in pixels s^-2
        // fadeTime in seconds
        GUIeffects.effects.push({
            image: null,
            text: text, fontsize: fontsize, fillColor: fillColor, strokeColor: strokeColor, strokeWidth: strokeWidth, fadeTime: fadeTime, velocity: velocity, gravity: gravity,
            timeRemaining: fadeTime, pos: startPos,
            angle: angle
        });
    }
    static newImageEffect(image, width, fadeTime, startPos, velocity, gravity, angle=0) {
        // velocity is in pixels/s and gravity in pixels s^-2
        // fadeTime in seconds
        GUIeffects.effects.push({
            image: image, text: null,
            width: width, fadeTime: fadeTime, velocity: velocity, gravity: gravity,
            timeRemaining: fadeTime, pos: startPos,
            angle: angle
        });
    }
}

class Cartridge extends PhysicsObject {
    // an ejected cartridge. updates and everything are handled through Gun.
    static maxDist = 20;
    constructor(pos, model, angleY) {
        super(pos[0], pos[1], pos[2], 0.1, 0.1, 0.1, false, false, true);
        this.model = model; this.angleY = angleY;
        this.angleX = 0;
    }
    onCollision(o, n) {
        if (o.isBullet) {return;}
        this.removed = true;
    }
}

class Gun {
    static addresses = {};
    static muzzleFlashes = [];
    static flashTexCoords = [];
    static muzzleFlashAddress;
    static muzzleFlashColor = [0.17, 0.17, 0.05];
    static cartridgeAddress;
    static cartridges = [];
    static init() {
        // muzzle flash
        var texCycle = [0, 1,
            1, 1,
            1, 0,
            0, 1,
            1, 0,
            0, 0];
        for (var x=0; x<2; x++) {
            for (var y=0; y<3; y++) {
                var toPush = [];
                for (var i=0; i<texCycle.length; i+=2) {
                    toPush.push(texCycle[i]*128/texW + 128/texW * x);
                    toPush.push(texCycle[i+1]*128/texH + 1664/texH + y*128/texH);
                }
                Gun.flashTexCoords.push(toPush);
            }
        }
        Gun.muzzleFlashAddress = createRenderBuffer("billboardShader");

        // cartridge ejection
        Gun.cartridgeAddress = createRenderBuffer("transformShader");

        // guns
        for (var name in gunSpecs) {
            Gun.addresses[name] = createRenderBuffer("objShader");
            var model = models["gun_" + name];
            var datas = getRBdata(Gun.addresses[name], "objShader");
            // since datas is empty, we can use .concat() without any risk of quadratic time complexity
            datas.aVertexPosition = datas.aVertexPosition.concat(model.position);
            datas.aVertexNormal = datas.aVertexNormal.concat(model.normal);
            datas.aColor = datas.aColor.concat(model.color);
            flushRB(Gun.addresses[name], "objShader");
        }
    }
    constructor(name) {
        this.name = name;
        this.specs = JSON.parse(JSON.stringify(gunSpecs[name]));
        this.model = models["gun_" + name];
        this.firingDelay = 0;
        this.roundsRemaining = 0;
        this.reloadRemaining = 0;
        this.type = "gun";
        this.currentRecoilTranslation = glMatrix.vec3.create();
        this.currentRecoilRotation = glMatrix.vec3.create();
        this.pos = [0,0,0];
        this.reloadSFX = null; // the SFX handler audio thingy for the reload

        this.time = 0; // used for the "breathing" animations
    }
    update(dt, focused, pos) {
        this.time += dt * player.actualSpeed / player.speed; // since the time variable is only used for the breathing animation, which needs to change speed based on how fast the player is running, we scale the dt
        this.pos = pos;
        if (focused) {
            // if the player is selecting this gun, then we can reload
            var oldRR = this.reloadRemaining;
            this.reloadRemaining -= dt;
            if (oldRR > 0 && this.reloadRemaining <= 0) {
                // we finished reloading
                this.roundsRemaining += this.specs.roundsPerReload;
                this.roundsRemaining = Math.min(this.roundsRemaining, this.specs.capacity); // when you reload and your mag isn't empty, it might cause the number of bullets to be above the capacity so clamp them
                if (this.roundsRemaining != this.specs.capacity) { // for cycle reload weapons
                    this.attemptReload();
                }
            }
        }
        this.firingDelay -= dt;
        if (this.roundsRemaining == 0) {
            this.attemptReload();
        }
        glMatrix.vec3.scale(this.currentRecoilRotation, this.currentRecoilRotation, this.specs.recoil.recoilDecayFactor);
        glMatrix.vec3.scale(this.currentRecoilTranslation, this.currentRecoilTranslation, this.specs.recoil.recoilDecayFactor);
    }
    attemptReload() {
        // attempts to reload the gun
        // may fail if
        // 1. already reloading
        // 2. firingDelay > 0 and you can't reload when firing
        // 3. already full
        if (this.roundsRemaining != this.specs.capacity && this.reloadRemaining <= 0 && this.firingDelay < 0) {
            this.reloadRemaining = this.specs.reloadTime; // we need to reload
            this.reloadSFX = SFXhandler.newSound("./static/zw4/sfx/reload_" + this.name + ".mp3", this.pos, 1, "SFX", false);
        }
    }
    recoil() {
        this.currentRecoilTranslation = glMatrix.vec3.fromValues(this.specs.recoil.recoilSideDevation * (Math.random() - 0.5), 0, this.specs.recoil.linearRecoil);
        this.currentRecoilRotation = glMatrix.vec3.fromValues(this.specs.recoil.muzzleRiseRotation, this.specs.recoil.recoilSideRotation * (Math.random() - 0.5), 0);
    }
    canShoot(pos) { // returns true if the player can shoot right now and then shoots
        // since it shoots if you can shoot, it needs the position of the gun to make the sound the approprate volume
        if (this.firingDelay <= 0 && this.roundsRemaining > 0) {
            SFXhandler.newSound("./static/zw4/sfx/fire_" + this.name + ".mp3", pos, 1, "SFX", false);
            this.roundsRemaining--;
            if (!this.specs.burstFire) {
                this.firingDelay = this.specs.delay;
            } else {
                if (this.roundsRemaining % this.specs.roundsPerBurst == 0) {
                    this.firingDelay = this.specs.delay;
                } else {
                    this.firingDelay = this.specs.burstDelay;
                }
            }
            if (this.reloadRemaining > 0) {
                // was in the process of reloading when they shot
                // cancel previous reload
                this.reloadRemaining = -1;
                SFXhandler.cancelPlayback(this.reloadSFX);
                this.attemptReload();
            }
            return true;
        }
        return false;
    }
    render(sighting) {
        gl.useProgram(buffers_d.objShader.compiled);
        useRenderBuffer(Gun.addresses[this.name], "objShader");
        var oldMVM = new Float32Array(modelViewMatrix);
        // translate the MVM for recoil
        if (sighting) {
            glMatrix.mat4.fromTranslation(modelViewMatrix, this.currentRecoilTranslation);
        } else {
            glMatrix.mat4.fromTranslation(modelViewMatrix, [-0.2, -0.05, -0.5]);
        }
        // breathing animation
        if (!sighting) {
            glMatrix.mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0.01*Math.sin(this.time/500), 0]);
        }
        // rotate the MVM for recoil
        glMatrix.mat4.rotateX(modelViewMatrix, modelViewMatrix, this.currentRecoilRotation[0]);
        glMatrix.mat4.rotateY(modelViewMatrix, modelViewMatrix, this.currentRecoilRotation[1]);
        glMatrix.mat4.rotateZ(modelViewMatrix, modelViewMatrix, this.currentRecoilRotation[2]);
        gl.uniformMatrix4fv(buffers_d.objShader.uniform.uModelViewMatrix, false, modelViewMatrix);

        gl.drawArrays(gl.TRIANGLES, 0, getRBdata(Gun.addresses[this.name], "objShader").aVertexPosition.length/3);
        modelViewMatrix = oldMVM;
        gl.uniformMatrix4fv(buffers_d.objShader.uniform.uModelViewMatrix, false, modelViewMatrix);
    }
    static update(dt) {
        Gun.muzzleFlashes = Gun.muzzleFlashes.filter((x)=>x.framesLeft>0);
        Gun.cartridges = Gun.cartridges.filter((x)=>!x.removed);
        for (var c of Gun.cartridges) {
            if (glMatrix.vec3.dist(player.pos, c.pos) > Cartridge.maxDist) {
                c.removed = true;
            }
        }
        var maxBrightness = 0;
        for (var f of Gun.muzzleFlashes) {
            maxBrightness = Math.max(maxBrightness, f.brightness);
        }
        lightingInfo[6] += Gun.muzzleFlashColor[0] * maxBrightness;
        lightingInfo[7] += Gun.muzzleFlashColor[1] * maxBrightness;
        lightingInfo[8] += Gun.muzzleFlashColor[2] * maxBrightness;
    }
    static render() {
        // muzzle flash
        var datas = getRBdata(Gun.muzzleFlashAddress, "billboardShader");
        for (var prop in datas) {datas[prop] = [];}
        for (var m of Gun.muzzleFlashes) {
            m.framesLeft--;
            for (var i=0; i<m.numParticles; i++) {
                var cycle = [-1.0, -1.0,
                    1.0, -1.0,
                    1.0, 1.0,
                    -1.0, -1.0,
                    1.0, 1.0,
                    -1.0, 1.0];
                // ik the offsets could be acheived in the aCenterOffset instead of here but im too lazy so yah
                var offsetX = (Math.random() - 0.5) * 2, offsetY = (Math.random() - 0.5) * 2;
                for (let a=0; a<cycle.length; a+=2) {
                    cycle[a] += (Math.random() - 0.5) * 0.5 + offsetX;
                    cycle[a+1] += (Math.random() - 0.5) * 0.5 + offsetY;
                    
                    cycle[a] *= m.size;
                    cycle[a+1] *= m.size;
                }
                quickConcat(datas.aTexCoord, Gun.flashTexCoords[Math.floor(Math.random() * 6)]);
                quickConcat(datas.aCorner, cycle);
                quickConcat(datas.aCenterOffset, mList(m.pos, 6));
            }
        }

        flushRB(Gun.muzzleFlashAddress, "billboardShader");
        gl.useProgram(buffers_d.billboardShader.compiled);
        useRenderBuffer(Gun.muzzleFlashAddress, "billboardShader");
        gl.uniformMatrix3fv(buffers_d.billboardShader.uniform.uLightingInfo, false, [1,1,1,1,1,1,1,1,1]); // make it bright for muzzle flash
        gl.drawArrays(gl.TRIANGLES, 0, datas.aCorner.length/3);
        gl.uniformMatrix3fv(buffers_d.billboardShader.uniform.uLightingInfo, false, lightingInfo);

        // cartridges
        var datas = getRBdata(Gun.cartridgeAddress, "transformShader");
        for (var prop in datas) {datas[prop] = [];}
        for (var c of Gun.cartridges) {
            quickConcat(datas.aVertexPosition, models[c.model].position);
            quickConcat(datas.aVertexNormal, models[c.model].normal);
            quickConcat(datas.aColor, models[c.model].color);
            quickConcat(datas.aTranslation, mList(c.pos, models[c.model].position.length/3));
            quickConcat(datas.aYRot, mList([c.angleY], models[c.model].position.length/3));
            quickConcat(datas.aXRot, mList([c.angleX], models[c.model].position.length/3));
        }
        flushRB(Gun.cartridgeAddress, "transformShader");
        gl.useProgram(buffers_d.transformShader.compiled);
        useRenderBuffer(Gun.cartridgeAddress, "transformShader");
        gl.drawArrays(gl.TRIANGLES, 0, datas.aVertexPosition.length/3);
    }
    static muzzleFlash(pos, size, numParticles, brightness) {
        // note: brightness doesn't affect the brightness of the actual flash
        // it is for how much the flash affects the global lighting
        Gun.muzzleFlashes.push({
            pos: pos,
            size: size,
            numParticles: numParticles,
            framesLeft: 2,
            brightness: brightness
        });
    }
    static ejectCartridge(pos, model, angleY) {
        var toPush = new Cartridge(pos, model, angleY);
        Gun.cartridges.push(toPush);
        glMatrix.vec3.rotateY(toPush.vel, [0, 1 + Math.random() * 0.3, -1 + Math.random() * 0.3], [0,0,0], angleY);
        toPush.ignores = new Set(["Player", "Cartridge"]);
        return toPush;
    }
}

class NothingGun { // basically an empty inv slot
    constructor(name) {
        this.name = "empty";
        this.type = "nothing";
    }
    render() {}
    canShoot() {return false;}
    update() {}
}

class Item extends PhysicsObject {
    static maximumAltitude = 100;
    static minimumAltitude = -10; // this way, they are removed before they are put to sleep
    constructor(x, y, z, thing, type, add = true) {
        super(x, y, z, 0.5, 0.5, 0.5, false, true, true);
        this.type = type;
        this.thing = thing;
        this.t = 0; // used for the rotation effect, in seconds
        if (add) items.push(this);
        // hb2 is used to give it a non-trigger collider, thus, it will not fall through the ground or similar
        this.hb2 = new PhysicsObject(x, y, z, 0.49, 0.49, 0.49, false, false, true);
        this.hb2.ignores = new Set(["Player"]);
    }
    render() {
        if (this.type == "gun") {
            gl.useProgram(buffers_d.objShader.compiled);
            useRenderBuffer(Gun.addresses[this.thing], "objShader");
            var oldMVM = new Float32Array(modelViewMatrix);
            glMatrix.mat4.translate(modelViewMatrix, modelViewMatrix, this.pos);
            glMatrix.mat4.translate(modelViewMatrix, modelViewMatrix, [0, Math.sin(this.t*3) * 0.1 + 0.2, 0]);
            glMatrix.mat4.rotateY(modelViewMatrix, modelViewMatrix, this.t);
            gl.uniformMatrix4fv(buffers_d.objShader.uniform.uModelViewMatrix, false, modelViewMatrix);
            gl.drawArrays(gl.TRIANGLES, 0, getRBdata(Gun.addresses[this.thing], "objShader").aVertexPosition.length/3);
            modelViewMatrix = oldMVM;
            gl.uniformMatrix4fv(buffers_d.objShader.uniform.uModelViewMatrix, false, modelViewMatrix);
        }
    }
    onCollision(obj, n) {
        if (this.removed) {return;} // since items may not be removed instantly
        if (this.type == "gun") {
            if (obj.constructor.name == "Player") {
                renderInteractionPrompt("F - " + this.thing);
                if (divisDownKeys["KeyF"]) {
                    var found = false;
                    for (var i=0; i<4; i++) {
                        if (player.inv[i].constructor.name == "NothingGun") {
                            player.inv[i] = new Gun(this.thing);
                            found = true;
                            player.invSelect = i;
                            break;
                        }
                    }
                    if (!found) {
                        var oldGun = player.inv[player.invIndex].name;
                        player.inv[player.invIndex] = new Gun(this.thing);
                        var itemPos = glMatrix.vec3.create();
                        glMatrix.vec3.add(itemPos, player.pos, glMatrix.vec3.normalize([0,0,0], [player.cameraFront[0], 0, player.cameraFront[2]]));
                        new Item(itemPos[0], player.pos[1], itemPos[2], oldGun, "gun", true);
                    }
                    this.removed = true;
                    SFXhandler.newSound("./static/zw4/sfx/pickup.mp3", player.pos, 1, "SFX", false, false);
                }
            }
        }
    }
    static update(dt) {
        for (var ib of items) {if (ib.removed) {ib.hb2.removed = true;}}
        items = items.filter((it)=>!it.removed);
        for (var ib of items) {
            ib.pos = ib.hb2.pos;
            ib.vel = [0, 0, 0];
            ib.t += dt/1000;
            if (ib.pos[1] < Item.minimumAltitude || ib.pos[1] > Item.maximumAltitude) {
                ib.removed = true;
            }
        }
    }
    static renderAll() {
        for (var ib of items) {
            if (glMatrix.vec3.distance(ib.pos, player.pos) < levelSpecs[currentLevel.levelNum].simulationDistance) {
                ib.render();
            }
        }
    }
}

class Bullet {
    // note: bullets don't have render distance and simulation distance and stuff because they travel very fast and are removed at maxDist from the player anyways
    static address;
    static init() {
        this.address = createRenderBuffer("transformShader");
    }
    constructor(color, pos, front, yaw, pitch, width, length, speed, damage, numBoxes, add = true, velOffset = [0,0,0]) {
        this.color = color; this.width = width; this.maxLength = length; this.speed = speed;
        this.front = new Float32Array(front); this.yaw = yaw; this.pitch = pitch;
        this.actualLength = 0;
        this.hitboxes = [];
        this.pos = pos;
        this.damage = damage;
        this.velOffset = velOffset; // to give some velocity to the bullet so if the player is falling while firing, the bullet falls as well
        let bul = this, dmg = damage; // create a function closure
        for (var i=0; i<numBoxes; i++) {
            this.hitboxes.push(new PhysicsObject(pos[0], pos[1], pos[2], width, width, width, false, true, true));
            this.hitboxes[i].isBullet = true;
            this.hitboxes[i].ignores.add("Cartridge"); // so they don't dissapear from the cartridges being ejected
            this.hitboxes[i].onCollision = function(o, n) {if (!o.isBullet && !bul.removed) {
                bul.destruct();
                if (o.takeDamage) {
                    o.takeDamage(dmg, bul);
                }
                // particles
                particles.push(new ParticleSystem(bul.pos, D_ONE_POINT(), 3, 0.6, [2000/TEXW,100/TEXH], 0, 0.1, 5, 200, 1));
            }};
        }
        if (add) {
            bullets.push(this);
        }

        this.whoosingSound = false; // the SFXhandler handle for the bullet's whooshing sound
    }
    static update(dt) {
        bullets = bullets.filter((b)=>!b.removed);
        var datas = getRBdata(Bullet.address, "transformShader");
        for (var prop in datas) {datas[prop] = [];}
        for (var bul of bullets) {
            for (var i=0; i<bul.hitboxes.length; i++) {
                var hb = bul.hitboxes[i];
                glMatrix.vec3.add(hb.vel, hb.vel, glMatrix.vec3.scale([0,0,0], PhysicsObject.GlobalGravity, -dt/1000)); // no bullet drop
                hb.pos = glMatrix.vec3.add([0, 0, 0], bul.pos, glMatrix.vec3.scale([0, 0, 0], bul.front, -bul.actualLength * i / bul.hitboxes.length));
            }
            var scaledFront = glMatrix.vec3.create();
            glMatrix.vec3.scale(scaledFront, bul.front, bul.speed * dt / 1000);
            glMatrix.vec3.add(bul.pos, bul.pos, scaledFront);
            glMatrix.vec3.add(bul.pos, bul.pos, glMatrix.vec3.scale([0,0,0], bul.velOffset, dt / 1000));
            bul.actualLength += bul.speed * dt / 1000;
            bul.actualLength = Math.min(bul.actualLength, bul.maxLength);
            if (glMatrix.vec3.distance(player.cameraPos, bul.pos) > levelSpecs[currentLevel.levelNum].physicsSimulationDistanceG) {
                bul.destruct();
            }
            bul.concatDataTo(datas);

            // whooshing sound
            if (!bul.whoosingSound && glMatrix.vec3.dist(bul.pos, player.pos) < 8) {
                bul.whoosingSound = SFXhandler.newSound("./static/zw4/sfx/bullet.mp3", bul.pos, 1, "SFX", false, false, function(dist) {
                    // returns [0, 1] depending on distance
                    return Math.max(0, 1 - dist/6);
                });
            } else if (bul.whoosingSound) {
                bul.whoosingSound.pos = bul.pos;
            }
        }
        flushRB(Bullet.address, "transformShader");
    }
    static renderAll() {
        gl.useProgram(buffers_d.transformShader.compiled);
        useRenderBuffer(Bullet.address, "transformShader");
        gl.drawArrays(gl.TRIANGLES, 0, getRBdata(Bullet.address, "transformShader").aVertexPosition.length/3);
    }
    concatDataTo(obj) {
        // concats our position, normal and color data to the obj
        // (we are using transformShader)
        for (var i=0; i<cubePositions.length; i+=3) {
            obj.aVertexPosition.push(cubePositions[i] * this.width);
            obj.aVertexPosition.push(cubePositions[i+1] * this.width);
            obj.aVertexPosition.push(Math.min(cubePositions[i+2], 0) * this.actualLength);

            obj.aVertexNormal.push(cubeNormals[i]);
            obj.aVertexNormal.push(cubeNormals[i+1]);
            obj.aVertexNormal.push(cubeNormals[i+2]);

            obj.aColor.push(this.color[0]); obj.aColor.push(this.color[1]); obj.aColor.push(this.color[2]); obj.aColor.push(this.color[3]);

            obj.aYRot.push(glMatrix.glMatrix.toRadian(-this.yaw + 90)); obj.aXRot.push(glMatrix.glMatrix.toRadian(-this.pitch));
            obj.aTranslation.push(this.pos[0]); obj.aTranslation.push(this.pos[1]); obj.aTranslation.push(this.pos[2]);
        }
    }
    destruct() {
        // we need to clean up the hitboxes, as well as stop the whooshing sound
        this.removed = true;
        for (var hb of this.hitboxes) {hb.removed = true;}
        if (this.whoosingSound) {
            SFXhandler.cancelPlayback(this.whoosingSound);
        }
    }
    static fireBullet(pos, yaw, pitch, spread, color, width, length, speed, damage, numBoxes, velOffset = [0,0,0]) {
        var adjYaw = yaw + (Math.random() * 2 - 1) * spread;
        var adjPitch = pitch + (Math.random() * 2 - 1) * spread;
        var rotatedFront = glMatrix.vec3.create();
        rotatedFront[0] = Math.cos(glMatrix.glMatrix.toRadian(adjYaw)) * Math.cos(glMatrix.glMatrix.toRadian(adjPitch));
        rotatedFront[1] = Math.sin(glMatrix.glMatrix.toRadian(adjPitch));
        rotatedFront[2] = Math.sin(glMatrix.glMatrix.toRadian(adjYaw)) * Math.cos(glMatrix.glMatrix.toRadian(adjPitch));

        return new Bullet(color, pos,
            rotatedFront, adjYaw,
            adjPitch, width,
            length, speed, damage, numBoxes, true, velOffset);
    }
}

class Zombie extends PhysicsObject {
    // an interesting caveat about zombie rotation code is that in all the zombie models,
    // the zombie must face in the +z (actually +y because blender uses y as z) direction
    // this is because in the OpenGL coordinates, the z axis is the one that points towards
    // the player.
    constructor(x, y, z, type, pathfinder, aggroWidth, add = true) {
        super(x, y, z, zombieSpecs[type].dx, zombieSpecs[type].dy, zombieSpecs[type].dz, false, false, true);
        this.id = Math.floor(Math.random() * 69420); // so when it requests a path from the worker, and the worker sends it back, we can find out who asked :trollface:

        this.anim = animators["zomb_" + type];
        this.type = type;
        this.gun = new Gun(zombieSpecs[type].gun);
        this.pathfinder = pathfinder;
        this.specs = zombieSpecs[type];
        this.yaw = 0; this.pitch = 0;
        if (add) {
            zombies.push(this);
        }
        this.frameNum = 0;
        this.health = zombieSpecs[type].health;
        this.aggroWidth = aggroWidth;
        this.aggroed = false;
        // aggro trigger hitbox
        this.aggroHitbox = new PhysicsObject(x, y, z, aggroWidth[0], aggroWidth[1], aggroWidth[2], true, true, true);
        this.aggroHitbox.useAllowList = true;
        this.aggroHitbox.collidesWith.add("Player");

        // countdown for timing the aggro noises
        this.aggroNoiseCountdown = 0;

        let zo = this; // generate a closure for the onCollision function
        this.aggroHitbox.onCollision = function(o, normal) {
            if (o == player && !zo.aggroed && !zo.removed) {
                zo.aggroed = true;
            }
        }

        // zombies will fire in bursts whenever they see the player
        this.burstRoundsRemaining = 0;
        this.burstCooldown = Math.random() * 3 + 3;
    }
    shouldFire() {
        // computes if the zombie should fire (by using a raycast to see if it will actually hit the player)
        var front = glMatrix.vec3.create();
        front[0] = Math.cos(glMatrix.glMatrix.toRadian(this.yaw)) * Math.cos(glMatrix.glMatrix.toRadian(this.pitch));
        front[1] = Math.sin(glMatrix.glMatrix.toRadian(this.pitch));
        front[2] = Math.sin(glMatrix.glMatrix.toRadian(this.yaw)) * Math.cos(glMatrix.glMatrix.toRadian(this.pitch));
        glMatrix.vec3.normalize(front, front);
        return PhysicsObject.raycast(this.pos, front, true, new Set(["Zombie"])) == player;
    }
    static update(dt) {
        zombies = zombies.filter((z)=>!z.removed);

        for (var zomb of zombies) {
            zomb.frameNum += 0.03 * dt;
            zomb.vel[1] = 0; zomb.pos[1] = 2.5;

            var dist = glMatrix.vec3.dist(zomb.pos, player.pos);
            if (dist > levelSpecs[currentLevel.levelNum].simulationDistance) {
                continue;
            }

            var bulletPos = glMatrix.vec3.create(); // get the zombie's shooting position
            glMatrix.vec3.add(bulletPos, zomb.pos, zomb.specs.firePos);
            glMatrix.vec3.add(bulletPos, bulletPos, [0, -zomb.dy, 0]); // since firePos is relative to the zombie's feet but zomb.pos is the zombie's center

            // compute yaw and pitch based on the shooting position
            zomb.yaw = Math.atan2((player.pos[2] - zomb.pos[2]), (player.pos[0] - zomb.pos[0])) * 180 / Math.PI;
            var xzdist = Math.sqrt(Math.pow(player.pos[0]-zomb.pos[0], 2) + Math.pow(player.pos[2]-zomb.pos[2], 2));
            zomb.pitch = Math.atan2(player.pos[1] - zomb.pos[1],
                xzdist) * 180 / Math.PI;
            // aigh now we adjust it don't ask why
            // zomb.yaw -= Math.atan2(zomb.specs.firePos[2], dist) * 180 / Math.PI;
            // zomb.pitch -= 16 * Math.pow(0.93, dist);
            
                if (isNaN(zomb.yaw)) {
                // basically, if they are aligned on an axis, it may result in NaN
                zomb.yaw = 0;
            }
            if (zomb.aggroed) {
                // noises
                zomb.aggroNoiseCountdown -= dt;
                if (zomb.aggroNoiseCountdown <= 0) {
                    SFXhandler.newSound("./static/zw4/sfx/angry_" + zomb.type + "_" + Math.floor(Math.random() * zomb.specs.aggroSoundCount+1) + ".mp3", zomb.pos, 1, "SFX", false, false);
                    zomb.aggroNoiseCountdown = 5000;
                }

                // pathfind
                glMatrix.vec3.add(zomb.pos, zomb.pos, glMatrix.vec3.scale([0, 0, 0],
                    zomb.pathfinder.update(dt, zomb.pos, zomb.id), zombieSpecs[zomb.type].speed * dt/1000));
                // fire
                zomb.gun.update(dt, true, zomb.pos);
                var sp = zomb.gun.specs;

                // burst fire
                if (zomb.burstRoundsRemaining > 0 && zomb.gun.canShoot(zomb.pos)) {
                    zomb.burstRoundsRemaining--;
                    // now we rotate bulletPos around the zombie's feet
                    // basically, since the zombie's model was rotated around its feet, we need to rotate bulletPos around the feet too
                    glMatrix.vec3.rotateZ(bulletPos, bulletPos, [zomb.pos[0], zomb.pos[1] - zomb.dy, zomb.pos[2]], glMatrix.glMatrix.toRadian(zomb.pitch));
                    glMatrix.vec3.rotateY(bulletPos, bulletPos, [zomb.pos[0], zomb.pos[1] - zomb.dy, zomb.pos[2]], glMatrix.glMatrix.toRadian(-zomb.yaw));

                    var bul = Bullet.fireBullet(bulletPos, zomb.yaw, zomb.pitch,
                        sp.spread, sp.bulletColor, sp.bulletWidth, sp.bulletLength, sp.bulletSpeed, sp.damage, 5);
                    
                    if (dist < Player.seeMuzzleflashDistance) {
                        Gun.muzzleFlash(bulletPos, 0.75, 3, dist/Player.seeMuzzleflashDistance);
                    }
                    for (var hb of bul.hitboxes) {
                        hb.ignores.add("Zombie"); // so the zombies don't kill themselves by firing
                    }
                }
                zomb.burstCooldown -= dt;
                if (zomb.burstRoundsRemaining <= 0 && zomb.burstCooldown < 0 && zomb.shouldFire()) {
                    zomb.burstRoundsRemaining = sp.zombieBurstRounds[0] + Math.floor(Math.random() * (sp.zombieBurstRounds[1] - sp.zombieBurstRounds[0] + 1));
                    zomb.burstCooldown = Math.random() * 700 + 750;
                }
            }
        }
    }
    takeDamage(amt) {
        this.health -= amt;
        if (this.health <= 0) {
            SFXhandler.newSound("./static/zw4/sfx/death_" + this.type + ".mp3", this.pos, 1, "SFX", true, false);
            this.removed = true;
            player.health += 25;
            player.health = Math.min(player.health, 100);
            for (var p of this.specs.deathParticles) {
                particles.push(new ParticleSystem(this.pos, D_ONE_POINT(), -4, 0.5, p.texCoordStart, p.texCoordWidth, 0.3, 3, 10000, 1));
            }
            GUIeffects.newTextEffect("+25 HP", 150, "white", "black", 25, 1, [oW * 0.5+90, oH * 0.3], [0,0], [0,0]);
            clearInterval(this.aggroSoundsInterval);
            player.zombiesKilled++;
        }
        // damage sound effect
        SFXhandler.newSound("./static/zw4/sfx/hurt_" + this.type + ".mp3", this.pos, 1, "SFX", true, false);

        // hit marker
        GUIeffects.newImageEffect(oTex.hitMarker, oW * 0.1, 1, [oW * 0.5, oH * 0.5], [0, 0], [0, 0]);

        // number thingy
        GUIeffects.newTextEffect(amt, 50, "red", "yellow", 25, 1, [oW * 0.5, oH * 0.5], [400 + 400 * Math.random(), -1000 - 400 * Math.random()], [0, 4000]);
    }
    render() {
        this.anim.frameNum = Math.floor(this.frameNum) % 30 + 1;
        this.anim.bindAttributes();
        // the subtraction on the y axis is nessecary to make it so that the feet are at the bottom of the hitbox
        // instead of in the middle
        this.anim.render([this.pos[0], this.pos[1] - zombieSpecs[this.type].dy, this.pos[2]],
            [this.pitch, this.yaw]
        );
    }
    static renderAll() {
        for (var zomb of zombies) {
            var dist = glMatrix.vec3.dist(zomb.pos, player.pos);
            if (dist > levelSpecs[currentLevel.levelNum].renderDistance) {
                continue;
            }
            zomb.render();
        }
    }
}

function angleBetweenVectors(a, b) {
    // little helper function
    return Math.atan2(a[1] * b[0] - a[0] * b[1], a[0] * b[0] + a[1] * b[1]);
}

class Player extends PhysicsObject {
    static seeMuzzleflashDistance = 20;
    static minimumAltitude = -40;
    static maximumAltitude = 100;
    constructor() {
        super(0, 3, 0, 0.2, 0.85, 0.2, false, false, true);
        this.cameraFront = glMatrix.vec3.fromValues(0, 4, 0);
        this.cameraUp = glMatrix.vec3.fromValues(0, 1, 0);
        this.cameraPos = glMatrix.vec3.fromValues(0, 4, 1);
        this.userInputVelocity = glMatrix.vec3.create(); // velocity from user input, which is reset to 0 each frame and used to add velocity to things like ejected cartridges
        this.yaw = 0; this.pitch = 0;
        this.speed = 3.61;
        this.sprintSpeed = 6; // used to be 6
        this.actualSpeed = this.speed; // speed the player is currently at
        this.jumpPower = 4; // 4 m s^-1 when they leave the ground
        this.materialStandingOn = false;
        this.lastMaterialStandingOn = false;
        this.inv = [new Gun("MP40"), new NothingGun(), new NothingGun(), new NothingGun()];
        this.invIndex = 0;
        this.selected = this.inv[0];
        this.health = 100;
        this.maxHealth = 100;
        
        this.maxGridCenterDeviation = 10;
        this.lastCenter = [-69, -69, -69];
        PathfinderInterface.sendPhysicsObjects();
        PathfinderInterface.genGrid(0.5, 0.7, 3, 4, [this.pos[0], this.pos[1], this.pos[2]]);

        this.footstepsDelay = 500; // ms between each step when walking
        this.currentFootstepsTimer = 0; // timer for footsteps
        this.lastWalking = false;

        this.zombiesKilled = 0;

        this.reachDistance = 6; // distance you can reach to interact with objects
    }
    genPathfindingMesh() {
        PathfinderInterface.sendPhysicsObjects();
        PathfinderInterface.genGrid(0.5, 0.7, 3, 4, [this.pos[0], this.pos[1], this.pos[2]]);
    }
    update(dt) {
        // update selected
        this.selected = this.inv[this.invIndex];

        // calculalte front vector
        var front = glMatrix.vec3.create();
        front[0] = Math.cos(glMatrix.glMatrix.toRadian(this.yaw)) * Math.cos(glMatrix.glMatrix.toRadian(this.pitch));
        front[1] = Math.sin(glMatrix.glMatrix.toRadian(this.pitch));
        front[2] = Math.sin(glMatrix.glMatrix.toRadian(this.yaw)) * Math.cos(glMatrix.glMatrix.toRadian(this.pitch));
        glMatrix.vec3.normalize(this.cameraFront, front);

        // calculate model view matrix
        var target = glMatrix.vec3.create();
        glMatrix.vec3.add(this.cameraPos, this.pos, [0, 0.8, 0]);
        glMatrix.vec3.add(target, this.cameraPos, this.cameraFront);
        modelViewMatrix = glMatrix.mat4.lookAt(modelViewMatrix, this.cameraPos, target, [0, 1, 0]);

        // altitude damage
        if (this.pos[1] < Player.minimumAltitude || this.pos[1] > Player.maximumAltitude) {
            this.health -= 100 * dt/1000;
            if (this.health <= 0) {
                ded("Player fell off the map.");
            }
        }

        // if the player strayed too far from the last grid center, generate a new pathfinding mesh
        if (glMatrix.vec3.dist(this.lastCenter, this.pos) > this.maxGridCenterDeviation) {
            this.genPathfindingMesh();
            this.lastCenter = [this.pos[0], this.pos[1], this.pos[2]];
        }

        // footsteps
        this.currentFootstepsTimer -= dt;
        if ((this.userInputVelocity[0] || this.userInputVelocity[1] || this.userInputVelocity[2]) && this.materialStandingOn) {
            if (!this.lastWalking || this.currentFootstepsTimer <= 0) {
                SFXhandler.newSound("./static/zw4/sfx/footstep_" + this.materialStandingOn + "_" + Math.floor(Math.random() * 3 + 1) + ".mp3", [0,0,0], 1, "SFX", true, false);
                this.currentFootstepsTimer = this.footstepsDelay * this.speed / this.actualSpeed;
            }
            this.lastWalking = true;
        } else {
            this.lastWalking = false;
        }

        // jumping
        if (this.materialStandingOn && !this.lastMaterialStandingOn) {
            SFXhandler.newSound("./static/zw4/sfx/jump_landing.mp3", [0,0,0], 1, "SFX", true, false);
        }
        this.lastMaterialStandingOn = this.materialStandingOn;

        // raycast to see what we hit
        var colliding = PhysicsObject.raycast(this.cameraPos, this.cameraFront, false, new Set(["Player"]));
        if (colliding && glMatrix.vec3.dist(colliding.pos, this.cameraPos) < this.reachDistance) {
            // in range
            if (!colliding.used && colliding.material && colliding.material.startsWith("recorder_")) {
                renderInteractionPrompt("F - Use Recorder");
                if (divisDownKeys["KeyF"]) {
                    colliding.used = true;
                    SFXhandler.newSound("./static/zw4/sfx/" + colliding.material + ".mp3", colliding.pos, 1, "SFX");
                }
            }
        }
    }
    jump() {
        SFXhandler.newSound("./static/zw4/sfx/jump_launch.mp3", [0,0,0], 1, "SFX", true, false);
        this.vel[1] += this.jumpPower;
    }
    takeDamage(dmg, source = null) {
        this.health -= dmg;

        // SFXhandler.newSound("./static/zw4/sfx/player_hurt_" + Math.floor(Math.random() * 3 + 1) + ".mp3", [0,0,0], 1, "SFX", true, false);
        SFXhandler.newSound("./static/zw4/sfx/hurt_player.mp3", [0,0,0], 1, "SFX", true, false);
        if (source?.constructor?.name == "Bullet") {
            GUIeffects.newImageEffect(oTex.damageMarker, oW * 0.3, 1, [oW * 0.5, oH * 0.5], [0,0], [0,0], Math.PI+angleBetweenVectors(
                [source.front[0], source.front[2]],
                [player.cameraFront[0], player.cameraFront[2]]
            ));
            if (this.health <= 0) {
                ded("Player was shot to death.");
            }
        }
    }
    onCollision(obj, normal) {
        if (!obj.trigger && normal == "y" && obj.pos[1] < this.pos[1]) {
            if (divisDownKeys["Space"]) {
                this.jump();
            }
            if (obj.material) {
                this.materialStandingOn = obj.material;
            } else {
                this.materialStandingOn = "concrete";
            }
        }
    }
}

class ParticleEffects {
    static chunkSize = 10;
    static playerLastChunk = [-69, -69];
    static chunkDx = 4; // how many chunks the particles extend past the player
                        // because the particles take time to appear so if they extend past more then it may be better
    constructor(levelNum) {
        this.levelNum = levelNum;
        this.particleSystemArgs = []; // the arguments to pass to the ParticleSystem constructor
        for (var sp of levelSpecs[levelNum].particles) {
            this.particleSystemArgs.push([D_PLANE(ParticleEffects.chunkSize, ParticleEffects.chunkSize), sp.velocity, sp.lifetime, sp.texCoordStart, sp.texCoordWidth, sp.size, sp.intensity, Infinity, 6942000]);
        }
        this.particleSystems = {};
    }
    update() {
        // so basically how this works is the world is split into chunks
        // then particles are rendered in the 3x3 square of chunks surrounding the player
        // like rain in minecraft
        var currentChunk = [Math.floor(player.pos[0] / ParticleEffects.chunkSize), Math.floor(player.pos[2] / ParticleEffects.chunkSize)];
        if (currentChunk[0] != ParticleEffects.playerLastChunk[0] || currentChunk[1] != ParticleEffects.playerLastChunk[1]) {
            ParticleEffects.playerLastChunk = [currentChunk[0], currentChunk[1]];
            for (var prop in this.particleSystems) {
                this.particleSystems[prop].needed = false; // the ones that are not needed are removed
            }
            for (var dx=-ParticleEffects.chunkDx; dx<=ParticleEffects.chunkDx; dx++) {
                for (var dy=-ParticleEffects.chunkDx; dy<=ParticleEffects.chunkDx; dy++) {
                    var neededChunk = [currentChunk[0] + dx, currentChunk[1] + dy];

                    // so first we will see if we have a ParticleSystem for the needed chunk already in the this.particleSystems
                    if (!this.particleSystems[neededChunk]) {
                        this.particleSystems[neededChunk] = new ParticleSystem(
                            [neededChunk[0] * ParticleEffects.chunkSize - ParticleEffects.chunkSize/2, player.pos[1] + 1.3 ,neededChunk[1] * ParticleEffects.chunkSize - ParticleEffects.chunkSize/2],
                            ...this.particleSystemArgs[Math.floor(Math.random() * this.particleSystemArgs.length)]
                        );
                        particles.push(this.particleSystems[neededChunk]);
                        this.particleSystems[neededChunk].needed = true;
                    } else {this.particleSystems[neededChunk].needed = true;}
                }
            }
            for (var prop in this.particleSystems) {
                if (!this.particleSystems[prop].needed) {
                    this.particleSystems[prop].removed = true;
                    delete this.particleSystems[prop];
                }
            }
            updateParticleBuffers();
        }
    }
}

class Level {
    constructor(data, levelNum) {
        this.data = data;
        this.levelNum = levelNum;
    }
    load() {
        // adds all the data to the physicsObjects array, the shader buffers, etc
        bindTexture(this.data.tex, 0);
        shaderAddData({
            aVertexPosition: this.data.position,
            aVertexNormal: this.data.normal,
            aTexCoord: this.data.texCoord
        }, "shaderProgram");
        flush("shaderProgram");
    
        for (var hb of this.data.hitboxes) {
            var po = new PhysicsObject(hb[0][0], hb[0][1], hb[0][2], hb[1][0], hb[1][1], hb[1][2], true, false, true);
            po.material = hb.material;
        }

        for (var tp of this.data.tps) {
            var a = new PhysicsObject(tp[0][0], tp[0][1], tp[0][2], tp[1][0], tp[1][1], tp[1][2], true, true, true);
            particles.push(new ParticleSystem([tp[0][0], tp[0][1], tp[0][2]], D_ONE_POINT(), 0.8, 5, [243/texW, 1536/texH], 39/texW, 0.2, 30, 1000000, 1000000));
            let l = this; // create closure
            a.onCollision = function(o, normal) {
                console.log("collision with tpmat");
                if (o == player) {
                    paused = true;
                    setTimeout(function() { // buy some time for the current frame to finish before we reset everything
                        paused = true;
                        let cnt = 0;
                        // reset everything
                        for (var po of physicsObjects) {
                            if (po == player) continue;
                            po.removed = true;
                        }
                        for (var bul of bullets) {bul.removed = true;}
                        physicsObjects = physicsObjects.filter(p=>!p.removed); items = []; zombies = []; bullets = []; particles = [];
                        IHP.regenerateKinematics();
                        clearAllBuffers();
    
                        // fade stuff
                        let fadeInterval = setInterval(function() {
                            cnt++;
                            SFXhandler.internalMasterVolume *= 0.98;
                            oCtx.globalAlpha = 0.02;
                            oCtx.drawImage(oTex.levelComplete, 0, 0, oW, oH);
                            if (cnt > 300) {
                                console.log("clearing interval and loading level")
                                clearInterval(fadeInterval);
                                SFXhandler.stopAll();
                                SFXhandler.internalMasterVolume = 1;
                                // play recording, etc
                                player.cameraFront = glMatrix.vec3.fromValues(0, 4, 0);
                                player.cameraUp = glMatrix.vec3.fromValues(0, 1, 0);
                                player.cameraPos = glMatrix.vec3.fromValues(0, 4, 1);
                                player.pos = [0,3,0];
                                player.yaw = 0; player.pitch = 0;
                                currentLevel = new Level(models["level"+(l.levelNum+1)], l.levelNum+1);
                                currentLevel.load();

                                setTimeout(function() {
                                    paused = false;
                                    particles.push(new ParticleSystem([0,3,0], D_ONE_POINT(), 0.8, 5, [243/texW, 1536/texH], 39/texW, 0.2, 10, 7500, 4));
                                }, levelSpecs[l.levelNum].waitTime);
                            }
                        }, 10);
                    }, 100);
                }
            }
        }

        for (var zomb of this.data.zombies) {
            new Zombie(zomb.pos[0], zomb.pos[1], zomb.pos[2], zomb.type, new AwajibaPathfinder(), [zomb.dx, zomb.dy, zomb.dz]);
        }

        for (var item of this.data.items) {
            new Item(...item);
        }

        for (var recorder of this.data.recorders) {
            var po = new PhysicsObject(recorder[0][0][0], recorder[0][0][1], recorder[0][0][2], recorder[0][1][0], recorder[0][1][1], recorder[0][1][2], true, false, true);
            po.material = recorder[1];
        }
    
        player.genPathfindingMesh();

        this.particleEffect = new ParticleEffects(1); // hardcode level number for now

        IHP.simulationDistance_kin = levelSpecs[this.levelNum].simulationDistanceR;
        IHP.simulationDistance_notKin = levelSpecs[this.levelNum].simulationDistanceG;

        SFXhandler.newSound(levelSpecs[this.levelNum].ambientSound, [0,0,0], 1, "ambience", true, true);

        GUIeffects.newTextEffect("Level " + (this.levelNum), oH * 0.23, "#ff6100", "#ffd42d", 3, 5, [oW * 0.5 - oH * 0.3, oH * 0.4], [0,0], [0,0], 0);
    }
}
