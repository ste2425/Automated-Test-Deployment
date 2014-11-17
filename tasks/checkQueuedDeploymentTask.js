/*
    Will hit coral reef for next queued deployment and deploy it.
    Runs every 15 seconds.
    Will not run if global variable 'checkForDeployments' is false.
*/
var octoHelper = require(__ROOT + '/octopusHelper'),
    request = require('request'),
    helper = require(__ROOT + '/helpers.js');

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
                    helper.messageHandler(b);
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

module.exports = pollCoralReefForQueuedDeployments;