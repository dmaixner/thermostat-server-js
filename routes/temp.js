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

/* GET temp listing. */
router.get('/', function (req, res, next) {
    // getResults();
    axios.all(secrets.thingspeak.map(function (channel) {
        return axios.get("https://api.thingspeak.com/channels/" + channel.channelId + "/feeds.json?api_key=" + channel.readKey + "&results=" + config.numberOfResults);
    })).then(function (resultsArr) {
        var responseStr = resultsArr.reduce(function (prev, curr) {
            prev += "Room: " + curr.data.channel.name + "<br>";
            var tempStr = curr.data.feeds.reduce(function (prevTempStr, cipher) {
                var tempJson = JSON.parse(decrypt(Buffer.from(cipher.field1, "base64"), Buffer.from(cipher.field2, "base64"), Buffer.from(cipher.field3, "base64")));
                var date = new Date(tempJson.time);
                prevTempStr += "Date: " + date.toLocaleString() + "<br> Temperature: " + tempJson.temperature + "<br>";
                return prevTempStr;
            }, "");
            prev += tempStr + "<hr>";
            return prev;
        }, "");
        return responseStr;
    }).catch(function (error) {
        console.log("!!! ERROR getting: " + error);
    }).then(function (response) {
        res.send(response);
    }).catch(function (error) {
        console.log("!!! ERROR sending: " + error);
    });
});

module.exports = router;
