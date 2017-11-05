/// <reference types="typed-screeps" />
/**
 * To start using Traveler, require it in main.js:
 * Example: var Traveler = require('Traveler.js');
 */
declare global  {
    interface CreepMemory {
        _trav?: TravelData;
    }
    interface RoomMemory {
        avoid?: number;
    }
}
export declare class Traveler {
    private static structureMatrixCache;
    private static creepMatrixCache;
    private static roomTypeCache;
    private static creepMatrixTick;
    private static structureMatrixTick;
    /**
     * move creep to destination
     * @param creep
     * @param destination
     * @param options
     * @returns {number}
     */
    static travelTo(creep: Creep, destination: HasPos | RoomPosition, options?: TravelToOptions): number;
    /**
     * make position objects consistent so that either can be used as an argument
     * @param destination
     * @returns {any}
     */
    static normalizePos(destination: HasPos | RoomPosition): RoomPosition;
    /**
     * check if room should be avoided by findRoute algorithm
     * @param roomName
     * @returns {RoomMemory|number}
     */
    static checkAvoid(roomName: string): number;
    /**
     * check if a position is an exit
     * @param pos
     * @returns {boolean}
     */
    static isExit(pos: Coord | RoomPosition): boolean;
    static isValid(pos: Coord | RoomPosition): boolean;
    /**
     * check two coordinates match
     * @param pos1
     * @param pos2
     * @returns {boolean}
     */
    static sameCoord(pos1: Coord, pos2: Coord): boolean;
    /**
     * check if two positions match
     * @param pos1
     * @param pos2
     * @returns {boolean}
     */
    static samePos(pos1: RoomPosition, pos2: RoomPosition): boolean;
    /**
     * draw a circle at position
     * @param pos
     * @param color
     * @param opacity
     */
    static circle(pos: RoomPosition, color: string, opacity?: number): void;
    /**
     * update memory on whether a room should be avoided based on controller owner
     * @param room
     */
    static updateRoomStatus(room: Room): void;
    /**
     * find a path from origin to destination
     * @param origin
     * @param destination
     * @param options
     * @returns {PathFinderPath}
     */
    static findTravelPath(origin: RoomPosition | HasPos, destination: RoomPosition | HasPos, options?: TravelToOptions): PathFinderPath;
    static findPathDistance(origin: RoomPosition | HasPos, destination: RoomPosition | HasPos, options?: TravelToOptions): number;
    /**
     * find a viable sequence of rooms that can be used to narrow down pathfinder's search algorithm
     * @param origin
     * @param destination
     * @param options
     * @returns {{}}
     */
    static findRoute(origin: string, destination: string, options?: TravelToOptions): {
        [roomName: string]: boolean;
    } | void;
    static findRouteDistance(roomName: string, otherRoomName: string, options?: TravelToOptions): number;
    /**
     * check how many rooms were included in a route returned by findRoute
     * @param origin
     * @param destination
     * @returns {number}
     */
    static routeDistance(origin: string, destination: string): number | void;
    /**
     * build a cost matrix based on structures in the room. Will be cached for more than one tick. Requires vision.
     * @param room
     * @param freshMatrix
     * @returns {any}
     */
    static getStructureMatrix(roomName: string, freshMatrix?: boolean): CostMatrix;
    /**
     * build a cost matrix based on creeps and structures in the room. Will be cached for one tick. Requires vision.
     * @param room
     * @returns {any}
     */
    static getCreepMatrix(room: Room): CostMatrix;
    /**
     * add structures to matrix so that impassible structures can be avoided and roads given a lower cost
     * @param room
     * @param matrix
     * @param roadCost
     * @returns {CostMatrix}
     */
    static addStructuresToMatrix(room: Room, matrix: CostMatrix, roadCost: number): CostMatrix;
    /**
     * add creeps to matrix so that they will be avoided by other creeps
     * @param room
     * @param matrix
     * @returns {CostMatrix}
     */
    static addCreepsToMatrix(room: Room, matrix: CostMatrix): CostMatrix;
    /**
     * serialize a path, traveler style. Returns a string of directions.
     * @param startPos
     * @param path
     * @param color
     * @returns {string}
     */
    static serializePath(startPos: RoomPosition, path: RoomPosition[], color?: string): string;
    /**
     * returns a position at a direction relative to origin
     * @param origin
     * @param direction
     * @returns {RoomPosition}
     */
    static positionAtDirection(origin: RoomPosition, direction: number): RoomPosition;
    static nextDirectionInPath(creep: Creep): number;
    static nextPositionInPath(creep: Creep): RoomPosition;
    private static pushCreep(creep, insist);
    /**
     * convert room avoidance memory from the old pattern to the one currently used
     * @param cleanup
     */
    static patchMemory(cleanup?: boolean): void;
    private static deserializeState(travelData, destination);
    private static serializeState(creep, destination, state, travelData);
    private static isStuck(creep, state);
    /**
     * Return missionRoom coordinates for a given Room, authored by tedivm
     * @param roomName
     * @returns {{x: (string|any), y: (string|any), x_dir: (string|any), y_dir: (string|any)}}
     */
    static getRoomCoordinates(roomName: string): RoomCoord;
    static roomType(roomName: string): number;
}
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
    obstacles?: {
        pos: RoomPosition;
    }[];
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
    route?: {
        [roomName: string]: boolean;
    };
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
export declare type Coord = {
    x: number;
    y: number;
};
export declare type HasPos = {
    pos: RoomPosition;
};
export {};
