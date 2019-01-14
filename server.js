"use strict";

const express = require('express');
const {sendImage} = require('./imager/imager');
const PORT = 8080;
const app = express();
let stats = {
    paths: [],
    sizes: [],
    texts: [],
    popularSizes: [],
    referrers: [],
    hits: []
}

app.use(express.static('./public'));

app.use('/', (req, res, next) => { 
    console.log(new Date(), req.method, req.url);
    next(); 
})

//
//ROUTES
//

app.get('/img/:width/:height', (req, res, next) => {
    const width = Number(req.params.width);
    const height = Number(req.params.height);
    const square = req.query.square;
    const text = req.query.text;

    //ERRORS HANDLING
    if(checkValues(width) || checkValues(height)) return res.status(404).send();
    if(width > 2000 || height > 2000) return res.status(403).send();

    if(square !== undefined) {
        if(checkValues(Number(square))) return res.status(400).send(); //return error 400
        sendImage(res, width, height, Number(square), text); 
    }
    else sendImage(res, width, height, undefined, text); 
    
    //CALL FUNCTIONS
    const referrer = req.get('Referrer');
    addPath(req.path, square, text);
    addSize(width, height);
    addText(text);
    addPopularSize(width, height);
    addRefferer(referrer);
    stats.hits.push(Date.now()); 
});

app.get('/stats/paths/recent', (req, res, next) => { 
    res.send(topMostRecent(stats.paths));
});

app.get('/stats/sizes/recent', (req, res, next) => {
    res.send(topMostRecent(stats.sizes));
});

app.get('/stats/texts/recent', (req, res, next) => {
    res.send(topMostRecent(stats.texts));
});

app.get('/stats/sizes/top', (req, res, next) => {
    res.send(topMostRecent(stats.popularSizes));
});

app.get('/stats/referrers/top', (req, res, next) => {
    res.send(topMostRecent(stats.referrers));
});

app.get('/stats/hits', (req, res, next) => {
    let hitArray = [
        { title: '5s',  count: 0  },
        { title: '10s', count: 0  },
        { title: '15s', count: 0 }
    ];
    let timeNow = Date.now();
    for(const hit of stats.hits){
        for(let i = 0; i < hitArray.length; i++){
            if(hit > timeNow - (i+1)*5000){
                hitArray[i].count += 1;
            }
        }
    }
    res.send(hitArray);
});

app.delete('/stats', (req, res, next) => { //set all the list to empty
    stats.paths = [];
    stats.popularSizes = [];
    stats.referrers = [];
    stats.sizes = [];
    stats.texts = [];
    stats.hits = [];

    res.status(200).send();
});

app.listen(PORT, (error) => {
    if(error) return console.error(error);
    console.log(`Listening to port ${PORT}`);
});

//
//FUNCTIONS
//

/**
 * Creates the path to store into the array stats.path, assuring it is not a duplicate
 * @param {string} path 
 * @param {string} square 
 * @param {string} text 
 */
function addPath(path, square, text){
    if(square !== undefined){
        path += '?square=' + square;
        if(text !== undefined) path += '&text=' + encodeURIComponent(text);
    }
    else if(text !== undefined) path += '?text=' + encodeURIComponent(text);
    checkDuplicate(path, stats.paths);
}
/**
 * Creates the JSON to store into the array stats.sizes, assuring there are not duplicates in it.
 * It also stores this value into stats.sizes.
 * @param {Number} width 
 * @param {Number} height 
 */
function addSize(width, height){
    const currentWidthHeight = {'w': width, 'h': height};
    let sizeIndex = findSizesIndex(currentWidthHeight, stats.sizes);

    if(sizeIndex > -1) stats.sizes.splice(sizeIndex, 1);
    stats.sizes.unshift(currentWidthHeight);
}

/**
 * Receives the text value to store into stats.texts, assuring it is not a duplicate nor undefined
 * @param {string} text 
 */
function addText(text){
    if(text !== undefined) checkDuplicate(text, stats.texts);
}

/**
 * Checks if the value is not acceptable. If it is not positive or it is not an integer
 * (so not acceptable) return true. If it is acceptable return false.
 * @param {Number} value 
 */
function checkValues(value){
   const notAcceptable = (value < 1 || !Number.isInteger(value)) ? true : false;
   return notAcceptable;
}

/**
 * This function is made for stats.path and stats.texts. It checks whether the value passed is already
 * found in the relative array. If so, remove the one found in the array and add the new one at the
 * beginning of the array.
 * @param {string} value 
 * @param {Array} array 
 */
function checkDuplicate(value, array){ //passing currentValue and stats.[paths, texts]
    const index = array.indexOf(value);
    if(index > -1) array.splice(index, 1);
    array.unshift(value);
}

/**
 * Returns the first 10 element of the array passed as a parameter
 * @param {Array} array 
 */
function topMostRecent(array){
    return array.slice(0, Math.min(array.length, 10));
}

/**
 * Creates a JSON variable containing the parameters width and height with an extra value n.
 * If the JSON variable already exists, increase the n of it by 1. Otherwise just add it at the
 * beginning of the list.
 * Finally order the list in descending order by n.
 * @param {Number} width 
 * @param {Number} height 
 */
function addPopularSize(width, height){
    const currentWidthHeight = {'w': width, 'h': height, 'n': 1};
    let sizeIndex = findSizesIndex(currentWidthHeight, stats.popularSizes);

    if(sizeIndex > -1) stats.popularSizes[sizeIndex].n += 1; //if found, n+=1
    else stats.popularSizes.unshift(currentWidthHeight); //if not found, create variable with n=1
    
    if(stats.popularSizes.length === 0) return;
    if(stats.popularSizes[0].n === 0) return;
    stats.popularSizes.sort((a,b) => b.n - a.n);
}

/**
 * Check whether the JSON variable already exists in the array passed as a parameter.
 * If it is not found, return -1. Otherwise, return index of the variable found.
 * @param {JSON} currentWidthHeight 
 * @param {Array} array 
 */
function findSizesIndex(currentWidthHeight, array){
    for(let i = 0; i < array.length; i++){
        if(array[i].w === currentWidthHeight.w && array[i].h === currentWidthHeight.h)
            return i;
    }
    return -1;
}

/**
 * Checks whether the refferer exists in stats.referrers. If true, increases its n
 * variable by 1 and sort the array in decreasing order. Otherwise, add the new referrer as a JSON variable
 * at the beginning of the array.
 * @param {String} referrer 
 */
function addRefferer(referrer){
    if(referrer !== undefined){
        for(const currentReferrer of stats.referrers){
            if(currentReferrer.ref === referrer){
                currentReferrer.n += 1;
                stats.referrers.sort((a, b) => b.n - a.n);
                return;
            }
        }
        stats.referrers.unshift({'ref': referrer, 'n': 1}); //if not in the list
    }
}