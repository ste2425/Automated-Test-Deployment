/*
    Will check for running deployments and update it's status, once deployment is complete will hit 
    coral-reef with results.
    Runs every 30 seconds.
    Will not run if global variable 'checkActiveDeploymentState' is false.
*/
var atCollection = require(__ROOT + '/modules/data-access').get(),
    async = require('async'),
    octoHelper = require(__ROOT + '/octopusHelper'),
    request = require('request'),
    helper = require(__ROOT + '/helpers.js');

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

                            var payload = {
                                type: (t.Task.FinishedSuccessfully ? 'complete' : 'failed'), //t.Task.State.toLowerCase()),
                                environment: 'automatedTesting001',
                                hrUrl: ('http://' + item.hrUri),
                                recruitmentUrl: ('http://' + item.recruitmentUri),
                                mobileUrl: ('http://' + item.mobileUri),
                                octopusDeploymentId: item.deploymentId
                            };

                            var payloadString = JSON.stringify(payload);
                            console.log('Deployment done, posting back to coral-reef');

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

module.exports = checkRunningDeployments