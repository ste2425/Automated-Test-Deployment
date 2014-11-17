global.__CONFIG = require('./config.json');
global.__ROOT = __dirname;

//TODO: put these flags in a database or json file, not global in-memory variables
//Flags
global.deployProcessing = false;
global.checkForDeployments = false;
global.checkActiveDeploymentState = false;
global.checkMachinesToShutdown = false;
global.checkForDeploymentsUnlock = false;

//database access
var atCollection = require(__ROOT + '/modules/data-access').connect();

//Express modules
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var https = require('https');
var routes = require('./routes/routesIndex.js');

//helper modules
var helper = require('./helpers');
var octoHelper = require('./octopusHelper');
var async = require('async');
var moment = require('moment');
var azureHelper = require('./azureHelper');
var request = require('request');

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

app.use('/', routes.web);
app.use('/modals', routes.modal);
app.use('/log', routes.log);
app.use('/api', routes.api);

app.listen(app.get('port'), function() {
    console.log('listening on *:', app.get('port'));
});

//internal functions
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
                                    helper.unlockDeployment({
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
                        if (!e && t) {
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
                if (r.statusCode == 200) {
                    messageHandler(b);
                } else {
                    console.log('Error from coral reef', {
                        Url: 'https://coral-reef.azurewebsites.net/deployment/queue/pop',
                        Error: b
                    })
                }
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
        if (e || r.statusCode != 200) {
            console.log('Coral Reef error', {
                Url: 'https://coral-reef.azurewebsites.net/deployment',
                Error: b
            });
            return end();
        }
        console.log(b)
        async.mapLimit(b, 5, function(deployment, mcb) {
            helper.unlockDeployment({
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