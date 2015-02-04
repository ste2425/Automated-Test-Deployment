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
        r = r || {};
        if (e || r.statusCode != 200) {
            log({
                Url: 'https://coral-reef.azurewebsites.net/deployment',
                Error: e,
                Body: b,
                Response: r
            });
            return end();
        }
        async.mapLimit(b, 5, function(deployment, mcb) {
            helper.unlockDeployment({
                deploymentId: deployment.octopusDeploymentId
            }, function(e, unlockRes) {
                if(e){
                    e.LineNumber = 36;
                    log(e);
                }
                //if (e) return mcb();

                request({
                    method: 'POST',
                    uri: 'https://coral-reef.azurewebsites.net/deployment/' + deployment['_id'] + '/actions',
                    json: true,
                    body: {
                        type: 'environment-recycled'
                    }
                }, function(e, r, b) {
                    if(e){
                        e.LineNumber = 50;
                        log({Error: e, Body: b, Response: r});
                    }
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

function log(e, d){
    if(e){
        console.log('------- ERROR: check testing complete task\n');
        console.log(new Date());
        console.log(e);
        console.log('-------\n');
    }
    if(d)
        console.log(d);
}