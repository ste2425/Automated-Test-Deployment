//Azure helper

var request = require('request'),
	fs = require('fs'),
	moment = require('moment'),
	async = require('async'),
	qs = require('querystring'),
	bs = require('block-stream'),
	host = __CONFIG.azureAccess.host,
	uploadManager = require('./uploadManager');

module.exports = {
	uploadFile: uploadFile,
	getToken: getToken,
	getVm: getVm,
	startVm: startVm,
	stopVm: stopVm,
	callWhenVmIs: callWhenVmIs,
	getBlockList: getBlockList,
	getBlobs: getBlobs
}
/**
 * Returns blobs within a container
 * @param {String} opts.blob The azure blob, optional, the specific blob
 * @param {String} opts.container The azure container the blob is within
 * @param {String} opts.token The web-api-token used to authenticate against Crazy-Ivan
 * @method cb The Function called once complete. Passes error and response objects.
 */
function getBlobs(opts, cb) {
	var options = {
		url: '/azure/blobmanagement/blobs/' + opts.container,
		headers: {
			'x-access-token': opts.token
		},
		method: 'GET'
	}
	if (opts.blob) {
		options.url += ('/' + opts.blob);
	}
	makeRequest(options, cb, true);
}
/**
 * Returns a list of uploaded blob blocks to azure
 * @param {String} opts.type The type of block to return, optional, options: uncommitted, committed or all
 * @param {String} opts.blob The azure blob uploaded too
 * @param {String} opts.container The azure container uploaded too
 * @param {String} opts.token The web-api-token used to authenticate against Crazy-Ivan
 * @method cb The Function called once complete. Passes error and response objects.
 */
function getBlockList(opts, cb) {
	var options = {
		url: '/azure/blobmanagement/blocklist/' + opts.container + '/' + opts.blob + '/' + (opts.type || ''),
		headers: {
			'x-access-token': opts.token
		}
	}
	makeRequest(options, cb, true)
}
/**
 * Uploads a file to azure
 * @param {String} opts.path Directory location to the file to upload
 * @param {String} opts.filename The name including extension of the file to upload
 * @param {String} opts.container The azure container to upload too
 * @param {String} opts.token The web-api-token used to authenticate against Crazy-Ivan
 * @param {String} opts.overwriteType How to handle if the file to upload already exists. options: overwrite, newest, existing
 * @method cb The Function called once complete. Passes error and response objects.
 */
function uploadFile(opts, cb) {
	opts.overwriteType = opts.overwriteType || 'existing';
	var fullPath = opts.path + '/' + opts.filename;
	console.log('uploading', opts.filename)
	async.waterfall([

		function(wcb) {
			//get file stats to upload
			fs.stat(fullPath, function(e, s) {
				if (e) {
					e.uploadStep = 'get internal file stats';
					e.filename = opts.filename;
				}
				wcb(e, {
					stats: s
				});
			});
		},
		function(wopts, wcb) {
			//check if file in azure
			getBlobs({
				token: opts.token,
				container: opts.container,
				blob: opts.filename
			}, function(e, blob) {
				if (!e) {
					wopts.blob = blob[0];
				} else {
					e.uploadStep = 'check if blob exists';
					e.filename = opts.filename;
				}
				wcb(e, wopts);
			});
		},
		function(wopts, wcb) {
			//upload file
			opts.fileSize = wopts.stats.size;
			switch (opts.overwriteType) {
				case 'existing':
					//take existing blob
					if (wopts.blob) {
						console.log('Taking Existing')
						wcb(null, wopts.blob);
					} else {
						//upload
						console.log('Uploading as doesnt exist')
						upload(opts, function(error) {
							if (error) {
								error.uploadStep = 'Upload File, file not existing';
								error.filename = opts.filename;
							}
							wcb(error);
						});
					}
					break;
				case 'newest':
					//take newest blob
					if (wopts.blob && moment(wopts.blob.properties['last-modified']).isAfter(moment(wopts.stats.mtime))) {
						console.log('Existing newest', opts.filename)
						//take existing
						wcb(null, wopts.blob);
					} else {
						//upload
						console.log('Uploading newest', opts.filename)
						upload(opts, function(error) {
							if (error) {
								error.uploadStep = 'Upload File, local file newer';
								error.filename = opts.filename;
							}
							wcb(error);
						});
					}
					break;
				case 'overwrite':
					//overwrite existing blob
					console.log('Overwriting');
					upload(opts, function(error) {
							if (error) {
								error.uploadStep = 'Upload File, overwriting with local';
								error.filename = opts.filename;
							}
						wcb(error);
					});
					break;
			}
		}
	], function(e, r) {
		try {
			e = JSON.parse(e);
		} catch (err) {
			e = {
				ErrorMessage: e.toString()
			};
		}
		cb(e, r);
	})

	function upload(params, callback) {
		var manager = new uploadManager({
			apiContainer: params.container,
			apiToken: params.token,
			bufferCount: 4,
			apiHost: host
		});

		manager.setFile({
			path: params.path,
			fileName: params.filename
		}, function(e) {
			console.log('SET FILE', e);
			console.log('UPLOAD STARTED, ', new Date())
			if (!e) {
				manager.upload(function(e, b) {
					console.log('UPLOAD FILE', e, b);
					console.log('UPLOAD FINISHED, ', new Date())
					manager.removeFile(function(error) {
						console.log('REMOVING FILE ,', error)
						if (!e) {
							commitBlocks({
								container: params.container,
								blob: params.filename,
								token: params.token,
								blockIds: b
							}, function(e, r) {
								callback(e)
							})
						} else {
							callback(e);
						}
					})
				});
			} else {
				callback(e);
			}
		});


	}
}

function commitBlocks(opts, cb) {
	var options = {
		url: '/azure/blobmanagement/commitblocksblock/' + opts.container + '/' + opts.blob,
		headers: {
			'x-access-token': opts.token,
			'Content-type': 'application/json'
		},
		method: 'POST',
		body: JSON.stringify({
			blocks: opts.blockIds
		})
	}
	makeRequest(options, cb, true);
}

/**
 * Waits untill a vm's state matches what is sent, or timeout met then calls cb
 * @param {Int} opts.resTimeout Timeout before cancelling and calling cb in minuets. Default 40
 * @param {Int} opts.pollTimeout Timeout inbetween each poll of azure in milliseconds. Default 5000
 * @param {String} opts.status The status of the vm to check for
 * @param {String} opts.token The web-api-token used to authenticate against Crazy-Ivan
 * @param {String} opts.vmName The name of the vm to check.
 * @method cb The Function called once complete. Passes error and vm objects.
 */
function callWhenVmIs(opts, cb) {
	opts.resTimeout = opts.resTimeout || 40;
	opts.pollTimeout = opts.pollTimeout || 5000;

	var virtualMachine = {},
		stop = moment().add('m', opts.resTimeout);

	async.doWhilst(function(dcb) {
		//get vm
		console.log('Checking Vm, ', opts.vmName)
		getVm(opts, function(e, vm) {
			if (!e && !moment().isAfter(stop)) {
				console.log('VM found', opts.vmName)
				virtualMachine = vm[0];
				setTimeout(dcb, opts.pollTimeout);
			} else {
				console.log('VM Error, ', opts.vmName, e)
				dcb(e || {
					ErrorMessage: 'Poll Timeout Exceeded'
				});
			}
		});
	}, function() {
		//check if timeout exceeded or vm status met
		return moment().isAfter(stop) || virtualMachine.instanceStatus != opts.status;
	}, function(e) {
		//fin
		cb(e, virtualMachine);
	});
}

/**
 * Starts a vm then calls cb
 * @param {bool} opts.wait If true will wait for vm to start before calling cb with vm object. Default false
 * @param {String} opts.token The web-api-token used to authenticate against Crazy-Ivan
 * @param {String} opts.vmName The name of the vm to check.
 * @param {bool} opts.bootUp Specify if the machine must start up from being turned off
 * @method cb The Function called once complete. Passes error and vm object.
 */
function startVm(opts, cb) {
	var options = {
		url: '/azure/servicemanagement/vms/' + opts.vmName + '/start/',
		headers: {
			'x-access-token': opts.token
		},
		method: 'POST'
	};
	makeRequest(options, function(e, r) {
		if (!e && opts.wait) {
			callWhenVmIs({
				vmName: opts.vmName,
				token: opts.token,
				status: 'ReadyRole'
			}, cb);
		} else {
			cb(e, r);
		}
	}, true);
}

/**
 * Stops a vm then calls cb
 * @param {bool} opts.wait If true will wait for vm to stop before calling cb with vm object. Default false
 * @param {String} opts.token The web-api-token used to authenticate against Crazy-Ivan
 * @param {String} opts.vmName The name of the vm to check.
 * @method cb The Function called once complete. Passes error and vm object.
 */
function stopVm(opts, cb) {
	var options = {
		url: '/azure/servicemanagement/vms/' + opts.vmName + '/stop',
		headers: {
			'x-access-token': opts.token
		},
		method: 'POST'
	};
	makeRequest(options, function(e, r) {
		if (opts.wait) {
			callWhenVmIs({
				vmName: opts.vmName,
				token: opts.token,
				status: 'StoppedDeallocated'
			}, cb);
		} else {
			cb(e, r);
		}
	}, true);
}

/**
 * Gets a vm then calls cb, will return all vms if vmName not provided.
 * @param {String} opts.token The web-api-token used to authenticate against Crazy-Ivan
 * @param {String} opts.vmName The name of a specific vm to find.
 * @param {String} opts.serviceName The name of service underwhich vm resides. Requires vmName to be set. optional.
 * @method cb The Function called once complete. Passes error and vm objects.
 */
function getVm(opts, cb) {
	var options = {
		url: '/azure/servicemanagement/vms',
		headers: {
			'x-access-token': opts.token
		},
		method: 'GET'
	};
	if (opts.vmName) {
		options.url += ('/' + opts.vmName);
	}
	if (opts.serviceName && opts.vmName) {
		options.url += ('/' + opts.serviceName);
	}
	makeRequest(options, cb, true);
}

/**
 * Authenticates against Crazy-Ivan return web-api-token
 * @method cb Callback called once authenticated. Passes error and token object.
 * @param {String} username The username to authenticate with, default uses config.
 * @param {String} password The password to authenticate with, default uses config.
 */
function getToken(cb, username, password) {
	var options = {
		url: '/login',
		method: 'POST',
		headers: {
			'Content-type': 'application/json'
		},
		body: JSON.stringify({
			username: username || __CONFIG.azureAccess.username,
			password: password || __CONFIG.azureAccess.password
		})
	}

	makeRequest(options, cb, true);
}

//Request helper
function makeRequest(opts, cb, json) {
	opts.url = host + opts.url;
	request(opts, function(e, r, b) {
		if (e || r.statusCode != 200) {
			cb(e || b, null);
		} else {
			if (json) {
				try {
					cb(null, JSON.parse(b));
				} catch (e) {
					cb(e, null);
				}
			} else {
				cb(null, b);
			}
		}
	});
}