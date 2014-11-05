//Octopus helper methods

var octClient = require('./modules/octopus-node').client(__CONFIG.octopusAccess.host, __CONFIG.octopusAccess.apiKey);
var async = require('async');


module.exports = {
	findEnvironments: findEnvironments,
	findMachinesByEnv: findMachinesByEnv,
	findAllMachines: findAllMachines,
	modifyMachine: modifyMachine,
	getDeploymentPreview: getDeploymentPreview,
	buildFormValuesObject: buildFormValuesObject,
	performDeployment: performDeployment,
	getTask: getTask
}

function modifyMachine(changes, cb) {
	async.map(changes, function(item, mcb) {
		if (!item.Id || !item.Name || !item.EnvironmentIds || !item.Thumbprint || !item.Uri || !item.Roles) {
			cb({
				ErrorMessage: 'Not all required variables set'
			}, null);
		} else {
			var id = item.Id;
			delete item.Id;
			octClient.machine.updateMachine({
				machineId: id,
				data: item
			}, mcb);
		}
	}, function(err, r) {
		cb(err, r);
	});
}

function findAllMachines(cb) {
	var currentMachines = 0;
	var self = {
		TotalMachines: 0,
		Machines: [],
		FindMachineByName: function(m, n) {
			for (var i in m) {
				if (m[i].Name === n || m[i].Id === n) {
					return m[i];
				}
			}
			return null;
		}
	}

	function find(opts, cb) {
		octClient.machine.getMachines({
			query: opts.query || {}
		}, function(err, machines) {
			if (err) {
				cb(err);
			} else {
				self.Machines = self.Machines.concat(machines.Items);
				self.TotalMachines = machines.TotalResults;
				currentMachines += machines.Items.length
				if (currentMachines < self.TotalMachines) {
					find({
						query: {
							skip: currentMachines
						}
					}, cb);
				} else {
					cb(null, self);
				}
			}
		});
	}
	find({}, cb);
}

function findMachinesByEnv(environments, cb) {
	var currentMachines = 0;
	async.map(environments, function(env, mcb) {
		currentMachines = 0;
		var self = {
			TotalMachines: 0,
			Machines: [],
			FindMachineByName: function(m, n) {
				for (var i in m) {
					if (m[i].Name === n || m[i].Id === n) {
						return m[i];
					}
				}
				return null;
			}
		}
		var id = env.Id || env;
		find({
			id: id
		}, self, function(err, machines) {
			if (env.Id) {
				env.Machines = machines
			} else {
				env = {
					Id: env,
					Machine: machines
				};
			}
			mcb(err, env);
		});
	}, cb);

	function find(options, self, cb) {
		octClient.machine.getMachinesByEnvironment({
			environmentId: options.id,
			query: options.query || {}
		}, function(err, res) {
			if (err) {
				cb(err);
			} else {
				self.Machines = self.Machines.concat(res.Items);
				self.TotalMachines = res.TotalResults;
				currentMachines += res.Items.length
				if (currentMachines < self.TotalMachines) {
					find({
						id: options.id,
						query: {
							skip: currentMachines
						}
					}, self, cb);
				} else {
					cb(null, self);
				}
			}
		});
	}
}

function findEnvironments(options, cb) {
	var currentEnvs = 0;
	var self = {
		TotalEnvironments: 0,
		Environments: [],
		findEnvByName: function(e, n) {
			for (var i in e) {
				if (e[i].Name === n || e[i].Id === n) {
					return e[i]
				}
			}
			return null;
		}
	};

	function find(options, cb) {
		octClient.environment.getEnvironments({
			url: options.id || '',
			query: options.query || {}
		}, function(err, envs) {
			if (err) {
				cb(err);
			} else if (options.id) {
				cb(null, envs)
			} else {
				self.Environments = self.Environments.concat(envs.Items);
				self.TotalEnvironments = envs.TotalResults;
				currentEnvs += envs.Items.length;
				if (currentEnvs < self.TotalEnvironments) {
					find({
						query: {
							skip: currentEnvs
						}
					}, cb);
				} else {
					envs = null;
					cb(null);
				}
			}
		});
	}

	find(options, function(err) {
		cb(err, self);
	});
}

function getDeploymentPreview(options, cb) {
	octClient.deploy.preview(options, cb);
}

function buildFormValuesObject(options, cb) {
	if (options.form) {
		cb(null, format(options.form));
	} else {
		getDeploymentPreview({
			releaseId: options.releaseId,
			environmentId: options.environmentId
		}, function(e, r) {
			if (!e) {
				options.form = format(r.Form);
			}
			cb(e, options.form);
		});
	}

	function format(obj) {
		var form = obj.Values;
		for (var i in obj.Elements) {
			for (var y in options.input) {
				if (!obj.Elements[i].Control) {
					var t = 'hiyaszfg'
				}
				if (y == obj.Elements[i].Control.Label) {
					form[obj.Elements[i].Name] = options.input[y];
				}
			}
		}
		return form;
	}
}

function performDeployment(options, cb) {
	async.waterfall([

		function(wcb) {
			if (options.variables) {
				//build deployment variables object from default values
				buildFormValuesObject({
					releaseId: options.releaseId,
					environmentId: options.environmentId,
					input: options.variables
				}, function(e, values) {
					if (!e) {
						wcb(null, {
							formValues: values
						})
					} else {
						wcb(e, {
							formValues: {}
						});
					}
				});
			} else {
				//else continue
				wcb(null, {
					formValues: null
				});
			}
		},
		function(opts, wcb) {
			//perform deployment
			octClient.deploy.performDeploy({
				formValues: opts.formValues,
				environmentId: options.environmentId,
				releaseId: options.releaseId
			}, wcb);
		}
	], cb);
}

function getTask(taskId, cb) {
	octClient.task.getTaskDetails({
		taskId: taskId
	}, cb);
}