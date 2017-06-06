# Traveler

Traveler is a general-purpose tool for moving your creeps around. Feel free to fork and use in other projects.

#### Features:
* Efficient path-caching and CPU-use (you can see how it compares with `creep.moveTo()` [here](https://github.com/bonzaiferroni/bonzAI/wiki/Improving-on-moveTo's-efficiency))
* Ignores creeps in pathing by default which allows for fewer PathFinder calls and [single-lane creep movement](https://github.com/bonzaiferroni/screepswiki/blob/master/gifs/s33-moveTo.gif)
* Can detect hostile rooms and will [path around them once discovered](https://github.com/bonzaiferroni/bonzAI/wiki/Improving-on-moveTo's-efficiency#long-distances-path-length-400). More info on how to enable detection [here](https://github.com/bonzaiferroni/Traveler/wiki/Improving-Traveler:-Important-Changes#hostile-room-avoidance)
* Effective [long-range pathing](https://github.com/bonzaiferroni/bonzAI/wiki/Improving-on-moveTo's-efficiency#very-long-distances-path-length-1200) 
* [Lots of options]()

## Installation

1. Download [Traveler.ts](https://gist.github.com/bonzaiferroni/18de0bf98228c28d1671d5d79627193b) or [Traveler.js](https://gist.github.com/bonzaiferroni/bbbbf8a681f071dc13759da8a1be316e). Semperrabbit has also [forked this gist](https://gist.github.com/semperrabbit/b44afff8f409fdad39c349aa1a7772db) and provided a javascript version with more customization.
2. Add a require statement to `main.js`: 
    * `var Traveler = require('Traveler');` (in the sim or some private servers you might need to use `'Traveler.js'`)
3. Check out suggestions in the footer for implementing the functions (e.g., adding to creep prototype).

#### Performance considerations
1. `travelTo` creates a new object in creep memory, `_travel`, which is analogous to the object used by `moveTo()` for caching the creeps path. For this reason, it will save memory to use either `travelTo()` or `moveTo()` with a given creep, but not both.
2. As with any algorithm where creeps aren't a consideration for pathing by default, you'll have best results when their path has a low chance of including immobile creeps. My creeps rarely reach the "stuck threshold" because I take extra considerations to keep the roads clear. 
3. My own codebase rarely harvests from rooms at more than a distance of 2. For this reason, my couriers rarely use more than 30 CPU for pathing purposes across their lifespan. I've set `REPORT_CPU_THRESHOLD` to 50, because if a creep goes above that, I'll want to know about it. If you are harvesting from further away, you might want to set this threshold to a higher value to get fewer false alarms.


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
