var express = require('express');
var chacha = require("chacha");
var axios = require("axios");
var secrets = require("../secrets.js");
var config = require("../config.js");
var router = express.Router();

var decrypt = function (msg, tag, iv) {
    var decipher = chacha.createDecipher(secrets.chachaKey, iv);
    decipher.setAAD(secrets.chachaAuth);  // must be called before data 
    decipher.setAuthTag(tag);   // must be called before data 

    var result = decipher.update(msg, "hex", "utf8");
    try {
        result += decipher.final("utf8");
    } catch (e) {
        result = undefined;
    }
    // we have null terminated string, remove redundant chars
    if (result) {
        result = result.substring(0, result.indexOf("\0"));
    }
    return result;
}

var getRoomTemps = function (results, temps) {
    if (!results[temps.data.channel.name]) {
        results[temps.data.channel.name] = [];
    }
    temps.data.feeds.forEach((cipher) => results[temps.data.channel.name].push(JSON.parse(decrypt(Buffer.from(cipher.field1, "base64"), Buffer.from(cipher.field2, "base64"), Buffer.from(cipher.field3, "base64")))));
    return results;
}

router.get('/', function (req, res, next) {
    let count = req.query.count || config.numberOfResults;
    axios.all(secrets.thingspeak.map((channel) => axios.get("https://api.thingspeak.com/channels/" + channel.channelId + "/feeds.json?api_key=" + channel.readKey + "&results=" + count)))
        .then((resultsArr) => resultsArr.reduce(getRoomTemps, {}))
        .catch((error) => res.status(500).send("!!! ERROR getting: " + error))
        .then((allRoomResults) => res.json(allRoomResults))
        .catch((error) => console.log("!!! ERROR sending: " + error));
});

router.get('/:roomId', function (req, res, next) {
    var roomChannel = secrets.thingspeak.filter((channel) => (channel.roomId === req.params.roomId));
    if (roomChannel.length === 1) {
        let count = req.query.count || config.numberOfResults;
        axios.get("https://api.thingspeak.com/channels/" + roomChannel[0].channelId + "/feeds.json?api_key=" + roomChannel[0].readKey + "&results=" + count)
            .then((response) => getRoomTemps({}, response))
            .catch((error) => res.status(500).send("!!! ERROR getting: " + error))
            .then((roomResults) => res.json(roomResults))
            .catch((error) => console.log("!!! ERROR sending: " + error));
    }
    else {
        res.status(404).send("Room not found: " + req.params.roomId);
    }
});

module.exports = router;
