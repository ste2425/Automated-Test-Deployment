/*
    Will hit coral-reef for deployments to unlock, AKA once testing complete.
    Runs every 15 seconds.
    Will not run if global variable 'checkForDeploymentsUnlock' is false.
*/
var request = require('request'),
async = require('async'),
helper = require(__ROOT + '/helpers.js');

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

module.exports = checkTestingComplete;