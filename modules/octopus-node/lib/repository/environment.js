//Environment Methods
var qs = require('querystring');

module.exports = function(client) {
    return {
        getEnvironments: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            var url = '/api/environments/'
            if (options.url) {
                url += options.url;
            }
            if (options.query) {
                url += '?' + qs.stringify(options.query);
            }
            client.performRequest(url, callback);
        }
    }
}