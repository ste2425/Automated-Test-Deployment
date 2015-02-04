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
        return end();
    }

    octoHelper.findMachinesByEnv([__CONFIG.deploymentOptions.poolEnvironmentId], function(e, m) {
        if (e) {
            e.LineNumber = 19;
            log(e);
            end();
        } else {
            async.map(m[0].Machine.Machines, function(item, mcb) {
                if (moment().diff(moment(item.LastModifiedOn), 'minutes') >= 180 && item.Status != 'Offline') {
                    azureHelper.getToken(function(e, t) {
                        if (!e && t) {
                            azureHelper.stopVm({
                                wait: true,
                                token: t.token,
                                vmName: item.Name.replace('.cloudapp.net', '')
                            }, function(e, r) {
                                if(e){
                                    e.LineNumber = 34;
                                    log(e);
                                }
                                mcb(null, r);
                            })
                        } else {
                            e.LineNumber = 37;
                            log(e);
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

function log(e, d){
    if(e){
        console.log('------- ERROR: check pool machine shutdown task\n');
        console.log(new Date());
        console.log(e);
        console.log('-------\n');
    }
    if(d)
        console.log(d);
}