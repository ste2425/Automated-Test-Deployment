//Release Methods
var qs = require('querystring');

module.exports = function(client) {
    return {
        getReleasesByProject: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            if (!options.projectId) {
                callback({
                    ErrorMessage: 'Project id required.'
                }, null);
            } else {
                var url = '/api/projects/' + options.projectId + '/releases/';
                if (options.query) {
                    url += '?' + qs.stringify(options.query);
                }
                client.performRequest(url, callback);
            }
        },
        getReleaseDeployments: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            if (!options.releaseId) {
                callback({
                    ErrorMessage: 'Release id required.'
                }, null);
            } else {
                var url = '/api/releases/' + options.releaseId + '/deployments/';
                if (options.query) {
                    url += '?' + qs.stringify(options.query);
                }
                client.performRequest(url, callback);
            }
        },
        updateReleaseVersion: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            var url = "/api/releases/" + options.releaseId;
            client.performRequest(url, 'PUT', callback, {
                Version: options.version
            })
        },
        updateReleaseVariables: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            var url = "/api/releases/" + options.releaseId + "/snapshot-variables";
            client.performRequest(url, "POST", callback);
        },
        getReleases: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            var url = '/api/releases/';
            if (options.url) {
                url += options.url;
            }
            if (options.query) {
                url += '?' + qs.stringify(options.query);
            }
            client.performRequest(url, callback);
        },
        createRelease: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            var url = "/api/releases";
            client.performRequest(url, 'POST', callback, {
                ProjectId: options.projectId,
                Version: options.version
            });
        },
        deleteRelease: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            var url = "/api/releases/" + options.releaseId;
            client.performRequest(url, 'DELETE', callback);
        }
    }
}