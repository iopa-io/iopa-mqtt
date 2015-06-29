/*
 * Copyright (c) 2015 Limerun Project Contributors
 * Portions Copyright (c) 2015 Internet of Protocols Assocation (IOPA)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Promise = require('bluebird');

var iopa = require('iopa');

/* *********************************************************
 * IOPA DEFAULT SERVER / CLIENT WITH MIDDLEWARE PIPELINES
 * ********************************************************* */

/**
 * IOPA Server includes IOPA Client
 * 
 * @class IOPAServer
 * @param {object} options  
 * @param {appFunc} appFunc  Server callback in IOPA AppFunc format
 * @constructor
 */
function IOPAServer(options, appFunc) {
  if (!(this instanceof IOPAServer))
    return new IOPAServer(options, appFunc);

  if (typeof options === 'function') {
    appFunc = options;
    options = {};
  }

  EventEmitter.call(this);
  
  //  this.serverChannelPipeline  (@protected)
  var serverChannelApp = new iopa.App();
  serverChannelApp.use(this._server_invokeOnConnection.bind(this));
  this._serverChannelPipelineSetup.call(this, serverChannelApp);
  this.serverChannelPipeline = serverChannelApp.build();
  
  // this._serverMessagePipeline   (@private)
  this._appFunc = appFunc;
  var serverMessageApp = new iopa.App();
  this._serverMessagePipelineSetup.call(this, serverMessageApp);
  serverMessageApp.use(this.server_invokeOnMessage.bind(this));
  this._serverMessagePipeline = serverMessageApp.build();
  
  // this.clientChannelPipeline   (@protected)
  var clientChannelApp = new iopa.App();
  this._clientChannelPipelineSetup.call(this, clientChannelApp);
  clientChannelApp.use(this._clientChannelInvoke);
  this._clientChannelPipeline = clientChannelApp.build();
  
  // this.clientMessagePipeline  (@private)
  var clientMessageApp = new iopa.App();
  this._clientMessagePipelineSetup.call(this, clientMessageApp);
  clientMessageApp.use(this._clientMessageInvoke.bind(this));
  this.clientMessagePipeline = clientMessageApp.build();
}

util.inherits(IOPAServer, EventEmitter);

/**
 * server.Listen()  Begin accepting connections using the specified arguments. 
 * 
 * @method listen
 * @returns promise completes when listening
 * @public 
 */
IOPAServer.prototype.listen = function () {
   return this._listen.apply(this, arguments);
};

/**
 * mqtt.createChannel() Create MQTT Session over TCP Channel to given Host and Port
 *
 * @method createChannel
 * @this MQTTServer MQTTServer instance
 * @parm {string} urlStr url representation of Request mqtt://127.0.0.1/hello
 * @returns {Promise(context)}
 * @public
 */
IOPAServer.prototype.createChannel = function (urlStr) {
  var that = this;
  return this._createChannel.call(this, urlStr).then(function(client){
      return that._clientChannelPipeline(client);
  });
};

// MUSTINERIT METHODS

/**
 * SERVER CHANNEL PIPELINE SETUP
 * Create Middleware Pipeline for Each Server Channel Connection
 *
 * @method _serverChannelPipelineSetup
 * @app IOPA Application Instance
 * @returns void
 * @public MUSTINHERIT
 */
IOPAServer.prototype._serverChannelPipelineSetup = function (app) {
};

/**
 * SERVER MESSAGE PIPELINE SETUP
 * Create Middleware Pipeline for Each Server Request Message
 *
 * @method _serverMessagePipelineSetup
 * @app IOPA Application Instance
 * @returns void
 * @public MUSTINHERIT
 */
IOPAServer.prototype._serverMessagePipelineSetup = function (app) {
};

/**
 * CLIENT CHANNEL PIPELINE SETUP
 * Create Middleware Pipeline for Each Client Channel Connection
 *
 * @method _clientChannelPipelineSetup
 * @app IOPA Application Instance
 * @returns void
 * @public MUSTINHERIT
 */
IOPAServer.prototype._clientChannelPipelineSetup = function (app) {
};

/**
 * SERVER MESSAGE PIPELINE SETUP
 * Create Middleware Pipeline for Each Outgoing CLient Request
 *
 * @method _clientMessagePipelineSetup
 * @app IOPA Application Instance
 * @returns void
 * @public MUSTINHERIT
 */
IOPAServer.prototype._clientMessagePipelineSetup = function (app) {
};


/**
 * server._listen()  Helper Method to begin accepting connections on the specified port and hostname. 
 * 
 * @method _listen
 * @returns promise completes when listening 
 * @protected @MustOverride
 */
IOPAServer.prototype._listen = function () {
   return Promise.reject("Must override listen");
};

/**
 * server._createChannel() Create MQTT Session over TCP Channel to given Host and Port
 *
 * @method createChannel
 * @this MQTTServer MQTTServer instance
 * @parm {string} urlStr url representation of Request mqtt://127.0.0.1/hello
 * @returns {Promise(context)}
 * @public
 */
IOPAServer.prototype._createChannel = function (urlStr) {
   return Promise.reject("Must override createChannel");
};

// PIPELINE MIDDLEWARE METHODS

/**
 * SERVER CHANNEL PIPELINE INVOKE
 * Middleware called for each Server Request (at start of TCP Channel Session)
 *
 * @method _serverChannelInvoke
 * @this MQTTServer MQTTServer instance
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 * @protected
 */
 IOPAServer.prototype._serverChannelInvoke = function IOPAServer_serverChannelInvoke(channelContext, next) {
   channelContext["iopa.Events"].on("request", this._serverMessagePipeline);
   return next();
};

/**
 * SERVER MESSAGE PIPELINE INVOKE
 * Middleware called for each Server IOPA Message (many such requests per session)
 *
 * @method server_invokeOnMessage
 * @this MQTTServer MQTTServer instance
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 * @protected
 */
 IOPAServer.prototype._serverMessageInvoke = function IOPAServer_serverMessageInvoke(context, next) {
    // Call External AppFunc
   return this._appFunc(context).then(next);
 };
 
/**
 * CLIENT CHANNEL PIPELINE INVOKE
 * Middleware called for each Server Request (at start of TCP Channel Session)
 *
 * @method _clientChannelInvoke
 * @this MQTTServer MQTTServer instance
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 * @protected
 */
 IOPAServer.prototype._clientChannelInvoke = function IOPAServer_clientChannelInvoke(channelContext, next) {
   // This is last middleware component in pipeline, ignore remainder/default app
   return Promise.resolve(channelContext);
};

 /**
 * CLIENT MESSAGE PIPELINE INVOKE
 * Middleware Called on Each Outbound Client Message Request
 * 
 * @method _clientMessageInvoke
 * @this MQTTServer MQTTServer instance
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 * @protected
 */
IOPAServer.prototype._clientMessageInvoke = function IOPAServer_clientMessageInvoke(context, next) {
  // Do nothings as all business logic in pipeline middelware components
  // Included for completeness and to override in inherited classes
    return next();
 };

module.exports = IOPAServer;