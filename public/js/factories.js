app.factory('serverService', function($rootScope, $http) {
	function handleSuccess(cb) {
		return function(data, status, headers, config) {
			cb(null, {
				data: data,
				status: status,
				headers: headers()
			});
		};
	}

	function handleError(cb) {
		return function(data, status, headers, config) {
			if (status == 0) {
				data = {
					ErrorMessage: 'Connection Lost.'
				}
			}
			var error = {
				data: data,
				status: status,
				headers: headers()
			};
			
			if(status != 0)
				console.error(error);

			cb(error, null);
		};
	}
	return {
		getServerState: function(cb) {
			$http.get('/api/state', {
				params: {
					type: 'all'
				}
			}).
			success(handleSuccess(cb)).
			error(handleError(cb));
		},
		toggleServerState: function(state, cb) {
			$http.post('/api/state/', {
				type: state
			}).
			success(handleSuccess(cb)).
			error(handleError(cb));
		},
		getDeployments: function(cb) {
			$http.get('/api/deployments').
			success(handleSuccess(cb)).
			error(handleError(cb));
		},
		unlockDeployment: function(databaseId, cb) {
			$http.post('/api/unlockdeployment', {
				databaseId: databaseId
			}).
			success(handleSuccess(cb)).
			error(handleError(cb));
		},
		nextDeploy: function(cb) {
			$http.get('/api/nextdeploy').
			success(handleSuccess(cb)).
			error(handleError(cb));
		},
		cleanUpDeployments: function(deploymentId, environmentid, cb) {
			$http.post('/api/cleanupdeploy', {
				deploymentId: deploymentId,
				environmentId: environmentid
			}).
			success(handleSuccess(cb)).
			error(handleError(cb));
		}
	}
});