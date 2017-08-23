var express = require('express');
var chacha = require("chacha");
var axios = require("axios");
var secrets = require("../secrets.js");
var config = require("../config.js");
var router = express.Router();

var getResults = function () {
    axios.get("https://api.thingspeak.com/channels/" + secrets.thingspeakChannelId + "/feeds.json?api_key=" + secrets.thingspeakReadKey + "&results=" + config.numberOfResults)
        .then(function (response) {
            var json = response.data;
            json.feeds.forEach(function (cipher) {
                console.log(decrypt(Buffer.from(cipher.field1, "base64"), Buffer.from(cipher.field2, "base64"), Buffer.from(cipher.field3, "base64")));
            });
        })
        .catch(function (error) {
            console.log("ERROR!!! " + error);
        });
}

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
    getResults();
    res.send('respond with a resource');
});

module.exports = router;
