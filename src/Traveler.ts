/**
 * To start using Traveler, require it in main.js:
 * Example: var Traveler = require('Traveler.js');
 */

declare global {
    interface CreepMemory {
        _trav?: TravelData;
    }

    interface RoomMemory {
        avoid?: number;
    }
}

export class Traveler {

    private static structureMatrixCache: {[roomName: string]: CostMatrix} = {};
    private static creepMatrixCache: {[roomName: string]: CostMatrix} = {};
    private static roomTypeCache: {[roomName: string]: number } = {};
    private static creepMatrixTick: number;
    private static structureMatrixTick: number;

    /**
     * move creep to destination
     * @param creep
     * @param destination
     * @param options
     * @returns {number}
     */

    public static travelTo(creep: Creep, destination: HasPos|RoomPosition, options: TravelToOptions = {}): number {

        // uncomment if you would like to register hostile rooms entered
        // this.updateRoomStatus(creep.room);

        if (!destination) {
            return ERR_INVALID_ARGS;
        }

        if (creep.fatigue > 0) {
            Traveler.circle(creep.pos, "aqua", .3);
            return ERR_TIRED;
        }

        destination = this.normalizePos(destination);

        // initialize data object
        if (!creep.memory._trav) {
            creep.memory._trav = {} as TravelData;
        }
        let travelData = creep.memory._trav as TravelData;

        if (travelData.delay !== undefined) {
            if (travelData.delay <= 0) {
                delete travelData.delay;
            } else {
                travelData.delay--;
                return OK;
            }
        }

        // manage case where creep is nearby destination
        let rangeToDestination = creep.pos.getRangeTo(destination);
        if (options.range && rangeToDestination <= options.range) {
            return OK;
        } else if (rangeToDestination <= 1) {
            if (rangeToDestination === 1 && !options.range) {
                let direction = creep.pos.getDirectionTo(destination);
                if (options.returnData) {
                    options.returnData.nextPos = destination;
                    options.returnData.path = direction.toString();
                }
                return creep.move(direction);
            }
            return OK;
        }

        let state = this.deserializeState(travelData, destination);

        // uncomment to visualize destination
        // this.circle(destination.pos, "orange");

        // check if creep is stuck
        let pushedCreep;
        if (this.isStuck(creep, state)) {
            state.stuckCount++;
            Traveler.circle(creep.pos, "magenta", state.stuckCount * .2);
            if (options.pushy) {
                pushedCreep = this.pushCreep(creep, state.stuckCount >= 2);
            }
        } else {
            state.stuckCount = 0;
        }

        // handle case where creep is stuck
        if (!options.stuckValue) { options.stuckValue = DEFAULT_STUCK_VALUE; }
        if (state.stuckCount >= options.stuckValue && !pushedCreep && Math.random() > .5) {
            options.ignoreCreeps = false;
            options.freshMatrix = true;
            delete travelData.path;
        }

        // TODO:handle case where creep moved by some other function, but destination is still the same

        // delete path cache if destination is different
        if (!this.samePos(state.destination, destination)) {
            if (options.movingTarget && state.destination.isNearTo(destination)) {
                travelData.path += state.destination.getDirectionTo(destination);
                state.destination = destination;
            } else {
                delete travelData.path;
            }
        }

        if (options.repath && Math.random() < options.repath) {
            // add some chance that you will find a new path randomly
            delete travelData.path;
        }

        // pathfinding
        let newPath = false;
        if (!travelData.path) {
            newPath = true;
            if (creep.spawning) { return ERR_BUSY; }

            state.destination = destination;

            let cpu = Game.cpu.getUsed();
            let ret = this.findTravelPath(creep.pos, destination, options);

            let cpuUsed = Game.cpu.getUsed() - cpu;
            state.cpu = _.round(cpuUsed + state.cpu);
            if (state.cpu > REPORT_CPU_THRESHOLD) {
                // see note at end of file for more info on this
                console.log(`TRAVELER: heavy cpu use: ${creep.name}, cpu: ${state.cpu} origin: ${
                    creep.pos}, dest: ${destination}`);
            }

            let color = "orange";
            if (ret.incomplete) {
                // uncommenting this is a great way to diagnose creep behavior issues
                // console.log(`TRAVELER: incomplete path for ${creep.name}`);
                color = "red";
            }

            if (options.returnData) {
                options.returnData.pathfinderReturn = ret;
            }

            travelData.path = Traveler.serializePath(creep.pos, ret.path, color);
            state.stuckCount = 0;
        }

        this.serializeState(creep, destination, state, travelData);

        if (!travelData.path || travelData.path.length === 0) {
            return ERR_NO_PATH;
        }

        // consume path
        if (state.stuckCount === 0 && !newPath) {
            travelData.path = travelData.path.substr(1);
        }

        let nextDirection = parseInt(travelData.path[0], 10);
        if (options.returnData) {
            if (nextDirection) {
                let nextPos = Traveler.positionAtDirection(creep.pos, nextDirection);
                if (nextPos) { options.returnData.nextPos = nextPos; }
            }
            options.returnData.state = state;
            options.returnData.path = travelData.path;
        }
        return creep.move(nextDirection as DirectionConstant);
    }

    /**
     * make position objects consistent so that either can be used as an argument
     * @param destination
     * @returns {any}
     */

    public static normalizePos(destination: HasPos|RoomPosition): RoomPosition {
        if (!(destination instanceof RoomPosition)) {
            return destination.pos;
        }
        return destination;
    }

    /**
     * check if room should be avoided by findRoute algorithm
     * @param roomName
     * @returns {RoomMemory|number}
     */

    public static checkAvoid(roomName: string) {
        return Memory.rooms[roomName] && Memory.rooms[roomName].avoid;
    }

    /**
     * check if a position is an exit
     * @param pos
     * @returns {boolean}
     */

    public static isExit(pos: Coord|RoomPosition): boolean {
        return pos.x === 0 || pos.y === 0 || pos.x === 49 || pos.y === 49;
    }

    public static isValid(pos: Coord|RoomPosition): boolean {
        return pos.x >= 0 && pos.y >= 0 && pos.x <= 49 && pos.y <= 49;
    }

    /**
     * check two coordinates match
     * @param pos1
     * @param pos2
     * @returns {boolean}
     */

    public static sameCoord(pos1: Coord, pos2: Coord): boolean {
        return pos1.x === pos2.x && pos1.y === pos2.y;
    }

    /**
     * check if two positions match
     * @param pos1
     * @param pos2
     * @returns {boolean}
     */

    public static samePos(pos1: RoomPosition, pos2: RoomPosition) {
        return this.sameCoord(pos1, pos2) && pos1.roomName === pos2.roomName;
    }

    /**
     * draw a circle at position
     * @param pos
     * @param color
     * @param opacity
     */

    public static circle(pos: RoomPosition, color: string, opacity?: number) {
        new RoomVisual(pos.roomName).circle(pos, {
            radius: .45, fill: "transparent", stroke: color, strokeWidth: .15, opacity: opacity});
    }

    /**
     * update memory on whether a room should be avoided based on controller owner
     * @param room
     */

    public static updateRoomStatus(room: Room) {
        if (!room) { return; }
        if (room.controller) {
            if (room.controller.owner && !room.controller.my) {
                room.memory.avoid = 1;
            } else {
                delete room.memory.avoid;
            }
        }
    }

    /**
     * find a path from origin to destination
     * @param origin
     * @param destination
     * @param options
     * @returns {PathFinderPath}
     */

    public static findTravelPath(origin: RoomPosition|HasPos, destination: RoomPosition|HasPos,
                                 options: TravelToOptions = {}): PathFinderPath {

        _.defaults(options, {
            ignoreCreeps: true,
            maxOps: DEFAULT_MAXOPS,
            range: 1,
        });

        if (options.movingTarget) {
            options.range = 0;
        }

        origin = this.normalizePos(origin);
        destination = this.normalizePos(destination);
        let originRoomName = origin.roomName;
        let destRoomName = destination.roomName;
        
        // Prevents creeps from stopping in a different room
        let distanceToEdge = _.min([destination.x, 49 - destination.x, destination.y, 49 - destination.y]);
        if (distanceToEdge < options.range!) {
            options.range = distanceToEdge - 1;
        }

        // check to see whether findRoute should be used
        let roomDistance = Game.map.getRoomLinearDistance(origin.roomName, destination.roomName);
        let allowedRooms = options.route;
        if (!allowedRooms && (options.useFindRoute || (options.useFindRoute === undefined && roomDistance > 2))) {
            let route = this.findRoute(origin.roomName, destination.roomName, options);
            if (route) { allowedRooms = route; }
        }

        let roomsSearched = 0;

        let callback = (roomName: string): CostMatrix | boolean => {

            if (allowedRooms) {
                if (!allowedRooms[roomName]) {
                    return false;
                }
            } else if (!options.allowHostile && Traveler.checkAvoid(roomName)
                && roomName !== destRoomName && roomName !== originRoomName) {
                return false;
            }

            roomsSearched++;

            let matrix;
            let room = Game.rooms[roomName];
            if (room) {
                if (options.ignoreStructures) {
                    matrix = new PathFinder.CostMatrix();
                    if (!options.ignoreCreeps) {
                        Traveler.addCreepsToMatrix(room, matrix);
                    }
                } else if (options.ignoreCreeps || roomName !== originRoomName) {
                    matrix = this.getStructureMatrix(roomName, options.freshMatrix);
                } else {
                    matrix = this.getCreepMatrix(room);
                }

                if (options.obstacles) {
                    matrix = matrix.clone();
                    for (let obstacle of options.obstacles) {
                        if (obstacle.pos.roomName !== roomName) { continue; }
                        matrix.set(obstacle.pos.x, obstacle.pos.y, 0xff);
                    }
                }
            } else {
                if (!allowedRooms || !allowedRooms[roomName]) {
                    let roomType = this.roomType(roomName);
                    if (roomType === ROOMTYPE_SOURCEKEEPER) {
                        return false;
                    }
                }
                if (this.structureMatrixCache[roomName]) {
                    matrix = this.structureMatrixCache[roomName];
                }
            }

            if (options.roomCallback) {
                if (!matrix) { matrix = new PathFinder.CostMatrix(); }
                let outcome = options.roomCallback(roomName, matrix.clone());
                if (outcome !== undefined) {
                    return outcome;
                }
            }

            return matrix as CostMatrix;
        };

        let ret = PathFinder.search(origin, {pos: destination, range: options.range!}, {
            maxOps: options.maxOps,
            maxRooms: options.maxRooms,
            plainCost: options.offRoad ? 1 : options.ignoreRoads ? 1 : 2,
            swampCost: options.offRoad ? 1 : options.ignoreRoads ? 5 : 10,
            roomCallback: callback,
        } );

        if (ret.incomplete && options.ensurePath && roomDistance > 0 && options.ignoreCreeps) {

            if (options.useFindRoute === undefined) {

                // handle case where pathfinder failed at a short distance due to not using findRoute
                // can happen for situations where the creep would have to take an uncommonly indirect path
                // options.allowedRooms and options.routeCallback can also be used to handle this situation
                if (roomDistance <= 2) {
                    console.log(`TRAVELER: path failed without findroute, trying with options.useFindRoute = true`);
                    console.log(`from: ${origin}, destination: ${destination}`);
                    options.useFindRoute = true;
                    ret = this.findTravelPath(origin, destination, options);
                    console.log(`TRAVELER: second attempt was ${ret.incomplete ? "not " : ""}successful`);
                    return ret;
                }

                // TODO: handle case where a wall or some other obstacle is blocking the exit assumed by findRoute
            } else {

            }
        }

        return ret;
    }

    public static findPathDistance(origin: RoomPosition|HasPos, destination: RoomPosition|HasPos,
                                   options: TravelToOptions = {}): number {
        if (options.range === undefined) {
            options.range = 1;
        }
        let ret = this.findTravelPath(origin, destination, options);
        let lastPos = _.last(ret.path);
        if (!lastPos || !lastPos.inRangeTo(destination, options.range)) {
            return -1;
        } else {
            return ret.path.length;
        }
    }

    /**
     * find a viable sequence of rooms that can be used to narrow down pathfinder's search algorithm
     * @param origin
     * @param destination
     * @param options
     * @returns {{}}
     */

    public static findRoute(origin: string, destination: string,
                            options: TravelToOptions = {}): {[roomName: string]: boolean } | void {

        let restrictDistance = options.restrictDistance || Game.map.getRoomLinearDistance(origin, destination) + 10;
        let allowedRooms = { [ origin ]: true, [ destination ]: true };

        let highwayBias = 1;
        if (options.preferHighway) {
            highwayBias = 2.5;
            if (options.highwayBias) {
                highwayBias = options.highwayBias;
            }
        }

        let ret = Game.map.findRoute(origin, destination, {
            routeCallback: (roomName: string) => {

                if (options.routeCallback) {
                    let outcome = options.routeCallback(roomName);
                    if (outcome !== undefined) {
                        return outcome;
                    }
                }

                let rangeToRoom = Game.map.getRoomLinearDistance(origin, roomName);
                if (rangeToRoom > restrictDistance) {
                    // room is too far out of the way
                    return Number.POSITIVE_INFINITY;
                }

                if (!options.allowHostile && Traveler.checkAvoid(roomName) &&
                    roomName !== destination && roomName !== origin) {
                    // room is marked as "avoid" in room memory
                    return Number.POSITIVE_INFINITY;
                }

                let roomType = this.roomType(roomName);
                if (options.preferHighway && roomType === ROOMTYPE_HIGHWAY) {
                    return 1;
                }
                // SK rooms are avoided when there is no vision in the room, harvested-from SK rooms are allowed
                if (!options.allowSK && !Game.rooms[roomName] && roomType === ROOMTYPE_SOURCEKEEPER) {
                    return 10 * highwayBias;
                }

                return highwayBias;
            },
        });

        if (!_.isArray(ret)) {
            console.log(`couldn't findRoute to ${destination}`);
            return;
        }
        for (let value of ret) {
            allowedRooms[value.room] = true;
        }

        return allowedRooms;
    }

    public static findRouteDistance(roomName: string, otherRoomName: string, options?: TravelToOptions) {
        let route = this.findRoute(roomName, otherRoomName, options);
        if (!route) { return -1; }
        return Object.keys(route).length - 1;
    }

    /**
     * check how many rooms were included in a route returned by findRoute
     * @param origin
     * @param destination
     * @returns {number}
     */

    public static routeDistance(origin: string, destination: string): number | void {
        let linearDistance = Game.map.getRoomLinearDistance(origin, destination);
        if (linearDistance >= 32) {
            return linearDistance;
        }

        let allowedRooms = this.findRoute(origin, destination);
        if (allowedRooms) {
            return Object.keys(allowedRooms).length;
        }
    }

    /**
     * build a cost matrix based on structures in the room. Will be cached for more than one tick. Requires vision.
     * @param room
     * @param freshMatrix
     * @returns {any}
     */

    public static getStructureMatrix(roomName: string, freshMatrix?: boolean): CostMatrix {
        let room = Game.rooms[roomName];
        if (!room) {
            if (this.structureMatrixCache[roomName]) {
                return this.structureMatrixCache[roomName];
            } else {
                return;
            }
        }

        if (!this.structureMatrixCache[room.name] || (freshMatrix && Game.time !== this.structureMatrixTick)) {
            this.structureMatrixTick = Game.time;
            let matrix = new PathFinder.CostMatrix();
            this.structureMatrixCache[room.name] = Traveler.addStructuresToMatrix(room, matrix, 1);
        }
        return this.structureMatrixCache[room.name];
    }

    /**
     * build a cost matrix based on creeps and structures in the room. Will be cached for one tick. Requires vision.
     * @param room
     * @returns {any}
     */

    public static getCreepMatrix(room: Room) {
        if (!this.creepMatrixCache[room.name] || Game.time !== this.creepMatrixTick) {
            this.creepMatrixTick = Game.time;
            this.creepMatrixCache[room.name] = Traveler.addCreepsToMatrix(room,
                this.getStructureMatrix(room.name, true).clone());
        }
        return this.creepMatrixCache[room.name];
    }

    /**
     * add structures to matrix so that impassible structures can be avoided and roads given a lower cost
     * @param room
     * @param matrix
     * @param roadCost
     * @returns {CostMatrix}
     */

    public static addStructuresToMatrix(room: Room, matrix: CostMatrix, roadCost: number): CostMatrix {

        let impassibleStructures: Structure[] = [];
        for (let structure of room.find<Structure>(FIND_STRUCTURES)) {
            if (structure instanceof StructureRampart) {
                if (!structure.my && !structure.isPublic) {
                    impassibleStructures.push(structure);
                }
            } else if (structure instanceof StructureRoad) {
                matrix.set(structure.pos.x, structure.pos.y, roadCost);
            } else if (structure instanceof StructureContainer) {
                matrix.set(structure.pos.x, structure.pos.y, 5);
            } else {
                impassibleStructures.push(structure);
            }
        }

        for (let site of room.find<ConstructionSite>(FIND_MY_CONSTRUCTION_SITES)) {
            if (site.structureType === STRUCTURE_CONTAINER || site.structureType === STRUCTURE_ROAD
                || site.structureType === STRUCTURE_RAMPART) { continue; }
            matrix.set(site.pos.x, site.pos.y, 0xff);
        }

        for (let structure of impassibleStructures) {
            matrix.set(structure.pos.x, structure.pos.y, 0xff);
        }

        return matrix;
    }

    /**
     * add creeps to matrix so that they will be avoided by other creeps
     * @param room
     * @param matrix
     * @returns {CostMatrix}
     */

    public static addCreepsToMatrix(room: Room, matrix: CostMatrix): CostMatrix {
        room.find<Creep>(FIND_CREEPS).forEach((creep: Creep) => matrix.set(creep.pos.x, creep.pos.y, 0xff) );
        return matrix;
    }

    /**
     * serialize a path, traveler style. Returns a string of directions.
     * @param startPos
     * @param path
     * @param color
     * @returns {string}
     */

    public static serializePath(startPos: RoomPosition, path: RoomPosition[], color = "orange"): string {
        let serializedPath = "";
        let lastPosition = startPos;
        this.circle(startPos, color);
        for (let position of path) {
            if (position.roomName === lastPosition.roomName) {
                new RoomVisual(position.roomName)
                    .line(position, lastPosition, {color: color, lineStyle: "dashed"});
                serializedPath += lastPosition.getDirectionTo(position);
            }
            lastPosition = position;
        }
        return serializedPath;
    }

    /**
     * returns a position at a direction relative to origin
     * @param origin
     * @param direction
     * @returns {RoomPosition}
     */

    public static positionAtDirection(origin: RoomPosition, direction: number): RoomPosition {
        let offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
        let offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
        let x = origin.x + offsetX[direction];
        let y = origin.y + offsetY[direction];
        let position = new RoomPosition(x, y, origin.roomName);
        if (!this.isValid(position)) { return; }
        return position;
    }

    public static nextDirectionInPath(creep: Creep): number {
        let travelData = creep.memory._trav as TravelData;
        if (!travelData || !travelData.path || travelData.path.length === 0) { return; }
        return Number.parseInt(travelData.path[0]);
    }

    public static nextPositionInPath(creep: Creep): RoomPosition {
        let nextDir = this.nextDirectionInPath(creep);
        if (!nextDir) { return; }
        return this.positionAtDirection(creep.pos, nextDir);
    }

    private static pushCreep(creep: Creep, insist: boolean): boolean {
        let nextDir = this.nextDirectionInPath(creep);
        if (!nextDir) { return false; }
        let nextPos = this.positionAtDirection(creep.pos, nextDir);
        if (!nextPos) { return; }
        let otherCreep = nextPos.lookFor<Creep>(LOOK_CREEPS)[0];
        if (!otherCreep) { return false; }

        let otherData = otherCreep.memory._trav as TravelData;
        if (!insist && otherData && otherData.path && otherData.path.length > 1) {
            return false;
        }

        let pushDirection = otherCreep.pos.getDirectionTo(creep);
        let outcome = otherCreep.move(pushDirection);
        if (outcome !== OK) {
            return false;
        }

        if (otherData && otherData.path) {
            otherData.path = nextDir + otherData.path;
            otherData.delay = 1;
        }
        return true;
    }

    /**
     * convert room avoidance memory from the old pattern to the one currently used
     * @param cleanup
     */

    public static patchMemory(cleanup = false) {
        if (!Memory.empire) { return; }
        if (!Memory.empire.hostileRooms) { return; }
        let count = 0;
        for (let roomName in Memory.empire.hostileRooms) {
            if (Memory.empire.hostileRooms[roomName]) {
                if (!Memory.rooms[roomName]) { Memory.rooms[roomName] = {} as any; }
                Memory.rooms[roomName].avoid = 1;
                count++;
            }
            if (cleanup) {
                delete Memory.empire.hostileRooms[roomName];
            }
        }
        if (cleanup) {
            delete Memory.empire.hostileRooms;
        }

        console.log(`TRAVELER: room avoidance data patched for ${count} rooms`);
    }

    private static deserializeState(travelData: TravelData, destination: RoomPosition): TravelState {
        let state = {} as TravelState;
        if (travelData.state) {
            state.lastCoord = {x: travelData.state[STATE_PREV_X], y: travelData.state[STATE_PREV_Y] };
            state.cpu = travelData.state[STATE_CPU];
            state.stuckCount = travelData.state[STATE_STUCK];
            state.destination = new RoomPosition(travelData.state[STATE_DEST_X], travelData.state[STATE_DEST_Y],
                travelData.state[STATE_DEST_ROOMNAME]);
        } else {
            state.cpu = 0;
            state.destination = destination;
        }
        return state;
    }

    private static serializeState(creep: Creep, destination: RoomPosition, state: TravelState, travelData: TravelData) {
        travelData.state = [creep.pos.x, creep.pos.y, state.stuckCount, state.cpu, destination.x, destination.y,
            destination.roomName];
    }

    private static isStuck(creep: Creep, state: TravelState): boolean {
        let stuck = false;
        if (state.lastCoord !== undefined) {
            if (this.sameCoord(creep.pos, state.lastCoord)) {
                // didn't move
                stuck = true;
            } else if (this.isExit(creep.pos) && this.isExit(state.lastCoord)) {
                // moved against exit
                stuck = true;
            }
        }

        return stuck;
    }

    /**
     * Return missionRoom coordinates for a given Room, authored by tedivm
     * @param roomName
     * @returns {{x: (string|any), y: (string|any), x_dir: (string|any), y_dir: (string|any)}}
     */

    public static getRoomCoordinates(roomName: string): RoomCoord {

        let coordinateRegex = /(E|W)(\d+)(N|S)(\d+)/g;
        let match = coordinateRegex.exec(roomName);
        if (!match) { return; }

        let xDir = match[1];
        let x = match[2];
        let yDir = match[3];
        let y = match[4];

        return {
            x: Number(x),
            y: Number(y),
            xDir: xDir,
            yDir: yDir,
        };
    }

    public static roomType(roomName: string): number {
        if (!this.roomTypeCache[roomName]) {
            let type: number;
            let coords = this.getRoomCoordinates(roomName);
            if (coords.x % 10 === 0 || coords.y % 10 === 0) {
                type = ROOMTYPE_HIGHWAY;
            } else if (coords.x % 5 === 0 && coords.y % 5 === 0) {
                type = ROOMTYPE_CORE;
            } else if (coords.x % 10 <= 6 && coords.x % 10 >= 4 && coords.y % 10 <= 6 && coords.y % 10 >= 4) {
                type = ROOMTYPE_SOURCEKEEPER;
            } else {
                type = ROOMTYPE_CONTROLLER;
            }
            this.roomTypeCache[roomName] = type;
        }
        return this.roomTypeCache[roomName];
    }
}

// this might be higher than you wish, setting it lower is a great way to diagnose creep behavior issues. When creeps
// need to repath to often or they aren't finding valid paths, it can sometimes point to problems elsewhere in your code
const REPORT_CPU_THRESHOLD = 1000;
const DEFAULT_MAXOPS = 20000;
const DEFAULT_STUCK_VALUE = 2;
const STATE_PREV_X = 0;
const STATE_PREV_Y = 1;
const STATE_STUCK = 2;
const STATE_CPU = 3;
const STATE_DEST_X = 4;
const STATE_DEST_Y = 5;
const STATE_DEST_ROOMNAME = 6;
const ROOMTYPE_CONTROLLER = 0;
const ROOMTYPE_SOURCEKEEPER = 1;
const ROOMTYPE_CORE = 2;
const ROOMTYPE_HIGHWAY = 3;

// assigns a function to Creep.prototype: creep.travelTo(destination)
// Creep.prototype.travelTo = function(destination: RoomPosition|{pos: RoomPosition}, options?: TravelToOptions) {
//     return Traveler.travelTo(this, destination, options);
// };

export interface TravelToReturnData {
    nextPos?: RoomPosition;
    pathfinderReturn?: PathFinderPath;
    state?: TravelState;
    path?: string;
}

export interface TravelToOptions {
    ignoreRoads?: boolean;
    ignoreCreeps?: boolean;
    ignoreStructures?: boolean;
    preferHighway?: boolean;
    highwayBias?: number;
    allowHostile?: boolean;
    allowSK?: boolean;
    range?: number;
    obstacles?: {pos: RoomPosition}[];
    roomCallback?: (roomName: string, matrix: CostMatrix) => CostMatrix | boolean;
    routeCallback?: (roomName: string) => number;
    returnData?: TravelToReturnData;
    restrictDistance?: number;
    useFindRoute?: boolean;
    maxOps?: number;
    movingTarget?: boolean;
    freshMatrix?: boolean;
    offRoad?: boolean;
    stuckValue?: number;
    maxRooms?: number;
    repath?: number;
    route?: {[roomName: string]: boolean};
    ensurePath?: boolean;
    pushy?: boolean;
}

export interface TravelData {
    state: any[];
    path: string;
    delay: number;
}

export interface TravelState {
    stuckCount: number;
    lastCoord: Coord;
    destination: RoomPosition;
    cpu: number;
}

export interface RoomCoord {
    x: number;
    y: number;
    xDir: string;
    yDir: string;
}

export type Coord = {x: number, y: number};
export type HasPos = {pos: RoomPosition}
