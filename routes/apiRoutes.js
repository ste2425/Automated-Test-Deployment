var router = require('express').Router(),
	request = require('request'),
	atCollection = require(__ROOT + '/modules/data-access').get(),
	helper = require(__ROOT + '/helpers.js');

router.get('/nextdeploy', function(req, res) {
	var r = request.get('https://coral-reef.azurewebsites.net/deployment/queue/peek')
	r.pipe(res);
	r.on('error', function(e) {
		res.status(500).send({
			ErrorMessage: e
		});
	});
});

router.get('/state/', function(req, res) {
	switch (req.query.type) {
		case 'deployment':
			res.send({
				deployment: checkForDeployments
			});
			break;
		case 'unlock':
			res.send({
				unlock: checkForDeploymentsUnlock
			});
			break;
		case 'shutdown':
			res.send({
				shutdown: checkMachinesToShutdown
			});
			break;
		case 'activedeployment':
			res.send({
				activedeployment: checkActiveDeploymentState
			});
			break;
		case 'all':
			res.send({
				deployment: checkForDeployments,
				unlock: checkForDeploymentsUnlock,
				shutdown: checkMachinesToShutdown,
				activedeployment: checkActiveDeploymentState
			});
			break;
		default:
			res.status(500).send({
				ErrorMessage: 'Type not found.',
				Additional: 'Type Sent, ' + req.params.type + '. Accepted: deployment, unlock, shutdown, activedeployment, all'
			});
			break;
	}
});

router.post('/state/', function(req, res) {
	switch (req.body.type) {
		case 'deployment':
			checkForDeployments = !checkForDeployments;
			res.send({
				deployment: checkForDeployments
			});
			break;
		case 'unlock':
			checkForDeploymentsUnlock = !checkForDeploymentsUnlock;
			res.send({
				unlock: checkForDeploymentsUnlock
			});
			break;
		case 'shutdown':
			checkMachinesToShutdown = !checkMachinesToShutdown;
			res.send({
				shutdown: checkMachinesToShutdown
			});
			break;
		case 'activedeployment':
			checkActiveDeploymentState = !checkActiveDeploymentState;
			res.send({
				activedeployment: checkActiveDeploymentState
			});
			break;
		default:
			res.status(500).send({
				ErrorMessage: 'Type not found.',
				Additional: 'Type Sent, ' + req.params.type + '. Accepted: deployment, unlock, shutdown, activedeployment'
			});
			break;
	}
});

router.post('/cleanupdeploy', function(req, res) {
	if (!req.body.deploymentId || !req.body.environmentId) {
		return res.status(500).send({
			ErrorMessage: 'requires deployment id and environment id'
		});
	}
	var query = {
		$and: [{
			"deploymentId": {
				$ne: req.body.deploymentId
			}
		}, {
			"environmentId": req.body.environmentId
		}]
	};
	console.log(require('util').inspect(query, {
		depth: null
	}))
	atCollection.remove(query, function(e, r) {

		res.status(e ? 500 : 200).send(e || {
			Removed: r
		});
	})
});

router.get('/deployments', function(req, res) {
    atCollection.find({}, function(e, r) {
        if (e || r.length == 0) {
            return res.status(e ? 500 : 200).send(e || r);
        };

        var deployments = {};
        var d = [];

        r.forEach(function(item) {
            if (!(deployments[item.environmentId] instanceof Array))
                deployments[item.environmentId] = [];

            deployments[item.environmentId].push(item);
        });

        for (var i in deployments) {
            deployments[i].sort(function(a, b) {
                return b.deployStarted - a.deployStarted;
            });

            d.push({
                deployment: deployments[i][0],
                orphanedDeployments: deployments[i].slice(1, deployments.length)
            });
        }

        res.status(e ? 500 : 200).send(e || d);
    });
});

router.post('/unlockdeployment', function(req, res) {
    if (!req.body.deploymentId && !req.body.databaseId) {
        return res.status(500).send({
            ErrorMessage: 'An id has not been provided.',
            Additional: 'A deploymentId or databaseId must be provided under deploymentId or databaseId body properties.'
        });
    }

    helper.unlockDeployment({
        deploymentId: req.body.deploymentId,
        databaseId: req.body.databaseId
    }, function(e, r) {
        res.status(e ? 500 : 200).send(e || r);
    });
});

router.get('/insert', function(req, res) {
    var i = {
        "deployStarted": Date.now(),
        "deployFinished": Date.now(),
        "build": {
            "Branch": "develop",
            "Version": Math.random().toString().slice(2, 11)
        },
        "dataset": {
            "Filename": "comalley_51415189821496_5.3.11723_automated-testing-v3-2.zip",
            "Name": "automated-testing v3.2"
        },
        "deploymentId": "deployments-" + Math.random().toString().slice(2, 11),
        "environmentId": "Environments-195",
        "environmentName": null,
        "hrUri": "casdeploy003.cloudapp.net:82",
        "isCompleted": true,
        "isExecuting": false,
        "isProvisioning": false,
        "isSuccessful": true,
        "message": {
            "_id": "545d03d5bee52ca423ded42d",
            "branch": "develop",
            "buildId": "5.4.11835",
            "dequeued": "2014-11-10T10:02:37.653Z",
            "queued": "2014-11-07T17:39:33.546Z",
            "snapshotFile": "comalley_51415189821496_5.3.11723_automated-testing-v3-2.zip",
            "snapshotName": "automated-testing v3.2",
            "status": "deploying"
        },
        "mobileUri": "casdeploy003.cloudapp.net:84",
        "recruitmentUri": "casdeploy003.cloudapp.net:80",
        "state": "Success",
        "taskId": "ServerTasks-23369"
    }
    atCollection.insert(i, function(e, r) {
        res.status(e ? 500 : 200).send(e || r);
    });
});

module.exports = router;