//Deployment Methods
module.exports = function(client) {
    return {
        performDeploy: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            var url = "/api/deployments";
            var deployOptions = {
                EnvironmentId: options.environmentId,
                ReleaseId: options.releaseId
            };
            if (options.formValues) {
                deployOptions.FormValues = options.formValues;
            }
            client.performRequest(url, 'POST', callback, deployOptions);
        },
        cancelDeploy: function(options, callback) {
            if (!callback) {
                callback = options;
                options = {};
            }
            var url = '/api/tasks/' + options.TaskId + '/cancel';
            client.performRequest(url, 'POST', callback);
        },
        preview: function(options, callback){
            if(!callback){
                callback = options;
                options = {};
            }
            var url = '/api/releases/' + options.releaseId + '/deployments/preview/' + options.environmentId;
            client.performRequest(url, callback);
        }
    }
}