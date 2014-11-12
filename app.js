global.__CONFIG = require('./config.json');

//Express modules
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var https = require('https');

//helper modules
var helper = require('./helpers');
var octoHelper = require('./octopusHelper');
var async = require('async');
var moment = require('moment');
var azureHelper = require('./azureHelper');
var request = require('request');

//database modules && settings
var monk = require('monk');
var connectionString = __CONFIG.dataAccess.user + ':' + __CONFIG.dataAccess.password + '@';
connectionString += __CONFIG.dataAccess.host + ':' + __CONFIG.dataAccess.port + '/' + __CONFIG.dataAccess.database;
var Database = monk(connectionString);
var atCollection = Database.get(__CONFIG.dataAccess.collection);

//Flags
var deployProcessing = false;
var checkForDeployments = false;
var checkActiveDeploymentState = false;
var checkMachinesToShutdown = false;
var checkForDeploymentsUnlock = false;

//message handler
function messageHandler(message) {
    //Stop recieveing more messages whilst proccessing this.
    console.log('recieved message');
    if (!message) {
        console.log('Error with message', message);
        return;
    }

    if (!deployProcessing) {
        console.log('processing');
        deployProcessing = true;
        console.log(message);
        deploy(message, function(e, r) {
            if (e) {
                console.log('Error: ', e);
            }
            console.log('no longer deploy processing');
            deployProcessing = false;
        });
    }
}

//express setup
var app = express();
app.set('port', 3001);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.static(__dirname + '/public'));

app.listen(app.get('port'), function() {
    console.log('listening on *:', app.get('port'));
});

app.get('/insert', function(req, res) {
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

app.get('/', function(req, res) {
    res.render('index', {
        state: {
            deploy: checkForDeployments,
            update: checkActiveDeploymentState,
            shutdown: checkMachinesToShutdown,
            unlock: checkForDeploymentsUnlock
        }
    });
});
app.get('/modals/orphanedDeployModal', function(req, res) {
    res.render('orphanedDeployModal');
});
app.get('/nextdeploy', function(req, res) {
    var r = request.get('https://coral-reef.azurewebsites.net/deployment/queue/peek')
    r.pipe(res);
    r.on('error', function(e) {
        res.status(500).send({
            ErrorMessage: e
        });
    });
});

app.post('/cleanupdeploy', function(req, res) {
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

app.post('/unlockdeployment', function(req, res) {
    if (!req.body.deploymentId && !req.body.databaseId) {
        return res.status(500).send({
            ErrorMessage: 'An id has not been provided.',
            Additional: 'A deploymentId or databaseId must be provided under deploymentId or databaseId body properties.'
        });
    }

    unlockDeployment({
        deploymentId: req.body.deploymentId,
        databaseId: req.body.databaseId
    }, function(e, r) {
        res.status(e ? 500 : 200).send(e || r);
    });
})

app.get('/deployments', function(req, res) {
    atCollection.find({}, function(e, r) {
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

app.get('/state/:type', function(req, res) {
    switch (req.params.type) {
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
            })
            break;
        default:
            res.status(500).send({
                ErrorMessage: 'Type not found.',
                Additional: 'Type Sent, ' + req.params.type + '. Accepted: deployment, unlock, shutdown, activedeployment, all'
            });
            break;
    }
});

app.post('/toggle/:type', function(req, res) {
    switch (req.params.type) {
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

//internal functions
function unlockDeployment(opts, cb) {
    var find = {};

    if (opts.databaseId)
        find['_id'] = opts.databaseId
    else
        find.deploymentId = opts.deploymentId;

    console.log(find);
    atCollection.find(find, function(e, r) {
        if (e) return cb(e);

        if (r.length == 0) {
            return cb({
                ErrorMessage: 'Deployment not found.'
            }, null);
        }

        if (!r[0].isCompleted) {
            return cb({
                ErrorMessage: 'Cannot unlock, active deployment.'
            }, null);
        }
        octoHelper.findMachinesByEnv([r[0].environmentId], function(e, m) {
            if (e) {
                return cb(e, null);
            } else {
                var changes = [];
                m[0].Machine.Machines.forEach(function(machine) {
                    machine.EnvironmentIds = [__CONFIG.deploymentOptions.poolEnvironmentId];
                    changes.push(machine);
                });
                octoHelper.modifyMachine(changes, function(e, r) {
                    if (e) return cb(e, r);

                    atCollection.remove(find, function(e, rRecord) {
                        cb(e, r);
                    });
                });
            }
        });
    });
}

function deploy(message, cb) {
    //Performs a deployment from a deploy message
    var opts = {
        dataset: {
            Filename: message.snapshotFile || __CONFIG.deploymentOptions.datasetFilename,
            Name: message.snapshotName || 'Not Provided'
        },
        build: {
            Branch: message.branch,
            Version: message.buildId
        },
        config: __CONFIG.deploymentOptions.deploymentConfig,
        environmentId: __CONFIG.deploymentOptions.deploymentEnvironmentId,
        poolEnvironmentId: __CONFIG.deploymentOptions.poolEnvironmentId
    };


    atCollection.insert({
        deployStarted: Date.now(),
        environmentId: opts.environmentId,
        environmentName: null,
        build: opts.build,
        dataset: opts.dataset,
        taskId: null,
        deploymentId: null,
        state: 'Provisioning',
        isCompleted: false,
        isSuccessful: false,
        isProvisioning: true,
        isExecuting: false,
        message: '',
        hrUri: '',
        mobileUri: '',
        recruitmentUri: ''
    }, function(e, i) {
        helper.automatedTestDeployment(opts, function(e, r) {
            var update = {};
            //build urls
            var urls = {
                    hrUri: null,
                    mobileUri: null,
                    recruitmentUri: null
                },
                hrRole = 'hrWebSvr',
                mobileRole = 'hrWebSvr',
                recRole = 'orWebSvr';

            r.machines.forEach(function(item) {
                if (item.Roles.indexOf(hrRole) != -1) {
                    urls.hrUri = (item.Name + ':82');
                }
                if (item.Roles.indexOf(mobileRole) != -1) {
                    urls.mobileUri = (item.Name + ':84');
                }
                if (item.Roles.indexOf(recRole) != -1) {
                    urls.recruitmentUri = (item.Name + ':80');
                }
            });

            update.message = message;
            update.hrUri = urls.hrUri;
            update.mobileUri = urls.mobileUri;
            update.recruitmentUri = urls.recruitmentUri;
            update.isProvisioning = false;

            if (!e) {
                update.taskId = r.deploymentResponse.TaskId;
                update.isExecuting = true;
                update.deploymentId = r.deploymentResponse.Id;
                update.state = 'Executing';
            } else {
                update.isCompleted = true;
                update.state = 'Failed';
            }

            atCollection.update({
                _id: i._id
            }, {
                "$set": update
            }, function(err, i) {
                if (update.state == 'Failed') {
                    var payload = {
                        type: 'failed',
                        environment: 'automatedTesting001',
                        hrUrl: ('http://' + update.hrUri),
                        recruitmentUrl: ('http://' + update.recruitmentUri),
                        mobileUrl: ('http://' + update.mobileUri),
                        octopusDeploymentId: 'N/A'
                    };

                    var payloadString = JSON.stringify(payload);

                    request({
                        method: 'POST',
                        uri: 'https://coral-reef.azurewebsites.net/deployment/' + update.message._id + '/actions',
                        body: payload,
                        json: true
                    }, function(error, results, body) {
                        console.log('hit coral reef with results', error, results.statusCode, body)
                        cb(e, r);
                    });
                } else {
                    cb(e, r);
                }
            });
        });
    });
}

//Running tasks functions
function checkRunningDeployments(taskId, cb) {
    if (!checkActiveDeploymentState) return end();
    //Task runs every 30 secs, updates running deployments && adds message to rabbit upon successfull deployment
    atCollection.find({
        isExecuting: true
    }, function(e, r) {
        if (!e) {
            async.map(r, function(item, mcb) {
                octoHelper.getTask(item.taskId, function(e, t) {
                    if (!e) {
                        var update = {
                            '$set': {
                                isCompleted: t.Task.IsCompleted,
                                state: t.Task.State,
                                isSuccessful: t.Task.FinishedSuccessfully
                            }
                        };

                        if (t.Task.IsCompleted) {

                            update['$set'].isExecuting = false;
                            update['$set'].deployFinished = Date.now();
                            console.log('Deployment done, posting complete action back to coral-reef');

                            var payload = {
                                type: (t.Task.FinishedSuccessfully ? 'complete' : 'failed'), //t.Task.State.toLowerCase()),
                                environment: 'automatedTesting001',
                                hrUrl: ('http://' + item.hrUri),
                                recruitmentUrl: ('http://' + item.recruitmentUri),
                                mobileUrl: ('http://' + item.mobileUri),
                                octopusDeploymentId: item.deploymentId
                            };

                            var payloadString = JSON.stringify(payload);

                            request({
                                method: 'POST',
                                uri: 'https://coral-reef.azurewebsites.net/deployment/' + item.message._id + '/actions',
                                body: payload,
                                json: true
                            }, function(e, r, b) {
                                console.log('hit coral reef with results', e, r.statusCode, b)
                                if (!t.Task.FinishedSuccessfully) {
                                    unlockDeployment({
                                        deploymentId: item.deploymentId
                                    }, function(e, r) {
                                        console.log(item.deploymentId, 'Failed, automatically unlocked', e, r);
                                    });
                                }
                            });
                        }

                        atCollection.update({
                            _id: item['_id']
                        }, update, function(e, u) {
                            //console.log(update)
                            //console.log(e, u)
                            mcb();
                        });
                    } else {
                        console.log('task error')
                        mcb();
                    }
                });
            }, function(e, r) {
                end();
            });
        } else {
            end();
        }
    });

    function end() {
        //console.log('checked')
        setTimeout(function() {
            checkRunningDeployments();
        }, 30000);
    }
}

function shutdownPoolMachines() {
    //Check for machines that have been in the pool for over three hours and shutdown if active
    if (deployProcessing || !checkMachinesToShutdown) {
        console.log('not shutting down')
        return end();
    }
    console.log('shutting down')
    octoHelper.findMachinesByEnv([__CONFIG.deploymentOptions.poolEnvironmentId], function(e, m) {
        console.log('shutdown check')
        if (e) {
            end();
        } else {
            async.map(m[0].Machine.Machines, function(item, mcb) {
                if (moment().diff(moment(item.LastModifiedOn), 'minutes') >= 180 && item.Status != 'Offline') {
                    console.log('unlocking environments')
                    azureHelper.getToken(function(e, t) {
                        if (!e) {
                            azureHelper.stopVm({
                                wait: true,
                                token: t.token,
                                vmName: item.Name.replace('.cloudapp.net', '')
                            }, function(e, r) {
                                console.log('machines shutdown')
                                mcb(null, r);
                            })
                        } else {
                            mcb();
                        }
                    });
                } else {
                    mcb();
                }
            }, function(e, r) {
                end();
            });
        }
    });

    function end() {
        setTimeout(function() {
            shutdownPoolMachines();
        }, 3600000);
    }
}

function pollCoralReefForQueuedDeployments() {

    //console.log('Polling coral-reef...');
    //console.log('Deploy processing - ' + (deployProcessing ? 'yes' : 'no'));

    if (!checkForDeployments) return end();

    octoHelper.findMachinesByEnv([__CONFIG.deploymentOptions.poolEnvironmentId], function(e, m) {
        if (!e && m[0].Machine.TotalMachines >= 2) {
            console.log('Machine available, requesting build');
            request({
                method: 'PUT',
                uri: 'https://coral-reef.azurewebsites.net/deployment/queue/pop',
                json: true
            }, function(e, r, b) {
                //if (e) return end();
                // console.log(r);
                messageHandler(b);
                end();
            });
        } else {
            console.log('Machines not available not deploying');
            end();
        }
    });

    function end() {
        setTimeout(function() {
            pollCoralReefForQueuedDeployments();
        }, 15000);
    }
}

function checkTestingComplete() {
    if (!checkForDeploymentsUnlock) return end();

    request({
        uri: 'https://coral-reef.azurewebsites.net/deployment',
        method: 'GET',
        qs: {
            environmentStatus: 'finished'
        },
        json: true
    }, function(e, r, b) {
        if (e) return end();
        console.log(b)
        async.mapLimit(b, 5, function(deployment, mcb) {
            unlockDeployment({
                deploymentId: deployment.octopusDeploymentId
            }, function(e, unlockRes) {
                console.log(deployment.octopusDeploymentId, ' unlocked, testing complete');
                if (e) return mcb();

                request({
                    method: 'POST',
                    uri: 'https://coral-reef.azurewebsites.net/deployment/' + deployment['_id'] + '/actions',
                    json: true,
                    body: {
                        type: 'environment-recycled'
                    }
                }, function() {
                    mcb();
                });
            });
        }, function(e, r) {
            end();
        });
    });

    function end() {
        setTimeout(function() {
            checkTestingComplete();
        }, 15000);
    }
}

//start running tasks
pollCoralReefForQueuedDeployments();
checkRunningDeployments();
shutdownPoolMachines();
checkTestingComplete();