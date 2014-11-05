//Uploader Class
var fs = require('fs'),
	async = require('async'),
	request = require('request'),
	paths = require('path');

function uploadManager(opts) {
	if (!(this instanceof uploadManager)) {
		return new uploadManager(opts);
	}

	this.fileDescriptor = {
		fileName: '',
		fd: null,
		size: 0
	};
	this.progress = {
		count: 0,
		uploaded: 0,
		chunks: []
	}

	this.opts = opts || {};

	this.opts.bufferCount = this.opts.bufferCount || 5;
	this.opts.bufferSize = this.opts.bufferSize || 2097152;
	this.opts.apiToken = this.opts.apiToken || '';
	this.opts.apiTokenHeader = this.opts.apiTokenHeader || 'x-access-token';
	this.opts.apiUrl = this.opts.apiUrl || '/azure/blobmanagement/blobsblock/';
	this.opts.apiHost = this.opts.apiHost || 'https://crazy-ivan.azurewebsites.net';
	this.opts.apiContainer = this.opts.apiContainer || '';
	this.opts.apiMethod = this.opts.apiMethod || 'POST';

	this.buffers = [];
}

uploadManager.prototype.setFile = function(opts, cb) {
	var parent = this;
	fs.open(paths.join(opts.path, opts.fileName), (opts.method || 'r'), function(e, fd) {
		if (!e) {
			parent.fileDescriptor.fd = fd;
			parent.fileDescriptor.fileName = opts.fileName;
			fs.fstat(fd, function(e, stats) {
				if (!e) {
					parent.setBuffers();
					parent.fileDescriptor.size = stats.size;
				}
				cb(e);
			})
		} else {
			cb(e);
		}
	});
}

uploadManager.prototype.upload = function(cb) {
	var parent = this;
	if (parent.fileDescriptor.fd) {
		var length = Math.ceil((parent.fileDescriptor.size / parent.opts.bufferSize));
		for (var i = 0; i < length; i++) {
			parent.progress.chunks.push({
				id: i,
				start: parent.progress.count,
				blobId: ''
			})
			parent.progress.count += parent.opts.bufferSize;
		}

		async.mapLimit(parent.progress.chunks, parent.opts.bufferCount, function(item, mcb) {
			//Get index of first free buffer in pool
			var buffIndex = findIndex(parent.buffers, function(e, i, a) {
				return !e.inUse;
			});
			if (buffIndex == -1) {
				mcb({
					ErrorMessage: 'Buffer Use Overload'
				}, null);
			} else {
				//Mark buffer as in use
				parent.buffers[buffIndex].inUse = true;

				//Read Data Chunk
				fs.read(parent.fileDescriptor.fd,
					parent.buffers[buffIndex].buffer,
					0,
					parent.buffers[buffIndex].buffer.length,
					item.start,
					function(e, n) {
						if (e) {
							mcb(e);
						} else {
							//Upload Chunk
							var options = {
								url: parent.opts.apiHost + parent.opts.apiUrl + parent.opts.apiContainer + '/' + parent.fileDescriptor.fileName,
								headers: {
									'content-length': n,
									'content-type': 'multipart/form-data',
									'x-upload-type': 'text'
								},
								timeout: 180000,
								body: parent.buffers[buffIndex].buffer.slice(0, n)
							}
							options.headers[parent.opts.apiTokenHeader] = parent.opts.apiToken;
							//send
							request.post(options, function(e, r, body) {
								if(parent.buffers[buffIndex])
									parent.buffers[buffIndex].inUse = false;

								if (e || r.statusCode != 200) {
									mcb(e || body, null);
								} else {
									body = JSON.parse(body);
									parent.progress.chunks[item.id].blobId = body.blobId
									parent.progress.uploaded += n;
									mcb();
								}
							});
						}
					}
				);
			}
		}, function(e, r) {
			var out = [];
			for (var i in parent.progress.chunks) {
				if (parent.progress.chunks[i].blobId)
					out.push(parent.progress.chunks[i].blobId);
			}
			cb(e, {
				UncommittedBlocks: out
			});
		});
	} else {
		cb({
			ErrorMessage: 'File Descriptor not set'
		})
	}
}

uploadManager.prototype.removeFile = function(cb) {
	var parent = this;
	for (var i in parent.buffers) {
		parent.buffers[i].buffer = null;
	}
	parent.buffers = [];

	if (parent.fileDescriptor.fd) {
		fs.close(parent.fileDescriptor.fd, function(e) {
			parent.fileDescriptor.fd = null;
			parent.fileDescriptor.fileName = '';
			parent.fileDescriptor.size = 0;

			if (cb)
				cb(e);
		});
	} else if (cb) {
		cb();
	}
}

uploadManager.prototype.setBuffers = function(append) {
	if (!append) {
		this.buffers = [];
	}
	for (var i = 0; i < this.opts.bufferCount; i++) {
		this.buffers.push({
			inUse: false,
			buffer: new Buffer(this.opts.bufferSize)
		});
	}
	return this.buffers;
}

module.exports = uploadManager;


function findIndex(arr, predicate) {
	if (arr == null) {
		throw new TypeError('Array.prototype.find called on null or undefined');
	}
	if (typeof predicate !== 'function') {
		throw new TypeError('predicate must be a function');
	}
	var list = Object(arr);
	var length = list.length >>> 0;
	var thisArg = arguments[1];
	var value;

	for (var i = 0; i < length; i++) {
		value = list[i];
		if (predicate.call(thisArg, value, i, list)) {
			return i;
		}
	}
	return -1;
}