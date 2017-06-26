# Traveler

Traveler is a general-purpose tool for moving your creeps around. Feel free to fork and use in other projects.

#### Features:
* Efficient path-caching and CPU-use (you can see how it compares with `creep.moveTo()` [here](https://github.com/bonzaiferroni/bonzAI/wiki/Improving-on-moveTo's-efficiency))
* Ignores creeps in pathing by default which allows for fewer PathFinder calls and [single-lane creep movement](https://github.com/bonzaiferroni/screepswiki/blob/master/gifs/s33-moveTo.gif)
* Can detect hostile rooms and will [path around them once discovered](https://github.com/bonzaiferroni/bonzAI/wiki/Improving-on-moveTo's-efficiency#long-distances-path-length-400). More info on how to enable detection [here](https://github.com/bonzaiferroni/Traveler/wiki/Improving-Traveler:-Important-Changes#hostile-room-avoidance)
* Effective [long-range pathing](https://github.com/bonzaiferroni/bonzAI/wiki/Improving-on-moveTo's-efficiency#very-long-distances-path-length-1200) 
* [Lots of options](https://github.com/bonzaiferroni/Traveler/wiki/Traveler-API)
* [Visuals](https://github.com/bonzaiferroni/Traveler/wiki/Improving-Traveler:-Features#show-your-path)

## Installation

1. Download [Traveler.ts](https://github.com/bonzaiferroni/Traveler/blob/master/Traveler.ts) or [Traveler.js](https://github.com/bonzaiferroni/Traveler/blob/master/Traveler.js) or just copy/paste the code in [Traveler.js](https://raw.githubusercontent.com/bonzaiferroni/Traveler/master/Traveler.js) into a new file using the screeps console.

2. Add a require statement to `main.js`: 
    * `var Traveler = require('Traveler');`
    * (in the sim or some private servers you might need to use `'Traveler.js'`)
3. Replace situations where you used `moveTo` with `travelTo`
```
    // creep.moveTo(myDestination);
    creep.travelTo(myDestination);
```

![Installation animation](http://i.imgur.com/hUu0ozU.gif)

#### Performance considerations
1. `travelTo` creates a new object in creep memory, `_trav`, which is analogous to the object used by `moveTo()` for caching the creeps path. For this reason, it will save memory to use either `travelTo()` or `moveTo()` with a given creep, but not both.
2. As with any algorithm where creeps aren't a consideration for pathing by default, you'll have best results when their path has a low chance of including immobile creeps. My creeps rarely reach the "stuck threshold" because I take extra considerations to keep the roads clear.

## Documentation

The file itself has comments, and you can also find documentation [in the wiki](https://github.com/bonzaiferroni/Traveler/wiki/Traveler-API). I'm also looking for feedback and collaboration to improve Traveler, pull requests welcome!

## Changelog

2017-06-26
* Reorganized type definitions into index.d.ts
* Fixed bug where public ramparts were not seen as pathable
* Fixed bug that caused exceptions due to non-existant Memory.rooms

2017-06-16
* Fixed bug that caused options.preferHighway to not prefer highways

2017-06-05
* Fixed bug in the commented line of code that registered whether creeps were in a hostile room or not.
* New version of Traveler! See what is different [here](https://github.com/bonzaiferroni/Traveler/wiki/Improving-Traveler). The old version can still be found [here](https://github.com/bonzaiferroni/bonzAI/wiki/Traveler-API).

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
