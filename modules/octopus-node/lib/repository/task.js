//Task Methods
var qs = require('querystring');

module.exports = function(client) {
    return {
        getTasks: function(options, callback) {
            var url = '/api/tasks/';
            if (!callback) {
                callback = options;
                options = {};
            }
            if (options.taskId) {
                url += options.taskId;
            }
            if (options.query) {
                url += '?' + qs.stringify(options.query);
            }
            client.performRequest(url, callback);
        },
        getTaskDetails: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }

            if (!options.taskId) {
                callback({
                    ErrorMessage: 'Task id required for this resource'
                }, null);
            } else {
                var url = '/api/tasks/' + options.taskId;
                if (options.raw) {
                    url += '/raw';
                } else {
                    url += '/details';
                }
                client.performRequest(url, callback);
            }
        },
        rerunTask: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }

            if (!options.taskId) {
                callback({
                    ErrorMessage: 'Task id required for this resource'
                }, null);
            } else {
                client.performRequest('/api/tasks/rerun/' + options.taskId, 'POST', callback);
            }
        },
        cancelTask: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }

            if (!options.taskId) {
                callback({
                    ErrorMessage: 'Task id required for this resource'
                }, null);
            } else {
                client.performRequest('/api/tasks/' + options.taskId + '/cancel', 'POST', callback);
            }
        },
        createTask: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            client.performRequest('/api/tasks', 'POST', callback, options.data);
        }
    }
}