//TODO: Make this awesome!¬¬¬¬!!!
var amqp = require('amqp');

function rabbitMq() {
	if (!(this instanceof rabbitMq)) {
		return new rabbitMq();
	}

	this.connection;
	this.queueEntries = {};
	this.connected = false;
}

/*
	Will connect to RabbitMQ Server
	opts.host: server host name
	opts.port: server port number
	opts.username: username to connect as
	opts.password: password to connect with

	eventCb.ready: function called upon 'ready' event
	eventCb.error: function called with error object upon 'error' event
	eventCb.close: function called upon 'close' event
*/
rabbitMq.prototype.connect = function(opts, eventCb) {
	//TODO: Propigate events instead of using callbacks!!!!!!
	var self = this;
	eventCb = eventCb || {};

	self.connection = amqp.createConnection({
		host: opts.host,
		port: opts.port,
		login: opts.username,
		password: opts.password
	});
	self.connection.on('ready', function() {
		self.connected = true;
		if (eventCb.ready)
			eventCb.ready();
	});
	self.connection.on('error', function(e) {
		self.connected = false;
		if (eventCb.error)
			eventCb.error(e);
	});
	self.connection.on('close', function() {
		self.connected = false;
		if (eventCb.close)
			eventCb.close();
	});
};

/*
	Will signal to stop recieveing messages from queue
	queueName: Name of queue to stop messages
*/
rabbitMq.prototype.disconnectMessages = function(queueName) {
	if (this.queueEntries[queueName]) {
		this.queueEntries[queueName].queue.unsubscribe(this.queueEntries[queueName].tag);
		this.queueEntries[queueName].receiving = false;
	}
}

/*
	Will signal to start recieveing messages from queue
	queueName: Name of queue to start messages
	opts: Options to be passed onto amqp, see amqp docs
	handler: function to recieve messages
*/
rabbitMq.prototype.connectMessages = function(queueName, opts, handler) {
	//TODO: Try emit a 'you have message' sort of event as well as callback see which is best
	var self = this;
	if (self.queueEntries[queueName]) {
		var q = self.queueEntries[queueName].queue.subscribe(opts, function(message) {
			try {
				//attempt to parse data
				message.data = JSON.parse(message.data.toString('utf8'));
			} catch (e) {}
			handler(message);
		});

		q.addCallback(function(ok) {
			self.queueEntries[queueName].tag = ok.consumerTag;
			self.queueEntries[queueName].receiving = true;
		});
	}
}

/*
	Will connect to rabbitMq Queue
	queueName: name of queue to connect to
	opts: options to be passed onto amqp, see amqp docs
	cd: function to call with queue object once connected
*/
rabbitMq.prototype.connectQueue = function(queueName, opts, cb) {
	var self = this;
	if (self.connected && !self.queueEntries[queueName]) {
		self.connection.queue(queueName, opts, function(queue) {
			self.queueEntries[queueName] = {
				queue: queue,
				receiving: false
			};
			cb(null, queue);
		});
	} else {
		cb('Not Connected', null);
	}
}

/*
	Will bind routing to a queue
	queueName: name of queue to bind
	routing: routing string to bind to queue
*/
rabbitMq.prototype.bind = function(queueName, routing) {
	if (this.queueEntries[queueName])
		this.queueEntries[queueName].queue.bind(routing);
}

rabbitMq.prototype.message = function(name, message){
	if(this.connected)
		this.connection.publish(name, message);
}

module.exports = rabbitMq;