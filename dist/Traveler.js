"use strict";
/**
 * To start using Traveler, require it in main.js:
 * Example: var Traveler = require('Traveler.js');
 */
exports.__esModule = true;
var Traveler = /** @class */ (function () {
    function Traveler() {
    }
    /**
     * move creep to destination
     * @param creep
     * @param destination
     * @param options
     * @returns {number}
     */
    Traveler.travelTo = function (creep, destination, options) {
        // uncomment if you would like to register hostile rooms entered
        // this.updateRoomStatus(creep.room);
        if (options === void 0) { options = {}; }
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
            creep.memory._trav = {};
        }
        var travelData = creep.memory._trav;
        if (travelData.delay !== undefined) {
            if (travelData.delay <= 0) {
                delete travelData.delay;
            }
            else {
                travelData.delay--;
                return OK;
            }
        }
        // manage case where creep is nearby destination
        var rangeToDestination = creep.pos.getRangeTo(destination);
        if (options.range && rangeToDestination <= options.range) {
            return OK;
        }
        else if (rangeToDestination <= 1) {
            if (rangeToDestination === 1 && !options.range) {
                var direction = creep.pos.getDirectionTo(destination);
                if (options.returnData) {
                    options.returnData.nextPos = destination;
                    options.returnData.path = direction.toString();
                }
                return creep.move(direction);
            }
            return OK;
        }
        var state = this.deserializeState(travelData, destination);
        // uncomment to visualize destination
        // this.circle(destination.pos, "orange");
        // check if creep is stuck
        var pushedCreep;
        if (this.isStuck(creep, state)) {
            state.stuckCount++;
            Traveler.circle(creep.pos, "magenta", state.stuckCount * .2);
            if (options.pushy) {
                pushedCreep = this.pushCreep(creep, state.stuckCount >= 2);
            }
        }
        else {
            state.stuckCount = 0;
        }
        // handle case where creep is stuck
        if (!options.stuckValue) {
            options.stuckValue = DEFAULT_STUCK_VALUE;
        }
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
            }
            else {
                delete travelData.path;
            }
        }
        if (options.repath && Math.random() < options.repath) {
            // add some chance that you will find a new path randomly
            delete travelData.path;
        }
        // pathfinding
        var newPath = false;
        if (!travelData.path) {
            newPath = true;
            if (creep.spawning) {
                return ERR_BUSY;
            }
            state.destination = destination;
            var cpu = Game.cpu.getUsed();
            var ret = this.findTravelPath(creep.pos, destination, options);
            var cpuUsed = Game.cpu.getUsed() - cpu;
            state.cpu = _.round(cpuUsed + state.cpu);
            if (state.cpu > REPORT_CPU_THRESHOLD) {
                // see note at end of file for more info on this
                console.log("TRAVELER: heavy cpu use: " + creep.name + ", cpu: " + state.cpu + " origin: " + creep.pos + ", dest: " + destination);
            }
            var color = "orange";
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
        var nextDirection = parseInt(travelData.path[0], 10);
        if (options.returnData) {
            if (nextDirection) {
                var nextPos = Traveler.positionAtDirection(creep.pos, nextDirection);
                if (nextPos) {
                    options.returnData.nextPos = nextPos;
                }
            }
            options.returnData.state = state;
            options.returnData.path = travelData.path;
        }
        return creep.move(nextDirection);
    };
    /**
     * make position objects consistent so that either can be used as an argument
     * @param destination
     * @returns {any}
     */
    Traveler.normalizePos = function (destination) {
        if (!(destination instanceof RoomPosition)) {
            return destination.pos;
        }
        return destination;
    };
    /**
     * check if room should be avoided by findRoute algorithm
     * @param roomName
     * @returns {RoomMemory|number}
     */
    Traveler.checkAvoid = function (roomName) {
        return Memory.rooms[roomName] && Memory.rooms[roomName].avoid;
    };
    /**
     * check if a position is an exit
     * @param pos
     * @returns {boolean}
     */
    Traveler.isExit = function (pos) {
        return pos.x === 0 || pos.y === 0 || pos.x === 49 || pos.y === 49;
    };
    Traveler.isValid = function (pos) {
        return pos.x >= 0 && pos.y >= 0 && pos.x <= 49 && pos.y <= 49;
    };
    /**
     * check two coordinates match
     * @param pos1
     * @param pos2
     * @returns {boolean}
     */
    Traveler.sameCoord = function (pos1, pos2) {
        return pos1.x === pos2.x && pos1.y === pos2.y;
    };
    /**
     * check if two positions match
     * @param pos1
     * @param pos2
     * @returns {boolean}
     */
    Traveler.samePos = function (pos1, pos2) {
        return this.sameCoord(pos1, pos2) && pos1.roomName === pos2.roomName;
    };
    /**
     * draw a circle at position
     * @param pos
     * @param color
     * @param opacity
     */
    Traveler.circle = function (pos, color, opacity) {
        new RoomVisual(pos.roomName).circle(pos, {
            radius: .45, fill: "transparent", stroke: color, strokeWidth: .15, opacity: opacity
        });
    };
    /**
     * update memory on whether a room should be avoided based on controller owner
     * @param room
     */
    Traveler.updateRoomStatus = function (room) {
        if (!room) {
            return;
        }
        if (room.controller) {
            if (room.controller.owner && !room.controller.my) {
                room.memory.avoid = 1;
            }
            else {
                delete room.memory.avoid;
            }
        }
    };
    /**
     * find a path from origin to destination
     * @param origin
     * @param destination
     * @param options
     * @returns {PathFinderPath}
     */
    Traveler.findTravelPath = function (origin, destination, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        _.defaults(options, {
            ignoreCreeps: true,
            maxOps: DEFAULT_MAXOPS,
            range: 1
        });
        if (options.movingTarget) {
            options.range = 0;
        }
        origin = this.normalizePos(origin);
        destination = this.normalizePos(destination);
        var originRoomName = origin.roomName;
        var destRoomName = destination.roomName;
        // check to see whether findRoute should be used
        var roomDistance = Game.map.getRoomLinearDistance(origin.roomName, destination.roomName);
        var allowedRooms = options.route;
        if (!allowedRooms && (options.useFindRoute || (options.useFindRoute === undefined && roomDistance > 2))) {
            var route = this.findRoute(origin.roomName, destination.roomName, options);
            if (route) {
                allowedRooms = route;
            }
        }
        var roomsSearched = 0;
        var callback = function (roomName) {
            if (allowedRooms) {
                if (!allowedRooms[roomName]) {
                    return false;
                }
            }
            else if (!options.allowHostile && Traveler.checkAvoid(roomName)
                && roomName !== destRoomName && roomName !== originRoomName) {
                return false;
            }
            roomsSearched++;
            var matrix;
            var room = Game.rooms[roomName];
            if (room) {
                if (options.ignoreStructures) {
                    matrix = new PathFinder.CostMatrix();
                    if (!options.ignoreCreeps) {
                        Traveler.addCreepsToMatrix(room, matrix);
                    }
                }
                else if (options.ignoreCreeps || roomName !== originRoomName) {
                    matrix = _this.getStructureMatrix(roomName, options.freshMatrix);
                }
                else {
                    matrix = _this.getCreepMatrix(room);
                }
                if (options.obstacles) {
                    matrix = matrix.clone();
                    for (var _i = 0, _a = options.obstacles; _i < _a.length; _i++) {
                        var obstacle = _a[_i];
                        if (obstacle.pos.roomName !== roomName) {
                            continue;
                        }
                        matrix.set(obstacle.pos.x, obstacle.pos.y, 0xff);
                    }
                }
            }
            else {
                if (!allowedRooms || !allowedRooms[roomName]) {
                    var roomType = _this.roomType(roomName);
                    if (roomType === ROOMTYPE_SOURCEKEEPER) {
                        return false;
                    }
                }
                if (_this.structureMatrixCache[roomName]) {
                    matrix = _this.structureMatrixCache[roomName];
                }
            }
            if (options.roomCallback) {
                if (!matrix) {
                    matrix = new PathFinder.CostMatrix();
                }
                var outcome = options.roomCallback(roomName, matrix.clone());
                if (outcome !== undefined) {
                    return outcome;
                }
            }
            return matrix;
        };
        var ret = PathFinder.search(origin, { pos: destination, range: options.range }, {
            maxOps: options.maxOps,
            maxRooms: options.maxRooms,
            plainCost: options.offRoad ? 1 : options.ignoreRoads ? 1 : 2,
            swampCost: options.offRoad ? 1 : options.ignoreRoads ? 5 : 10,
            roomCallback: callback
        });
        if (ret.incomplete && options.ensurePath && roomDistance > 0 && options.ignoreCreeps) {
            if (options.useFindRoute === undefined) {
                // handle case where pathfinder failed at a short distance due to not using findRoute
                // can happen for situations where the creep would have to take an uncommonly indirect path
                // options.allowedRooms and options.routeCallback can also be used to handle this situation
                if (roomDistance <= 2) {
                    console.log("TRAVELER: path failed without findroute, trying with options.useFindRoute = true");
                    console.log("from: " + origin + ", destination: " + destination);
                    options.useFindRoute = true;
                    ret = this.findTravelPath(origin, destination, options);
                    console.log("TRAVELER: second attempt was " + (ret.incomplete ? "not " : "") + "successful");
                    return ret;
                }
                // TODO: handle case where a wall or some other obstacle is blocking the exit assumed by findRoute
            }
            else {
            }
        }
        return ret;
    };
    Traveler.findPathDistance = function (origin, destination, options) {
        if (options === void 0) { options = {}; }
        if (options.range === undefined) {
            options.range = 1;
        }
        var ret = this.findTravelPath(origin, destination, options);
        var lastPos = _.last(ret.path);
        if (!lastPos || !lastPos.inRangeTo(destination, options.range)) {
            return -1;
        }
        else {
            return ret.path.length;
        }
    };
    /**
     * find a viable sequence of rooms that can be used to narrow down pathfinder's search algorithm
     * @param origin
     * @param destination
     * @param options
     * @returns {{}}
     */
    Traveler.findRoute = function (origin, destination, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        var restrictDistance = options.restrictDistance || Game.map.getRoomLinearDistance(origin, destination) + 10;
        var allowedRooms = (_a = {}, _a[origin] = true, _a[destination] = true, _a);
        var highwayBias = 1;
        if (options.preferHighway) {
            highwayBias = 2.5;
            if (options.highwayBias) {
                highwayBias = options.highwayBias;
            }
        }
        var ret = Game.map.findRoute(origin, destination, {
            routeCallback: function (roomName) {
                if (options.routeCallback) {
                    var outcome = options.routeCallback(roomName);
                    if (outcome !== undefined) {
                        return outcome;
                    }
                }
                var rangeToRoom = Game.map.getRoomLinearDistance(origin, roomName);
                if (rangeToRoom > restrictDistance) {
                    // room is too far out of the way
                    return Number.POSITIVE_INFINITY;
                }
                if (!options.allowHostile && Traveler.checkAvoid(roomName) &&
                    roomName !== destination && roomName !== origin) {
                    // room is marked as "avoid" in room memory
                    return Number.POSITIVE_INFINITY;
                }
                var roomType = _this.roomType(roomName);
                if (options.preferHighway && roomType === ROOMTYPE_HIGHWAY) {
                    return 1;
                }
                // SK rooms are avoided when there is no vision in the room, harvested-from SK rooms are allowed
                if (!options.allowSK && !Game.rooms[roomName] && roomType === ROOMTYPE_SOURCEKEEPER) {
                    return 10 * highwayBias;
                }
                return highwayBias;
            }
        });
        if (!_.isArray(ret)) {
            console.log("couldn't findRoute to " + destination);
            return;
        }
        for (var _i = 0, ret_1 = ret; _i < ret_1.length; _i++) {
            var value = ret_1[_i];
            allowedRooms[value.room] = true;
        }
        return allowedRooms;
        var _a;
    };
    Traveler.findRouteDistance = function (roomName, otherRoomName, options) {
        var route = this.findRoute(roomName, otherRoomName, options);
        if (!route) {
            return -1;
        }
        return Object.keys(route).length - 1;
    };
    /**
     * check how many rooms were included in a route returned by findRoute
     * @param origin
     * @param destination
     * @returns {number}
     */
    Traveler.routeDistance = function (origin, destination) {
        var linearDistance = Game.map.getRoomLinearDistance(origin, destination);
        if (linearDistance >= 32) {
            return linearDistance;
        }
        var allowedRooms = this.findRoute(origin, destination);
        if (allowedRooms) {
            return Object.keys(allowedRooms).length;
        }
    };
    /**
     * build a cost matrix based on structures in the room. Will be cached for more than one tick. Requires vision.
     * @param room
     * @param freshMatrix
     * @returns {any}
     */
    Traveler.getStructureMatrix = function (roomName, freshMatrix) {
        var room = Game.rooms[roomName];
        if (!room) {
            if (this.structureMatrixCache[roomName]) {
                return this.structureMatrixCache[roomName];
            }
            else {
                return;
            }
        }
        if (!this.structureMatrixCache[room.name] || (freshMatrix && Game.time !== this.structureMatrixTick)) {
            this.structureMatrixTick = Game.time;
            var matrix = new PathFinder.CostMatrix();
            this.structureMatrixCache[room.name] = Traveler.addStructuresToMatrix(room, matrix, 1);
        }
        return this.structureMatrixCache[room.name];
    };
    /**
     * build a cost matrix based on creeps and structures in the room. Will be cached for one tick. Requires vision.
     * @param room
     * @returns {any}
     */
    Traveler.getCreepMatrix = function (room) {
        if (!this.creepMatrixCache[room.name] || Game.time !== this.creepMatrixTick) {
            this.creepMatrixTick = Game.time;
            this.creepMatrixCache[room.name] = Traveler.addCreepsToMatrix(room, this.getStructureMatrix(room.name, true).clone());
        }
        return this.creepMatrixCache[room.name];
    };
    /**
     * add structures to matrix so that impassible structures can be avoided and roads given a lower cost
     * @param room
     * @param matrix
     * @param roadCost
     * @returns {CostMatrix}
     */
    Traveler.addStructuresToMatrix = function (room, matrix, roadCost) {
        var impassibleStructures = [];
        for (var _i = 0, _a = room.find(FIND_STRUCTURES); _i < _a.length; _i++) {
            var structure = _a[_i];
            if (structure instanceof StructureRampart) {
                if (!structure.my && !structure.isPublic) {
                    impassibleStructures.push(structure);
                }
            }
            else if (structure instanceof StructureRoad) {
                matrix.set(structure.pos.x, structure.pos.y, roadCost);
            }
            else if (structure instanceof StructureContainer) {
                matrix.set(structure.pos.x, structure.pos.y, 5);
            }
            else {
                impassibleStructures.push(structure);
            }
        }
        for (var _b = 0, _c = room.find(FIND_MY_CONSTRUCTION_SITES); _b < _c.length; _b++) {
            var site = _c[_b];
            if (site.structureType === STRUCTURE_CONTAINER || site.structureType === STRUCTURE_ROAD
                || site.structureType === STRUCTURE_RAMPART) {
                continue;
            }
            matrix.set(site.pos.x, site.pos.y, 0xff);
        }
        for (var _d = 0, impassibleStructures_1 = impassibleStructures; _d < impassibleStructures_1.length; _d++) {
            var structure = impassibleStructures_1[_d];
            matrix.set(structure.pos.x, structure.pos.y, 0xff);
        }
        return matrix;
    };
    /**
     * add creeps to matrix so that they will be avoided by other creeps
     * @param room
     * @param matrix
     * @returns {CostMatrix}
     */
    Traveler.addCreepsToMatrix = function (room, matrix) {
        room.find(FIND_CREEPS).forEach(function (creep) { return matrix.set(creep.pos.x, creep.pos.y, 0xff); });
        return matrix;
    };
    /**
     * serialize a path, traveler style. Returns a string of directions.
     * @param startPos
     * @param path
     * @param color
     * @returns {string}
     */
    Traveler.serializePath = function (startPos, path, color) {
        if (color === void 0) { color = "orange"; }
        var serializedPath = "";
        var lastPosition = startPos;
        this.circle(startPos, color);
        for (var _i = 0, path_1 = path; _i < path_1.length; _i++) {
            var position = path_1[_i];
            if (position.roomName === lastPosition.roomName) {
                new RoomVisual(position.roomName)
                    .line(position, lastPosition, { color: color, lineStyle: "dashed" });
                serializedPath += lastPosition.getDirectionTo(position);
            }
            lastPosition = position;
        }
        return serializedPath;
    };
    /**
     * returns a position at a direction relative to origin
     * @param origin
     * @param direction
     * @returns {RoomPosition}
     */
    Traveler.positionAtDirection = function (origin, direction) {
        var offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
        var offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
        var x = origin.x + offsetX[direction];
        var y = origin.y + offsetY[direction];
        var position = new RoomPosition(x, y, origin.roomName);
        if (!this.isValid(position)) {
            return;
        }
        return position;
    };
    Traveler.nextDirectionInPath = function (creep) {
        var travelData = creep.memory._trav;
        if (!travelData || !travelData.path || travelData.path.length === 0) {
            return;
        }
        return Number.parseInt(travelData.path[0]);
    };
    Traveler.nextPositionInPath = function (creep) {
        var nextDir = this.nextDirectionInPath(creep);
        if (!nextDir) {
            return;
        }
        return this.positionAtDirection(creep.pos, nextDir);
    };
    Traveler.pushCreep = function (creep, insist) {
        var nextDir = this.nextDirectionInPath(creep);
        if (!nextDir) {
            return false;
        }
        var nextPos = this.positionAtDirection(creep.pos, nextDir);
        if (!nextPos) {
            return;
        }
        var otherCreep = nextPos.lookFor(LOOK_CREEPS)[0];
        if (!otherCreep) {
            return false;
        }
        var otherData = otherCreep.memory._trav;
        if (!insist && otherData && otherData.path && otherData.path.length > 1) {
            return false;
        }
        var pushDirection = otherCreep.pos.getDirectionTo(creep);
        var outcome = otherCreep.move(pushDirection);
        if (outcome !== OK) {
            return false;
        }
        if (otherData && otherData.path) {
            otherData.path = nextDir + otherData.path;
            otherData.delay = 1;
        }
        return true;
    };
    /**
     * convert room avoidance memory from the old pattern to the one currently used
     * @param cleanup
     */
    Traveler.patchMemory = function (cleanup) {
        if (cleanup === void 0) { cleanup = false; }
        if (!Memory.empire) {
            return;
        }
        if (!Memory.empire.hostileRooms) {
            return;
        }
        var count = 0;
        for (var roomName in Memory.empire.hostileRooms) {
            if (Memory.empire.hostileRooms[roomName]) {
                if (!Memory.rooms[roomName]) {
                    Memory.rooms[roomName] = {};
                }
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
        console.log("TRAVELER: room avoidance data patched for " + count + " rooms");
    };
    Traveler.deserializeState = function (travelData, destination) {
        var state = {};
        if (travelData.state) {
            state.lastCoord = { x: travelData.state[STATE_PREV_X], y: travelData.state[STATE_PREV_Y] };
            state.cpu = travelData.state[STATE_CPU];
            state.stuckCount = travelData.state[STATE_STUCK];
            state.destination = new RoomPosition(travelData.state[STATE_DEST_X], travelData.state[STATE_DEST_Y], travelData.state[STATE_DEST_ROOMNAME]);
        }
        else {
            state.cpu = 0;
            state.destination = destination;
        }
        return state;
    };
    Traveler.serializeState = function (creep, destination, state, travelData) {
        travelData.state = [creep.pos.x, creep.pos.y, state.stuckCount, state.cpu, destination.x, destination.y,
            destination.roomName];
    };
    Traveler.isStuck = function (creep, state) {
        var stuck = false;
        if (state.lastCoord !== undefined) {
            if (this.sameCoord(creep.pos, state.lastCoord)) {
                // didn't move
                stuck = true;
            }
            else if (this.isExit(creep.pos) && this.isExit(state.lastCoord)) {
                // moved against exit
                stuck = true;
            }
        }
        return stuck;
    };
    /**
     * Return missionRoom coordinates for a given Room, authored by tedivm
     * @param roomName
     * @returns {{x: (string|any), y: (string|any), x_dir: (string|any), y_dir: (string|any)}}
     */
    Traveler.getRoomCoordinates = function (roomName) {
        var coordinateRegex = /(E|W)(\d+)(N|S)(\d+)/g;
        var match = coordinateRegex.exec(roomName);
        if (!match) {
            return;
        }
        var xDir = match[1];
        var x = match[2];
        var yDir = match[3];
        var y = match[4];
        return {
            x: Number(x),
            y: Number(y),
            xDir: xDir,
            yDir: yDir
        };
    };
    Traveler.roomType = function (roomName) {
        if (!this.roomTypeCache[roomName]) {
            var type = void 0;
            var coords = this.getRoomCoordinates(roomName);
            if (coords.x % 10 === 0 || coords.y % 10 === 0) {
                type = ROOMTYPE_HIGHWAY;
            }
            else if (coords.x % 5 === 0 && coords.y % 5 === 0) {
                type = ROOMTYPE_CORE;
            }
            else if (coords.x % 10 <= 6 && coords.x % 10 >= 4 && coords.y % 10 <= 6 && coords.y % 10 >= 4) {
                type = ROOMTYPE_SOURCEKEEPER;
            }
            else {
                type = ROOMTYPE_CONTROLLER;
            }
            this.roomTypeCache[roomName] = type;
        }
        return this.roomTypeCache[roomName];
    };
    Traveler.structureMatrixCache = {};
    Traveler.creepMatrixCache = {};
    Traveler.roomTypeCache = {};
    return Traveler;
}());
exports.Traveler = Traveler;
// this might be higher than you wish, setting it lower is a great way to diagnose creep behavior issues. When creeps
// need to repath to often or they aren't finding valid paths, it can sometimes point to problems elsewhere in your code
var REPORT_CPU_THRESHOLD = 1000;
var DEFAULT_MAXOPS = 20000;
var DEFAULT_STUCK_VALUE = 2;
var STATE_PREV_X = 0;
var STATE_PREV_Y = 1;
var STATE_STUCK = 2;
var STATE_CPU = 3;
var STATE_DEST_X = 4;
var STATE_DEST_Y = 5;
var STATE_DEST_ROOMNAME = 6;
var ROOMTYPE_CONTROLLER = 0;
var ROOMTYPE_SOURCEKEEPER = 1;
var ROOMTYPE_CORE = 2;
var ROOMTYPE_HIGHWAY = 3;
