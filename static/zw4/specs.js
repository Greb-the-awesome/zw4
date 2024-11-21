var gunSpecs = {
    "MP40": {
        delay: 100,
        capacity: 30,
        reloadTime: 2000,
        bulletSpeed: 75,
        bulletWidth: 0.04,
        bulletColor: [1, 1, 0.7, 1],
        damage: 10,
        bulletLength: 2,
        barrelLength: 0.8,
        roundsPerReload: 30,
        spread: 3,
        zombieBurstRounds: [3, 7], // range for how many rounds zombies fire in a burst
        cartridge: "cartridge_9x19",
        ejectionDistance: 0.5, // distance from the player of the ejection port
        recoil: {
            recoilDecayFactor: 0.75,
            recoilSideDevation: 0.02,
            linearRecoil: 0.1,
            muzzleRiseRotation: 0.1,
            recoilSideRotation: 0.1
        },
        
    },
    "MAC M10": {
        delay: 50,
        capacity: 32,
        reloadTime: 1800,
        bulletSpeed: 50,
        bulletWidth: 0.04,
        bulletColor: [1, 1, 0.7, 1],
        damage: 10,
        bulletLength: 0.8,
        barrelLength: 0.7,
        roundsPerReload: 32,
        spread: 15,
        zombieBurstRounds: [6, 9],
        cartridge: "cartridge_9x19",
        ejectionDistance: 0.5,
        recoil: {
            recoilDecayFactor: 0.75,
            recoilSideDevation: 0.02,
            linearRecoil: 0.1,
            muzzleRiseRotation: 0.2,
            recoilSideRotation: 0.1
        }
    },
    "PK": {
        delay: 100,
        capacity: 100,
        reloadTime: 5200,
        bulletSpeed: 75,
        bulletWidth: 0.04,
        bulletColor: [0.7, 0.7, 1, 1],
        damage: 13,
        bulletLength: 0.8,
        barrelLength: 0.7,
        roundsPerReload: 100,
        spread: 3.5,
        zombieBurstRounds: [8, 10],
        cartridge: "cartridge_762",
        ejectionDistance: 0.5,
        recoil: {
            recoilDecayFactor: 0.8,
            recoilSideDevation: 0.01,
            linearRecoil: 0.03,
            muzzleRiseRotation: 0.1,
            recoilSideRotation: 0.05
        }
    },
    "Mosin-Nagant": {
        delay: 1500,
        capacity: 5,
        reloadTime: 1100,
        bulletSpeed: 125,
        bulletWidth: 0.04,
        bulletColor: [0.7, 0.7, 1, 1],
        damage: 80,
        bulletLength: 0.8,
        barrelLength: 0.7,
        roundsPerReload: 1,
        spread: 0.5,
        zombieBurstRounds: [1, 1],
        cartridge: "cartridge_762",
        ejectionDistance: 0.5,
        recoil: {
            recoilDecayFactor: 0.97,
            recoilSideDevation: 0.005,
            linearRecoil: 0.02,
            muzzleRiseRotation: 0.1,
            recoilSideRotation: 0.01
        }
    },
    "AK-47": {
        delay: 90,
        capacity: 30,
        reloadTime: 2100,
        bulletSpeed: 75,
        bulletWidth: 0.04,
        bulletColor: [0.7, 0.7, 1, 1],
        damage: 13,
        bulletLength: 0.8,
        barrelLength: 0.7,
        roundsPerReload: 30,
        spread: 2,
        zombieBurstRounds: [3, 7],
        cartridge: "cartridge_762",
        ejectionDistance: 0.5,
        recoil: {
            recoilDecayFactor: 0.8,
            recoilSideDevation: 0.01,
            linearRecoil: 0.03,
            muzzleRiseRotation: 0.1,
            recoilSideRotation: 0.05
        }
    },
    "AN-94": {
        delay: 330,
        capacity: 45,
        reloadTime: 2650,
        bulletSpeed: 100,
        bulletWidth: 0.04,
        bulletColor: [0.7, 0.7, 1, 1],
        damage: 25,
        bulletLength: 0.8,
        barrelLength: 0.7,
        roundsPerReload: 45,
        spread: 1,
        zombieBurstRounds: [2, 6],
        cartridge: "cartridge_762",
        ejectionDistance: 0.35,
        burstFire: true,
        roundsPerBurst: 2,
        burstDelay: 25,
        recoil: {
            recoilDecayFactor: 0.8,
            recoilSideDevation: 0.01,
            linearRecoil: 0.03,
            muzzleRiseRotation: 0.1,
            recoilSideRotation: 0.05
        }
    },
}

var lootTables = {
    // [rarity weight, arguments for Item's constructor(thing, type, add = true)]
    "gun_a": [
        [1, ["AN-94", "gun"]],
        [1, ["Mosin-Nagant", "gun"]]
    ],
    "gun_b": [
        [1, ["PK", "gun"]],
        [1, ["AN-94", "gun"]],
        [2, ["Mosin-Nagant", "gun"]]
    ],
    "gun_c": [
        [3, ["MAC M10", "gun"]],
        [1, ["PK", "gun"]],
        [1, ["AN-94", "gun"]],
        [2, ["Mosin-Nagant", "gun"]]
    ]
};

var zombieSpecs = {
    "Awajiba": {
        speed: 7,
        dx: 0.4, dy: 0.5, dz: 0.4,
        health: 30,
        gun: "MP40",
        firePos: [0, 0.984, -0.1], // [y, z, x] in the blender file for some reason
        deathParticles: [
            {texCoordStart: [256/TEXW, 1536/TEXH], texCoordWidth: 128/TEXW},
            {texCoordStart: [384/TEXW, 1536/TEXH], texCoordWidth: 128/TEXW},
            {texCoordStart: [256/TEXW, 1664/TEXH], texCoordWidth: 128/TEXW},
            {texCoordStart: [384/TEXW, 1664/TEXH], texCoordWidth: 128/TEXW},
        ],
        aggroSoundCount: 4
    }
};



var levelSpecs = [undefined, // fill in 0th element
    {
        particles: [
            {texCoordStart: [784/TEXW, 1536/TEXH], texCoordWidth: 16/TEXW, velocity: -0.25, lifetime: 30, size: 0.06, intensity: 25},
            {texCoordStart: [800/TEXW, 1536/TEXH], texCoordWidth: 16/TEXW, velocity: -0.25, lifetime: 30, size: 0.06, intensity: 25},
            {texCoordStart: [816/TEXW, 1536/TEXH], texCoordWidth: 16/TEXW, velocity: -0.25, lifetime: 30, size: 0.06, intensity: 25},
            {texCoordStart: [832/TEXW, 1536/TEXH], texCoordWidth: 16/TEXW, velocity: -0.25, lifetime: 30, size: 0.06, intensity: 25}
        ],
        lighting: {
            lightDirection: [0, -1, 0],
            color: [0.6, 0.4, 0.4],
            ambient: [0.7, 0.7, 0.65]
        },
        simulationDistance: 30,
        renderDistance: 40,
        physicsSimulationDistanceG: 40,
        physicsSimulationDistanceR: 55,
        fogAmount: 0.75,
        ambientSound: "./static/zw4/sfx/ambience1.mp3",
        texAtlas: "level1.png",
        waitTime: 1000, // time to wait before advancing to the next level
    },
    {
        particles: [
            {texCoordStart: [784/TEXW, 1536/TEXH], texCoordWidth: 16/TEXW, velocity: -0.25, lifetime: 30, size: 0.06, intensity: 25},
            {texCoordStart: [800/TEXW, 1536/TEXH], texCoordWidth: 16/TEXW, velocity: -0.25, lifetime: 30, size: 0.06, intensity: 25},
            {texCoordStart: [816/TEXW, 1536/TEXH], texCoordWidth: 16/TEXW, velocity: -0.25, lifetime: 30, size: 0.06, intensity: 25},
            {texCoordStart: [832/TEXW, 1536/TEXH], texCoordWidth: 16/TEXW, velocity: -0.25, lifetime: 30, size: 0.06, intensity: 25}
        ],
        lighting: {
            lightDirection: [0, -1, 0],
            color: [0.6, 0.4, 0.4],
            ambient: [0.7, 0.7, 0.65]
        },
        simulationDistance: 30,
        renderDistance: 40,
        physicsSimulationDistanceG: 40,
        physicsSimulationDistanceR: 55,
        fogAmount: 0.85,
        ambientSound: "./static/zw4/sfx/ambience1.mp3",
        texAtlas: "level2.png",
        waitTime: 1000
    },
    {
        particles: [
            {texCoordStart: [784/TEXW, 1536/TEXH], texCoordWidth: 16/TEXW, velocity: -0.25, lifetime: 30, size: 0.06, intensity: 25},
            {texCoordStart: [800/TEXW, 1536/TEXH], texCoordWidth: 16/TEXW, velocity: -0.25, lifetime: 30, size: 0.06, intensity: 25},
            {texCoordStart: [816/TEXW, 1536/TEXH], texCoordWidth: 16/TEXW, velocity: -0.25, lifetime: 30, size: 0.06, intensity: 25},
            {texCoordStart: [832/TEXW, 1536/TEXH], texCoordWidth: 16/TEXW, velocity: -0.25, lifetime: 30, size: 0.06, intensity: 25}
        ],
        lighting: {
            lightDirection: [1, 1, 0],
            color: [0.7, 1, 0.8],
            ambient: [0.6, 0.6, 0.55]
        },
        simulationDistance: 30,
        renderDistance: 40,
        physicsSimulationDistanceG: 40,
        physicsSimulationDistanceR: 55,
        fogAmount: 0.3,
        ambientSound: "./static/zw4/songs/calm song.mp3",
        texAtlas: "credits level.png",
        waitTime: 1000
    }
];