var express = require('express');
var fs = require("fs");
var router = express.Router();

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

var getPreviousDay = function (day) {
    let index = DAYS.indexOf(day);
    if (index === 0) {
        index = DAYS.length - 1;
    } else {
        index--;
    }
    return DAYS[index];
}

var getPlan = function (json, plan) {
    return json[plan];
}

var getDayTemps = function (json, plan, day) {
    let currentPlan = getPlan(json, plan);
    if (currentPlan[day]) {
        return currentPlan[day];
    } else {
        if (currentPlan.parent) {
            return getDayTemps(json, currentPlan.parent, day);
        }
        else {
            return undefined;
        }
    }
}

var getTemp = function (json, plan, day, time) {
    let currentDay = getDayTemps(json, plan, day);
    let timesArray = Object.getOwnPropertyNames(currentDay).sort();
    // we need to find nearest lower or equal time; if there is no lower time for that day, search lower day from the beginning
    let foundIndex = 0;
    while ((timesArray[foundIndex] <= time) && (foundIndex < timesArray.length)) {
        foundIndex++;
    }
    if (foundIndex === 0) {
        return getTemp(json, plan, getPreviousDay(day), "23:59");
    }
    foundIndex--;
    return currentDay[timesArray[foundIndex]];
}

router.get('/:plan?/:day?/:time?', function (req, res, next) {
    new Promise(function (resolve, reject) {
        fs.readFile("./plans.json", function (error, fileContent) {
            if (error) {
                return reject(error);
            }
            return resolve(JSON.parse(fileContent));
        });
    }).then(function (json) {
        let plan = req.params.plan;
        if (plan && !(plan in json)) {
            return res.status(500).send("!!! ERROR: plan '" + plan + "' couldn't be found");
        }

        let day = req.params.day;
        if (day && DAYS.indexOf(day) < 0) {
            return res.status(500).send("!!! ERROR: '" + day + "' is not valid day");
        }

        let time = req.params.time;
        if (time && time.search(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/) !== 0) {
            return res.status(500).send("!!! ERROR: '" + time + "' is not valid time, should be hh:mm");
        }

        if (time) {
            return res.json({ "temperature": getTemp(json, plan, day, time) });
        }

        if (day) {
            return res.json(getDayTemps(json, plan, day));
        }

        if (plan) {
            return res.json(getPlan(json, plan));
        }

        return res.json(json);
    }).catch(function (error) {
        console.log(error);
        res.status(500).send("!!! ERROR: File plans.json couldn't be read.");
    });
});

module.exports = router;
