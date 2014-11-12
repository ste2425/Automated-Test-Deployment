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
			$http.get('/state/all').
			success(handleSuccess(cb)).
			error(handleError(cb));
		},
		toggleServerState: function(state, cb) {
			$http.post('/toggle/' + state).
			success(handleSuccess(cb)).
			error(handleError(cb));
		},
		getDeployments: function(cb) {
			$http.get('/deployments').
			success(handleSuccess(cb)).
			error(handleError(cb));
		},
		unlockDeployment: function(databaseId, cb) {
			$http.post('/unlockdeployment', {
				databaseId: databaseId
			}).
			success(handleSuccess(cb)).
			error(handleError(cb));
		},
		nextDeploy: function(cb) {
			$http.get('/nextdeploy').
			success(handleSuccess(cb)).
			error(handleError(cb));
		},
		cleanUpDeployments: function(deploymentId, environmentid, cb) {
			$http.post('/cleanupdeploy', {
				deploymentId: deploymentId,
				environmentId: environmentid
			}).
			success(handleSuccess(cb)).
			error(handleError(cb));
		}
	}
});