//Build Client Object
var http = require('http');

exports.createClient = function(host, apiKey) {
    var _apiKey = apiKey;
    var client = {
        host: host,
        setHost: function(host) {
            client.host = host;
        },
        setApiKey: function(apiKey) {
            _apiKey = apiKey;
        },
        performRequest: function(url, method, callback, data) {
            if (typeof method === "function") {
                callback = method;
                method = 'GET';
            }
            OctoComs(client.host, _apiKey, url, method, callback, data);
        }
    }
    return client;
}

function OctoComs(host, key, url, method, callback, bodyData) {
    var options = {
        host: host,
        path: url,
        method: method,
        headers: {
            'X-Octopus-ApiKey': key,
            'Content-Type': 'application/json',
            'Accepts': 'application/json'
        }
    }
    var req = http.request(options, function(response) {
        var data = "";
        response.on("data", function(chunk) {
            data += chunk;
        });
        response.on("end", function() {
            if (response.statusCode == 200 || response.statusCode == 201) {
                var obj = JSON.parse(data);
                if (obj.ErrorMessage) {
                    callback(obj, null);
                } else {
                    callback(null, obj);
                }
            } else {
                callback(data, null);
            }
        });

    })
    req.on('error', function(e) {
        callback(e, null);
    });
    if (bodyData) {
        req.write(JSON.stringify(bodyData));
    }
    req.end();
}