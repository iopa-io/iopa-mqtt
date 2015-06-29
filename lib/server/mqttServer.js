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
 
var util = require('util');
var Promise = require('bluebird');

var iopa = require('iopa');
var TcpServer = require('../transport/tcpServer.js');
var IopaServer = require('./iopaServer.js');
var MqttFormat = require('../common/mqttFormat.js');
var constants = require('iopa').constants;

var MQTTPacketServer = require('../middleware/mqttPacketServer.js');
var MQTTClientChannel = require('../middleware/mqttClientChannel.js');
var MQTTMessageCreateDefaults = require('../middleware/mqttMessageCreateDefaults.js');
var MQTTClientPacketSend = require('../middleware/mqttClientPacketSend.js');
var MQTTAutoAck = require('../middleware/mqttAutoAck.js');
var BackForth = require('../middleware/BackForth.js');
var ClientSend = require('../middleware/ClientSend.js');

/* *********************************************************
 * IOPA MQTT SERVER / CLIENT WITH MIDDLEWARE CONSTRUCTED
 * ********************************************************* */

/**
 * MQTT IOPA Server includes MQTT Client
 * 
 * @class MQTTServer
 * @param {object} options  
 * @param {appFunc} appFunc  Server callback in IOPA AppFunc format
 * @constructor
 */
function MQTTServer(options, appFunc) {
  if (!(this instanceof MQTTServer))
    return new MQTTServer(options, appFunc);
    
  if (typeof options === 'function') {
    appFunc = options;
    options = {};
  }
    
    /**
    * Call Parent Constructor to ensure the following are created
    *   this.serverPipeline
    *   this.clientPipeline
    */
   IopaServer.call(this, options, appFunc);
        
   // INIT TCP SERVER
  this._tcp = new TcpServer(options, this.serverPipeline, this.clientPipeline);
}

util.inherits(MQTTServer, IopaServer);

// PIPELINE SETUP METHODS OVERRIDES
/**
 * SERVER CHANNEL PIPELINE SETUP
 * @InheritDoc
 */
MQTTServer.prototype._serverChannelPipelineSetup = function (serverChannelApp) {
  serverChannelApp.use(MQTTPacketServer);
};

/**
 * SERVER MESSAGE PIPELINE SETUP
 * @InheritDoc
 */
MQTTServer.prototype._serverRequestPipelineSetup = function (app) {
    app.use(MQTTMessageCreateDefaults);
   app.use(MQTTAutoAck);
};

/**
 * CLIENT CHANNEL PIPELINE SETUP
 * @InheritDoc
 */
MQTTServer.prototype._clientChannelPipelineSetup = function (clientChannelApp) {
  clientChannelApp.use(MQTTMessageCreateDefaults);
  clientChannelApp.use(MQTTClientChannel);
  clientChannelApp.use(BackForth);
  clientChannelApp.use(ClientSend);
};

/**
 * CLIENT MESSAGE PIPELINE SETUP
 * @InheritDoc
 */
MQTTServer.prototype._clientMessagePipelineSetup = function (clientMessageApp) {
  clientMessageApp.properties["server.Capabilities"]["iopa-mqtt.Version"] = "1.2";
  clientMessageApp.properties["server.Capabilities"]["iopa-mqtt.Support"] = {
    "mqtt.Version": "3.1.1"
  };
  clientMessageApp.properties["app.DefaultApp"] = MQTTClientPacketSend;
};

// OVERRIDE METHODS

/**
 * mqtt.Listen()  Begin accepting connections on the specified port and hostname. 
 * If the hostname is omitted, the server will accept connections directed to any IPv4 address (INADDR_ANY).
 * 
 * @method listen
 * @param {integer} port  
 * @param {string} address (IPV4 or IPV6)
 * @returns promise completes when listening
 * @public
 */
MQTTServer.prototype._listen = function mqttServer_listen(port, address) {
   return this._tcp.listen(port, address);
};

/**
 * mqtt.connect() Create MQTT Session over TCP Channel to given Host and Port
 *
 * @method connect
 * @this MQTTServer MQTTServer instance
 * @parm {string} urlStr url representation of Request mqtt://127.0.0.1/hello
 * @returns {Promise(context)}
 * @public
 */
MQTTServer.prototype._connect = function mqttServer_connect(urlStr) {
  return this._tcp.connect(urlStr);
};

module.exports = MQTTServer;