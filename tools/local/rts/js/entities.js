// Entity base class
let nextId = 0;

class Entity {
    constructor(x, y) {
        this.id = nextId++;
        this.x = x; // tile coords
        this.y = y;
    }
}

class Unit extends Entity {
    constructor(type, side, x, y) {
        super(x, y);
        this.type = type;
        this.side = side;
        this.hp = UNIT_STATS[type].hp;
        this.maxHp = UNIT_STATS[type].hp;
        this.speed = UNIT_STATS[type].speed;
        this.selected = false;

        // Worker-specific fields
        if (type === 'WORKER') {
            this.workerState = WORKER_STATE.IDLE;
            this.cargo = 0;           // ore carried
            this.maxCargo = 20;       // max per trip
            this.gatherTarget = null; // { x, y } of ore field to gather from
        }
    }
}

class Building extends Entity {
    constructor(type, side, x, y) {
        super(x, y);
        this.type = type;
        this.side = side;
        this.hp = BUILDING_STATS[type].hp;
        this.maxHp = BUILDING_STATS[type].hp;
    }
}

// Unit stats (tile-speed per second)
const UNIT_STATS = {
    WORKER:   { hp: 30, speed: 1.5, radius: 4 },
    INFANTRY: { hp: 40, speed: 1.0, radius: 5 },
    TANK:     { hp: 120, speed: 0.6, radius: 7 },
};

// Worker state machine states
const WORKER_STATE = {
    IDLE: 'IDLE',
    GATHERING: 'GATHERING', // walking to ore field
    CARRYING: 'CARRYING',   // walking back to refinery with ore
};

// Building stats
const BUILDING_STATS = {
    REFINERY: { hp: 300 },
    BARRACKS: { hp: 200 },
    FACTORY:  { hp: 400 },
    TURRET:   { hp: 150 },
    WALL:     { hp: 500 },
};