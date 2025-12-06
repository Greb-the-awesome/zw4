// IHP physics engine
// simple and effective
// all 3D physics engines for javascript are jokes
// OIMO.js: joke documentation that was sparse, and half of it was wrong (i.e some functions don't even exist)
//  (had to figure out how it worked by inspecting the demos and hacking them)
// Cannon.js:
// 1. Joke documentation that had at most one sentence to describe functions
//  a. "defined locally in the body frame" wtf does this even mean
//  b. "apply a force": for how long? one frame? forever? does the force get damped?
// 2. Objects move on their own with no force applied
//  a. the player keeps travelling in a circle by itself
//  b. applyImpulse is jittery and sometimes works and sometimes shoots the player off
//  c. 0.02 m s^-2 of gravity shoots the player 4 kilometers in 5 seconds (supersonic speed)
//  d. if damping is set to 0, even if there is no force on the player it will still shoot off at supersonic speed
//
// thus, I will make my own physics engine that is slower and doesn't support complicated features
// but at least it works

var physicsObjects = [];
var lastPOsize = 0;
var physicsCloseTo = new Map();
var physicsCloseTo_kin = new Map();
var SECTORSIZE = 3;

function quickIpow(base, power) {
	// since Math.pow is slow
	// for integers only lmao
	// we should use binary exponentiation but im too dumb
	var res = 1;
	for (var i=0; i<power; i++) {
		res *= base;
	}
	return res;
}

class PhysicsObject {
	static someRandomMod = 1000000007; // for the hash function
	constructor(x, y, z, dx, dy, dz, kin, trigger = false, add = true) {
		// very simple physics engine, assumes AABB with x, y, z are the MIDDLE
		this.pos = [x, y, z];
		this.vel = [0, 0, 0];
		this.ignores = new Set();
		this.collidesWith = new Set();
		this.useAllowList = false; // if false, then we collide with everything except this.ignores, otherwise, we don't collide with anything other than this.collidesWith
		this.trigger = trigger;
		this.dx = dx; this.dy = dy; this.dz = dz;
		this.kinematic = kin;
		this.removed = false;
		this.sleeping = true; // sleeping = not added to the collision map thingy
		if (add) {physicsObjects.push(this);}
	}
	drawBox(c = [1,0,0,1]) {
		var tp = this.pos;
		var p = [
			[tp[0]-this.dx, tp[1]-this.dy, tp[2]-this.dz], // ---
			[tp[0]-this.dx, tp[1]+this.dy, tp[2]-this.dz], // -+-
			[tp[0]+this.dx, tp[1]-this.dy, tp[2]-this.dz], // +--
			[tp[0]+this.dx, tp[1]+this.dy, tp[2]-this.dz], // ++-
			[tp[0]+this.dx, tp[1]-this.dy, tp[2]+this.dz], // +-+
			[tp[0]+this.dx, tp[1]+this.dy, tp[2]+this.dz], // +++
			[tp[0]-this.dx, tp[1]-this.dy, tp[2]+this.dz], // --+
			[tp[0]-this.dx, tp[1]+this.dy, tp[2]+this.dz]  // -++
		];
		IHP.debugLine(p[0], p[1], c); IHP.debugLine(p[2], p[3], c); IHP.debugLine(p[4], p[5], c); IHP.debugLine(p[6], p[7], c);
		IHP.debugLine(p[1], p[3], c); IHP.debugLine(p[3], p[5], c); IHP.debugLine(p[5], p[7], c); IHP.debugLine(p[7], p[1], c);
		IHP.debugLine(p[1-1], p[3-1], c); IHP.debugLine(p[3-1], p[5-1], c); IHP.debugLine(p[5-1], p[7-1], c); IHP.debugLine(p[7-1], p[1-1], c);
	}
	onCollision(o, normal) {}
	getHash() {
		// returns a hash of this physicsobject, dependent on its xyz and dx dy dz
		// was going to be used for making sure checkCollideAABB is not called for each pair more than once
		// but then i figured out better solution
		return this.x + this.y * IHP.maxCoord + this.z * IHP.maxCord * IHP.maxCoord +
			this.dx * quickIpow(IHP.maxCoord, 3) % PhysicsObject.someRandomMod + this.dy * quickIpow(IHP.maxCoord, 4) % PhysicsObject.someRandomMod + this.dz * quickIpow(IHP.maxCoord, 5) % PhysicsObject.someRandomMod;
	}
	static checkCollision(pos1, pos2, w1, w2) { // pos1 and pos2 are the CENTER of the objects
		// doesn't do anything, just checks
		var colliding = 0;
		for (let i=0; i<3; i++) {
			if (Math.abs(pos1[i] - pos2[i]) < (w1[i] + w2[i])) {colliding += 1;}
		}
		return colliding == 3;
	}
	static GlobalGravity = glMatrix.vec3.fromValues(0, -10, 0); // AP physics C land
	static friction = 0.97; // inverse cuz multiply by friction
	static checkCollideAABB(a1, a2, dt) {
		if (!(((a1.useAllowList && a1.collidesWith.has(a2.constructor.name)) || (!a1.useAllowList && !a1.ignores.has(a2.constructor.name))) &&
		((a2.useAllowList && a2.collidesWith.has(a1.constructor.name)) || (!a2.useAllowList && !a2.ignores.has(a1.constructor.name))))) {
			// only if both of them allow themselves to collide with the other one, then collision happens
			return;
		}
		if (a1.kinematic && a2.kinematic) {
			if (PhysicsObject.checkCollision(a1.pos, a2.pos, [a1.dx, a1.dy, a1.dz], [a2.dx, a2.dy, a2.dz])) {
				a1.onCollision(a2, "?");
				a2.onCollision(a1, "?");
				// no normal of collision because two kinematics
				return true;
			}
			return false;
		}
		if (!a1 || !a2) {
			console.log(a1, a2);
		}
		// returns bool and assigns a1 and a2's positions and velocities automatically.
		if (a1.kinematic && !a2.kinematic) {
			[a1, a2] = [a2, a1]; // if one of them is kinematic, it will always be a2.
		}
		var ret = {colliding: false, suggestedPos: [NaN, NaN, NaN]};
		var xdist = Math.abs(a1.pos[0] - a2.pos[0]) - (a1.dx + a2.dx);
		var ydist = Math.abs(a1.pos[1] - a2.pos[1]) - (a1.dy + a2.dy);
		var zdist = Math.abs(a1.pos[2] - a2.pos[2]) - (a1.dz + a2.dz);
		if (
			xdist < 0 && ydist < 0 && zdist < 0
		) {
			ret.colliding = true;
			var normal;
			var m = Math.max(xdist, ydist, zdist);
			if (a1.trigger || a2.trigger) {
				if (m == xdist) {
					a1.onCollision(a2, "x"); a2.onCollision(a1, "x");
				} else if (m == ydist) {
					a1.onCollision(a2, "y"); a2.onCollision(a1, "y");
				} else if (m == zdist) {
					a1.onCollision(a2, "z"); a2.onCollision(a1, "z");
				}
				return true;
			}
			if (a2.kinematic) {
				if (m == xdist) {
					a1.pos[0] += -Math.abs(a1.pos[0] - a2.pos[0]) / (a1.pos[0] - a2.pos[0]) * xdist;
					a1.vel[0] = 0;
					normal = "x";
				}
				else if (m == ydist) {
					a1.pos[1] += -Math.abs(a1.pos[1] - a2.pos[1]) / (a1.pos[1] - a2.pos[1]) * ydist;
					a1.vel[1] = 0;
					normal = "y";
				}
			   else if (m == zdist) {
					a1.pos[2] += -Math.abs(a1.pos[2] - a2.pos[2]) / (a1.pos[2] - a2.pos[2]) * zdist;
					a1.vel[2] = 0;
					normal = "z";
				}
			} else {
				if (m == xdist) {
					a1.pos[0] += -Math.abs(a1.pos[0] - a2.pos[0]) / (a1.pos[0] - a2.pos[0]) * xdist/2;
					a2.pos[0] += Math.abs(a1.pos[0] - a2.pos[0]) / (a1.pos[0] - a2.pos[0]) * xdist/2;
					a1.vel[0] = 0; a2.vel[0] = 0;
					normal = "x";
				}
				else if (m == ydist) {
					a1.pos[1] += -Math.abs(a1.pos[1] - a2.pos[1]) / (a1.pos[1] - a2.pos[1]) * ydist/2;
					a2.pos[1] += Math.abs(a1.pos[1] - a2.pos[1]) / (a1.pos[1] - a2.pos[1]) * ydist/2;
					a1.vel[1] = 0; a2.vel[1] = 0;
					normal = "y";
				}
			   else if (m == zdist) {
					a1.pos[2] += -Math.abs(a1.pos[2] - a2.pos[2]) / (a1.pos[2] - a2.pos[2]) * zdist/2;
					a2.pos[2] += Math.abs(a1.pos[2] - a2.pos[2]) / (a1.pos[2] - a2.pos[2]) * zdist/2;
					a1.vel[2] = 0; a2.vel[2] = 0;
					normal = "z";
				}
			}
			a1.onCollision(a2, normal); a2.onCollision(a1, normal);
			return true;
		}
		return false;
	}
	static lerpRay(origin, direction, x) {
		// computes the intersection point of a ray with the yz plane with x value of `x`
		// if the x is less than origin.x, the x is clamped
		// returns [y, z, clamped|bool] **RETURNS A 2-COMPONENT VECTOR WITHOUT X**
		
		// clamp
		if (direction[0] < 0 && x >= origin[0]) {
			return [origin[1], origin[2], true];
		} else if (direction[0] >= 0 && x <= origin[0]) {
			return [origin[1], origin[2], true];
		}
		var dx = x - origin[0];
		var scaled = glMatrix.vec3.scale([0,0,0], direction, 1/direction[0]);
		return [origin[1] + scaled[1] * dx, origin[2] + scaled[2] * dx, false];
	}
	static lerpLineSegment(pos1, pos2, x) {
		// computes the position of the line segment with endpoints pos1 and pos2 at x
		// but also clamps the x to be in the range of pos1, pos2's x
		// pos1's x must be less than pos2's x
		// returns [pos, clamped|bool];
		var clamped = false;
		if (x < pos1[0]) {x = pos1[0]; clamped = true;}
		if (x > pos2[0]) {x = pos2[0]; clamped = true;}
		return [pos1[1] + (pos2[1] - pos1[1]) * x / (pos2[0] - pos1[0]), clamped];
	}
	static raycast(pos, direction, ignoresTrigger, ignoresSet, name = "PhysicsObject") {
		// ignoresTrigger [bool] = does the raycast count trigger hitboxes
		// ignoresSet [Set] = a set of names to ignore
		// name = basically what name you want the raycast to be, so if an AABB ignorelists "gleb" then if you don't want to collide with that then you pass the name "gleb"
		// false = the path is unobstructed
		// otherwise it will return the closest physicsObject that the raycast collided with
		IHP.lastRaycast = [pos, [pos[0] + direction[0] * 20, pos[1] + direction[1] * 20, pos[2] + direction[2] * 20], false];
		var closestDistance = Infinity;
		var collidingObject = false;
		for (var p of physicsObjects) {
			if ((ignoresTrigger && p.trigger) || ignoresSet.has(p.constructor.name) || (p.useAllowList && !p.collidesWith.has(name)) || (!p.useAllowList && p.ignores.has(name))) {
				continue;
			}
			// do AABB-ray collision detection
			var bounds = [p.pos[0] - p.dx, p.pos[0] + p.dx, p.pos[1] - p.dy, p.pos[1] + p.dy, p.pos[2] - p.dz, p.pos[2] + p.dz];
			// we shall assume for now that the direction vector is nonzero in all its components
			var colliding = false;
			for (var dimension=0; dimension<3; dimension++) {
				for (var side=0; side<2; side++) {
					var map = [dimension, (dimension + 2) % 3, (dimension + 1) % 3];
					var point = PhysicsObject.lerpRay([pos[map[0]], pos[map[1]], pos[map[2]]], [direction[map[0]], direction[map[1]], direction[map[2]]], bounds[dimension * 2 + side]);
					if (point[2]) {
						// clamped means that there is no possibility of collision
						continue;
					}
					var min1 = bounds[((dimension + 2) % 3) * 2], max1 = bounds[((dimension + 2) % 3) * 2 + 1];
					var min2 = bounds[((dimension + 1) % 3) * 2], max2 = bounds[((dimension + 1) % 3) * 2 + 1];
					if (min1 < point[0] && point[0] < max1 && min2 < point[1] && point[1] < max2) {
						colliding = true;
					}
				}
			}
			if (colliding) {
				var dist = glMatrix.vec3.dist(pos, p.pos);
				if (dist < closestDistance) {
					closestDistance = dist;
					collidingObject = p;
				}
			}
		}
		IHP.lastRaycast[2] = !collidingObject;
		return collidingObject;
	}
}

class IHP {
	static alreadyWarned = false;
	static drawLines = false;
	static maxCoord = 500;
	static lastRaycast = [[0,0,0],[0,0,0], false];
	// so here's an interesting problem
	// consider an item on a floor. the floor's center is farther away from the player than the item's center.
	// thus, the item gets simulated before the floor
	// then it falls through the floor and is gone forever :skull:
	// the fix for this is that there has to be two simulation distances, one for the non-kinematics and one for the kinematics
	// additionally if the simulationCenter moves very fast then the kinematics may not be regenerated in time
	// so some collisions may not happen
	static simulationDistance_kin = 50;
	static simulationDistance_notKin = 30;
	static simulationCenter = [0,0,0];

	static init() {
		setInterval(IHP.regenerateKinematics, 1000);
	}

	static regenerateKinematics() {
		physicsCloseTo_kin.clear();
		var i = -1;
		var maxCoord = IHP.maxCoord;
		for (var p of physicsObjects) {
			i++;
			if (!p.kinematic) continue;
			if (glMatrix.vec3.dist(p.pos, IHP.simulationCenter) > IHP.simulationDistance_kin) {
				p.sleeping = true;
				continue;
			} else {
				p.sleeping = false;
			}
			var xmin = p.pos[0] - p.dx, xmax = p.pos[0] + p.dx;
			var ymin = p.pos[1] - p.dy, ymax = p.pos[1] + p.dy;
			var zmin = p.pos[2] - p.dz, zmax = p.pos[2] + p.dz;
			var x1 = xmin - xmin % SECTORSIZE, x2 = xmax - xmax % SECTORSIZE + SECTORSIZE;
			var y1 = ymin - ymin % SECTORSIZE, y2 = ymax - ymax % SECTORSIZE + SECTORSIZE;
			var z1 = zmin - zmin % SECTORSIZE, z2 = zmax - zmax % SECTORSIZE + SECTORSIZE;
			for (var x=x1; x<=x2; x+=SECTORSIZE) {
				for (var y=y1; y<=y2; y+=SECTORSIZE) {
					for (var z=z1; z<=z2; z+=SECTORSIZE) {
						var hsh = x + maxCoord * y + maxCoord * maxCoord * z;
						if (physicsCloseTo_kin.has(hsh)) {
							physicsCloseTo_kin.get(hsh).push(i);
						} else {
							physicsCloseTo_kin.set(hsh, [i]);
						}
					}
				}
			}
		}
	}
	static drawAllBoxes() {
		if (!IHP.drawLines) {return;}
		for (var po of physicsObjects) {
			var col = [1, 1, 1, 1];
			if (po.kinematic) {
				col = [1, 0, 0, 1];
			} else {
				col = [0, 1, 0, 1];
			}
			if (po.sleeping) {
				for (var i=0; i<3; i++) {
					col[i] = (col[i] + 2.5)/3.5; // grey it out if sleeping
				}
			}
			po.drawBox(col);
		}
		IHP.debugLine(IHP.lastRaycast[0], IHP.lastRaycast[1], IHP.lastRaycast[2]?[0,1,1,1]:[1,1,0,1]);
	}
	static physicsUpdate(dt, maxInterval) {
		for (var t=0; t<dt; t+=maxInterval) {
			this.physicsUpdate(Math.min(dt, maxInterval));
		}
	}
	static physicsUpdate(dt) {
		physicsObjects = physicsObjects.filter((p)=>!p.removed);
		if (lastPOsize != physicsObjects.length) {
			IHP.regenerateKinematics();
			lastPOsize = physicsObjects.length;
		}

		var scaledGravity = glMatrix.vec3.create();
		glMatrix.vec3.scale(scaledGravity, PhysicsObject.GlobalGravity, dt/1000);
		for (var po of physicsObjects) {
			if (!po.kinematic && !po.ignoresGravity && !po.sleeping) {
				glMatrix.vec3.add(po.vel, po.vel, scaledGravity);
				po.pos[0] += po.vel[0] * dt/1000; po.pos[1] += po.vel[1] * dt/1000; po.pos[2] += po.vel[2] * dt/1000;
			}
		}

		if (Math.random() < 0.005) {
			// small chance to clear the entire physicsCloseTo
			physicsCloseTo.clear();
		} else {
			// otherwise, just clear the arrays
			physicsCloseTo.forEach(function(value, key) {
				value.length = 0;
			});
		}
		var i = -1;
		var maxCoord = IHP.maxCoord;
		for (var p of physicsObjects) {
			i++;
			if (p.kinematic) continue;
			if (glMatrix.vec3.dist(p.pos, IHP.simulationCenter) > IHP.simulationDistance_notKin) {
				p.sleeping = true;
				continue;
			} else {
				p.sleeping = false;
			}
			var xmin = p.pos[0] - p.dx, xmax = p.pos[0] + p.dx;
			var ymin = p.pos[1] - p.dy, ymax = p.pos[1] + p.dy;
			var zmin = p.pos[2] - p.dz, zmax = p.pos[2] + p.dz;
			var x1 = xmin - xmin % SECTORSIZE, x2 = xmax - xmax % SECTORSIZE + SECTORSIZE;
			var y1 = ymin - ymin % SECTORSIZE, y2 = ymax - ymax % SECTORSIZE + SECTORSIZE;
			var z1 = zmin - zmin % SECTORSIZE, z2 = zmax - zmax % SECTORSIZE + SECTORSIZE;
			for (var x=x1; x<=x2; x+=SECTORSIZE) {
				for (var y=y1; y<=y2; y+=SECTORSIZE) {
					for (var z=z1; z<=z2; z+=SECTORSIZE) {
						var hsh = x + maxCoord * y + maxCoord * maxCoord * z;
						if (physicsCloseTo.has(hsh)) {
							physicsCloseTo.get(hsh).push(i);
						} else {
							physicsCloseTo.set(hsh, [i]);
						}
					}
				}
			}
		}
		var alreadyCollided = [];
		for (var p of physicsObjects) {
			alreadyCollided.push(new Set());
		}
		var idx = 0;
		for (var p of physicsObjects) {
			if (p.kinematic) continue;
			var xmin = p.pos[0] - p.dx, xmax = p.pos[0] + p.dx;
			var ymin = p.pos[1] - p.dy, ymax = p.pos[1] + p.dy;
			var zmin = p.pos[2] - p.dz, zmax = p.pos[2] + p.dz;
			var x1 = xmin - xmin % SECTORSIZE, x2 = xmax - xmax % SECTORSIZE + SECTORSIZE;
			var y1 = ymin - ymin % SECTORSIZE, y2 = ymax - ymax % SECTORSIZE + SECTORSIZE;
			var z1 = zmin - zmin % SECTORSIZE, z2 = zmax - zmax % SECTORSIZE + SECTORSIZE;
			for (var x=x1; x<=x2; x+=SECTORSIZE) {
				for (var y=y1; y<=y2; y+=SECTORSIZE) {
					for (var z=z1; z<=z2; z+=SECTORSIZE) {
						var hsh = x + maxCoord * y + maxCoord * maxCoord * z;
						if (physicsCloseTo.has(hsh)) {
							for (var p1 of physicsCloseTo.get(hsh)) {
								if (physicsObjects[p1] != p && !alreadyCollided[idx].has(p1) && !alreadyCollided[p1].has(idx)) {
									PhysicsObject.checkCollideAABB(p, physicsObjects[p1]);
									alreadyCollided[idx].add(p1);
									alreadyCollided[p1].add(idx);
								}
							}
						}
						if (physicsCloseTo_kin.has(hsh)) {
							for (var p1 of physicsCloseTo_kin.get(hsh)) {
								if (physicsObjects[p1] != p && !alreadyCollided[idx].has(p1) && !alreadyCollided[p1].has(idx)) {
									PhysicsObject.checkCollideAABB(p, physicsObjects[p1]);
									alreadyCollided[idx].add(p1);
									alreadyCollided[p1].add(idx);
								}
							}
						}
					}
				}
			}
			idx++;
		}
	}
	static debugLine(p1, p2, color) {
		// should be overridden by the main script
		if (!IHP.alreadyWarned) {
			console.warn("debug draw hitboxes: no function bound");
			IHP.alreadyWarned = true;
		}
	}
}