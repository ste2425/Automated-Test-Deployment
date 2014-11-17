var o = require('./octopusHelper');
var azureHelper = require('./azureHelper');
var async = require('async');
var atCollection = require(__ROOT + '/modules/data-access').get();

module.exports = {
    automatedTestDeployment: automatedTestDeployment,
    unlockDeployment: unlockDeployment
}

function automatedTestDeployment(options, callback) {
    //ToDo: Remove hard coded environment: capri, remove hardcoded pool: zagato.
    options.dataset.Filename = options.dataset.Filename.replace('.zip', '');
    options.build.Version = options.build.Version.replace('.zip', '');

    o.findEnvironments({}, function(err, res) {
        //Get all environments
        if (err) {
            callback(err);
        } else {
            async.waterfall([

                function(wcb) {
                    //check environment free
		    console.log('checkig environment is free...');
                    o.findMachinesByEnv([options.environmentId], function(err, machines) {
                        if (err) {
                            err.environmentId = options.environmentId;
                            wcb(err, null);
                        } else if (machines[0].Machine.TotalMachines > 0) {
                            wcb({
                                ErrorMessage: 'Environment: ' + options.environmentId + ', In Use.',
                                environmentId: options.environmentId
                            }, null);
                        } else {
                            wcb(null, {});
                        }
                    });
                },
                function(opts, wcb) {
                    // check pool
		    console.log('checkig pool...');
                    o.findMachinesByEnv([options.poolEnvironmentId], function(err, machines) {
                        if (err || machines[0].Machine.TotalMachines < options.config.MachineNumber) {
                            err = err || {
                                ErrorMessage: 'Not enough available machines.'
                            };
                            wcb(err, null);
                        } else {
                            opts.machines = machines[0].Machine.Machines.slice(0, options.config.MachineNumber);
                            wcb(null, opts);
                        }
                    });
                },
                function(opts, wcb) {
                    //assign machine roles
		    console.log('assigning machine roles...');
                    var changes = [];
                    opts.machines.forEach(function(item, i) {
                        item.EnvironmentIds = [options.environmentId];
                        item.Roles = options.config.MachineRoles[i];
                        changes.push(item);
                    });
                    o.modifyMachine(changes, function(err, m) {
                        if (!err) {
                            m.forEach(function(p, i, a) {
                                a[i].AzureName = p.Name.substring(0, p.Name.indexOf('.'));
                            });
                            opts.machines = m;
                        } else {
                            err.environmentId = options.environmentId;
                        }
                        wcb(err, opts);
                    });
                },
                function(opts, wcb) {
                    //setup azure environments
                    //Get Token
		    console.log('setting up azure environments...');
                    azureHelper.getToken(function(e, t) {
                        if (e) {
                            e.environmentId = options.environmentId;
                            wcb(e);
                        } else {
                            var error = null;
                            async.parallel([

                                function(pcb) {
                                    //Coppy release pack  
                                    azureHelper.uploadFile({
                                        token: t.token,
                                        container: 'cascadestore',
                                        path: __CONFIG.deploymentOptions.buildStoreLocation, //__CONFIG.store.location,
                                        filename: options.build.Version + '.zip',
                                        overwriteType: 'newest'
                                    }, function(e, u) {
                                        if (e) {
                                            error = e;
                                        }
                                        pcb(null, u);
                                    });
                                },
                                function(pcb) {
                                    //coppy datapack
                                    azureHelper.uploadFile({
                                        token: t.token,
                                        container: 'datastore',
                                        path: __CONFIG.deploymentOptions.dataStoreLocation,// __CONFIG.DatasetDirectory,
                                        filename: options.dataset.Filename + '.zip',
                                        overwriteType: 'newest'
                                    }, function(e, u) {
                                        if (e) {
                                            error = e;
                                        }
                                        pcb(null, u);
                                    });
                                },
                                function(pcb) {
                                    //start vms
                                    async.map(opts.machines, function(machine, mcb) {
                                        azureHelper.startVm({
                                            token: t.token,
                                            vmName: machine.AzureName,
                                            wait: true
                                        }, function(e, m) {
                                            mcb(e, m)
                                        });
                                    }, function(e, m) {
                                        if (e) {
                                            error = e;
                                        }
                                        pcb(null, m);
                                    });
                                }
                            ], function(err, r) {
                                if (error) {
                                    error.environmentId = options.environmentId;
                                }
                                wcb(error, opts);
                            });
                        }
                    });
                },
                function(opts, wcb) {
                    //perform deployment
		    console.log('performing deployment...');

                    //set deployment options
                    var formValues = {
                        databaseHR: 'restore',
                        databaseLogins: 'restore',
                        databasePWeb: 'restore',
                        databaseOR: 'restore',
                        database360: 'restore',
                        codePack: options.build.Version + '.zip',
                        dataPack: options.dataset.Filename + '.zip'
                    };
                    //find machines roles assigned too
                    opts.machines.forEach(function(machine) {
                        machine.Roles.forEach(function(role) {
                            //Role names differ to Variable names
                            role = role.replace('Svr', 'Server').replace('360', 'tx');

                            formValues[role] = machine.AzureName;
                        });
                    })
                    //Build deployment variables object from label names and deploy
                    o.performDeployment({
                        releaseId: 'releases-3269',
                        environmentId: options.environmentId,
                        variables: formValues
                    }, function(e, r) {
                        if (e) {
                            e.environmentId = options.environmentId;
                        }
                        opts.deploymentResponse = r;
                        wcb(e, opts)
                    });
                }
            ], function(e, r) {
                //fin
                callback(e, r)
            })
        }
    });
}

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
        o.findMachinesByEnv([r[0].environmentId], function(e, m) {
            if (e) {
                return cb(e, null);
            } else {
                var changes = [];
                m[0].Machine.Machines.forEach(function(machine) {
                    machine.EnvironmentIds = [__CONFIG.deploymentOptions.poolEnvironmentId];
                    changes.push(machine);
                });
                o.modifyMachine(changes, function(e, r) {
                    if (e) return cb(e, r);

                    atCollection.remove(find, function(e, rRecord) {
                        cb(e, r);
                    });
                });
            }
        });
    });
}
