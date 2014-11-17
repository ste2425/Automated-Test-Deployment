/*
    Will hit coral reef for next queued deployment and deploy it.
    Runs every 15 seconds.
    Will not run if global variable 'checkForDeployments' is false.
*/
var octoHelper = require(__ROOT + '/octopusHelper'),
    request = require('request'),
    helper = require(__ROOT + '/helpers.js'),
    async = require('async');

function pollCoralReefForQueuedDeployments() {
    if (!checkForDeployments || deployProcessing) return end();

    async.waterfall([function(wcb) {
        //check pool
        octoHelper.findMachinesByEnv([__CONFIG.deploymentOptions.poolEnvironmentId], function(e, m) {
            if (e || m[0].Machine.TotalMachines < 2) {
                wcb({
                    ErrorMessage: 'Machines not available in pool',
                    Error: e
                }, null);
            } else {
                wcb(null, {
                    pool: m[0].Machine
                });
            }
        });
    }, function(opts, wcb) {
        //check deploy envs
        var deployId = "";
        octoHelper.findMachinesByEnv(__CONFIG.deploymentOptions.deploymentEnvironmentId, function(e, m) {
            if (e) {
                return wcb({
                    ErrorMessage: 'Error getting deployment environments',
                    Error: e
                }, null);
            }
            m.every(function(item){
                if(item.Machine.TotalMachines == 0){
                    deployId = item.Id;
                    return false;
                }
                return true;
            });
            if(deployId == ""){
                wcb({ErrorMessage: "No free deployment environments"}, null);
            }else{
                opts.deployId = deployId;
                wcb(null, opts);
            }
        });
    }, function(opts, wcb) {
        //check coral reef            
        request({
            method: 'PUT',
            uri: 'https://coral-reef.azurewebsites.net/deployment/queue/pop',
            json: true
        }, function(e, r, b) {
            if (r.statusCode == 200) {
                opts.message = b;
                opts.message.deployEnvironmentId = opts.deployId;
                helper.messageHandler(opts.message);
                wcb(null, opts);
            } else {
                wcb({
                    ErrorMessage: 'Error from coral reef',
                    Error: b
                }, null);
            }
        });
    }], function(e, r) {
        if (e) {
            console.log('Error deploying');
            console.log(e);
        }
        end();
    });

    function end() {
        setTimeout(function() {
            pollCoralReefForQueuedDeployments();
        }, 15000);
    }
}

module.exports = pollCoralReefForQueuedDeployments;