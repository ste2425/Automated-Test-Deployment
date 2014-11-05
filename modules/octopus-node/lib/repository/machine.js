//Machine methods
var qs = require('querystring');

module.exports = function(client) {
    return {
        getMachines: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            var url = '/api/machines/'
            if (options.url) {
                url += options.url;
            }
            if (options.query) {
                url += '?' + qs.stringify(options.query);
            }
            client.performRequest(url, callback);
        },
        updateMachine: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            if (!options.machineId) {
                callback({
                    ErrorMessage: 'Machine id required.'
                }, null);
            } else {
                //Name, Roles, EnvironmentIds, Thumbprint, Uri required fields
                client.performRequest('/api/machines/' + options.machineId, 'PUT', callback, options.data);
            }
        },
        getMachinesByEnvironment: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            if (!options.environmentId) {
                callback({
                    ErrorMessage: 'Environment id required.'
                }, null);
            } else {
                var url = '/api/environments/' + options.environmentId + '/machines/';
                if (options.query) {
                    url += '?' + qs.stringify(options.query);
                }
                client.performRequest(url, callback);
            }
        },
        createMachine: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            var url = '/api/machines';
            client.performRequest(url, 'POST', callback, options.data);
        },
        deleteMachine: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            if (!options.machineId) {
                callback({
                    ErrorMessage: 'Machine id required.'
                }, null);
            } else {
                var url = '/api/machines/' + options.machineId;
                client.performRequest(url, 'DELETE', callback);
            }
        },
        getMachineConnection: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            if (!options.machineId) {
                callback({
                    ErrorMessage: 'Machine id required.'
                }, null);
            } else {
                var url = '/api/machines/' + options.machineId + '/connection';
                client.performRequest(url, callback);
            }
        },
        getAllRoles: function(callback) {
            var url = '/api/machineroles/all';
            client.performRequest(url, callback);
        }
    }
}