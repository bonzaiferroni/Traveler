Traveler is a general-purpose tool for moving your creeps around. Feel free to fork and use in other projects.

#### Features:
* Efficient path-caching and CPU-use (you can see how it compares with `creep.moveTo()` [here](https://github.com/bonzaiferroni/bonzAI/wiki/Improving-on-moveTo's-efficiency))
* Ignores creeps in pathing by default which allows for fewer PathFinder calls and [single-lane creep movement](https://github.com/bonzaiferroni/screepswiki/blob/master/gifs/s33-moveTo.gif)
* Detects hostile rooms and will [path around them once discovered](https://github.com/bonzaiferroni/bonzAI/wiki/Improving-on-moveTo's-efficiency#long-distances-path-length-400)
* Effective [long-range pathing](https://github.com/bonzaiferroni/bonzAI/wiki/Improving-on-moveTo's-efficiency#very-long-distances-path-length-1200) 
* [Lots of options]()

# Installation

1. Download [Traveler.ts](https://gist.github.com/bonzaiferroni/18de0bf98228c28d1671d5d79627193b) or [Traveler.js](https://gist.github.com/bonzaiferroni/bbbbf8a681f071dc13759da8a1be316e). Semperrabbit has also [forked this gist](https://gist.github.com/semperrabbit/b44afff8f409fdad39c349aa1a7772db) and provided a javascript version with more customization.
2. Add a require statement to `main.js`: 
 * `var Traveler = require('Traveler');` (in the sim or some private servers you might need to use `'Traveler.js'`)
3. Check out suggestions in the footer for implementing the functions (e.g., adding to creep prototype).

#### Performance considerations
1. `travelTo` creates a new object in creep memory, `_travel`, which is analogous to the object used by `moveTo()` for caching the creeps path. For this reason, it will save memory to use either `travelTo()` or `moveTo()` with a given creep, but not both.
2. As with any algorithm where creeps aren't a consideration for pathing by default, you'll have best results when their path has a low chance of including immobile creeps. My creeps rarely reach the "stuck threshold" because I take extra considerations to keep the roads clear. 
3. My own codebase rarely harvests from rooms at more than a distance of 2. For this reason, my couriers rarely use more than 30 CPU for pathing purposes across their lifespan. I've set `REPORT_CPU_THRESHOLD` to 50, because if a creep goes above that, I'll want to know about it. If you are harvesting from further away, you might want to set this threshold to a higher value to get fewer false alarms.

# API

## `travelTo(creep, goal, options?)`

Move creep to `goal`.

### Arguments
argument | type | description
--- | --- | ---
`creep` | Creep | The creep you want to move.
`goal` | Object | Object with a property `pos: RoomPosition`.
`options` | Object | Optional object with one or more of properties described below

property | type | description
--- | --- | ---
`ignoreRoads` | boolean | Creeps won't prefer roads above plains (will still prefer them to swamps). Default is `false`.
`ignoreCreeps` | boolean | Will not path around other creeps. Default is `true`.
`ignoreStuck` | boolean | Will not path around other creeps even if stuck. Default is `false`.
`ignoreStructures` | boolean | Will not path around structures. Default is `false`.
`preferHighway` | boolean | Creep prefer to travel along highway (empty rooms in between sectors). Default is `false`
`allowHostile` | boolean | Hostile rooms will be included in path. Default is `false`.
`allowSK` | boolean | SourceKeeper rooms will be included in path. (if `false`, SK rooms will still be taken if they are they only viable path). Default is `false`.
`range` | number | Range to `goal` before it is considered reached. The default is 1.
`obstacles` | Object[] | Array of objects with property `{pos: RoomPosition}` that represent positions to avoid.
`roomCallback` | function | Callback function that accepts two arguments, roomName (string) and ignoreCreeps (boolean) and returns a CostMatrix or boolean. Used for overriding the default `PathFinder` callback. If it returns `false`, that room will be excluded. If it returns a matrix, it will be used in place of the default matrix. If it returns undefined the default matrix will be used instead.
`routeCallback` | function | Callback function that accepts one argument, roomName (string) and returns a number representing the foundRoute value that roomName. Used for overriding the `findRoute` callback. If it returns a number that value will be used to influence the route. If it returns undefined it will use the default value.
`returnData` | Object | If an empty object literal is provided, the RoomPosition being moved to will be assigned to `returnData.nextPos`.
`restrictDistance` | number | Limits the range the findRoute will search. Default is 16.
`useFindRoute` | boolean | Can be used to force or prohibit the use of findRoute. If `undefined` it will use findRoute only for paths that span a larger number of rooms (linear distance >2).
`maxOps` | number | Limits the ops (CPU) that PathFinder will use. Default is 20000. (~20 CPU)

# Upcoming changes

* The `roomCallback` option will accept an argument `matrix: CostMatrix` rather than `ignoreCreeps: boolean`. This parameter will provide the matrix that would have been used, which you can add to, discard and use a new one, or return `false` to disqualify that particular room.
* A function for using the same algorithm with a pre-generated path, and a function to pre-generate paths.
* A new property, `movingTarget`, which will check the new position of the destination if it has changed and add to the path rather than generate a whole new path.

# Changelog

2017-03-10
* Fixed a bug where public ramparts were not set as valid positions for pathing in the costmatrix (thanks ricane!)

2017-03-06
* Fixed a bug where pathfinder gets needlessly called when using `options.range` (thanks helam!)

2017-01-17
* Fixed bug in code that determines whether a room is SK from roomname

2017-01-15
* Eliminated option `returnPosition` and added `returnData`
* Fixed bug where preferHighway would not produce the intended results
* Fixed bug where ignoreCreep behavior was reversed and creeps could not get unstuck 
