/*
    Will check the pool for machines that require shutting down in Azure and will shut them down.
    Runs every hour.
    Will not run if global variables 'checkMachinesToShutdown' or 'deployProcessing' are false.
*/
var octoHelper = require(__ROOT + '/octopusHelper'),
    async = require('async'),
    moment = require('moment'),
    azureHelper = require(__ROOT + '/azureHelper.js');

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

module.exports = shutdownPoolMachines;