app.controller('status', function($scope, serverService) {
	$scope.state = {};
	getData();

	$scope.toggleState = function(state) {
		serverService.toggleServerState(state, function(err, res) {
			if (!err) {
				for (var i in res.data) {
					if ($scope.state.hasOwnProperty(i))
						$scope.state[i] = res.data[i];
				}
			}
		});
	};

	function getData() {
		serverService.getServerState(function(err, res) {
			if (!err) {
				$scope.state = res.data;
			}
			setTimeout(getData, 5000);
		});
	}
});

app.controller('orphanedDeployModal', function($scope, $modalInstance, deployment, orphanedDeployments, serverService) {
	$scope.status = {
		helpOpen: true
	};

	$scope.close = function() {
		$modalInstance.close();
	}

	$scope.makeActive = function(index) {
		$scope.orphans.push($scope.deploy);
		$scope.deploy = $scope.orphans[index];
		$scope.orphans.splice(index, 1);
	}

	$scope.restore = function() {
		$scope.deploy = angular.copy(deployment);
		$scope.orphans = angular.copy(orphanedDeployments);
	}

	$scope.cleanUp = function() {
		serverService.cleanUpDeployments($scope.deploy.deploymentId, $scope.deploy.environmentId, function(e, r) {
			$scope.close();
		});
	}

	$scope.restore();
});

app.controller('deployments', function($scope, $modal, serverService) {
	$scope.deployments = [];
	$scope.nextDeployment = {};
	$scope.showOrphans = function(deploy, orphanedDeployments) {
		var modalInstance = $modal.open({
			templateUrl: '/modals/orphanedDeployModal',
			controller: 'orphanedDeployModal',
			size: 'lg',
			resolve: {
				deployment: function() {
					return deploy;
				},
				orphanedDeployments: function() {
					return orphanedDeployments;
				}
			}
		});
	}
	getData();

	$scope.unlock = function(index) {
		serverService.unlockDeployment($scope.deployments[index].deployment._id, function(err, res) {
			if (!err) {
				$scope.deployments.splice(index, 1);
			}
		});
	}

	function getData() {
		getDeployments();
		getNextDeploy();
	}

	function getDeployments() {
		serverService.getDeployments(function(err, res) {
			if (!err) {
				$scope.deployments = res.data;
			}
			setTimeout(getDeployments, 5000);
		});
	}

	function getNextDeploy() {
		serverService.nextDeploy(function(err, res) {
			if (!err) {
				$scope.nextDeployment = res.data;
			}else{
				$scope.nextDeployment = null;
			}
			setTimeout(getNextDeploy, 5000);
		});
	}
});