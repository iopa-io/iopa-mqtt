/*
 * Copyright (c) 2015 Internet of Protocols Alliance (IOPA)
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
 
const util = require('util')
 
const iopa = require('iopa')
     , mqtt = require('iopa-mqtt-packet')
     , IopaServer = require('iopa-server')
    
const MQTTAutoAck = require('../middleware/mqttAutoAck.js')
    , MQTTSessionManager = require('../middleware/mqttSessionManager.js')
    , MQTTSessionClient = require('../middleware/mqttSessionClient.js')
    
    const constants = require('iopa').constants,
    IOPA = constants.IOPA,
    SERVER = constants.SERVER,
    MQTT = constants.MQTT
    
/* *********************************************************
 * IOPA MQTT SERVER / CLIENT WITH MIDDLEWARE CONSTRUCTED
 * ********************************************************* */

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * MQTT IOPA Server includes MQTT Client
 * 
 * @class MQTTServer
 * @param {object} options  
 * @param {appFunc} appFunc  Server callback in IOPA AppFunc format
 * @constructor
 */
function MQTTServer(options, appFunc) {
  _classCallCheck(this, MQTTServer);
    
  if (typeof options === 'function') {
    appFunc = options;
    options = {};
  }
  
  IopaServer.call(this, options, appFunc);
        
   // INIT TCP SERVER
  this._mqtt = mqtt.createServer(options, this._serverRequestPipeline);
}

util.inherits(MQTTServer, IopaServer);

// PIPELINE SETUP METHODS OVERRIDES
/**
 * SERVER CHANNEL PIPELINE SETUP
 * @InheritDoc
 */
MQTTServer.prototype._serverChannelPipelineSetup = function (serverChannelApp) {
};

/**
 * SERVER MESSAGE PIPELINE SETUP
 * @InheritDoc
 */
MQTTServer.prototype._serverMessagePipelineSetup = function (app) {
    app.properties["server.Capabilities"]["iopa-mqtt.Version"] = "1.2";
    app.properties["server.Capabilities"]["iopa-mqtt.Support"] = {
      "mqtt.Version": "3.1.1"
      };
    app.use(MQTTSessionManager);
    app.use(MQTTAutoAck);
};

/**
 * CLIENT CHANNEL PIPELINE SETUP
 * @InheritDoc
 */
MQTTServer.prototype._clientConnectPipelineSetup = function (clientConnectApp) {
    clientConnectApp.properties[SERVER.Capabilities]["iopa-mqtt.Version"] = "1.2";
    clientConnectApp.properties[SERVER.Capabilities]["iopa-mqtt.Support"] = {
      "mqtt.Version": "3.1.1"
      };
  
   clientConnectApp.use(MQTTSessionClient);
   clientConnectApp.use(MQTTAutoAck);
};

/**
 * CLIENT MESSAGE PIPELINE SETUP
 * @InheritDoc
 */
MQTTServer.prototype._clientMessageSendPipelineSetup = function (clientMessageApp) {
  clientMessageApp.properties["server.Capabilities"]["iopa-mqtt.Version"] = "1.2";
  clientMessageApp.properties["server.Capabilities"]["iopa-mqtt.Support"] = {
    "mqtt.Version": "3.1.1"
  };
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
    return this._mqtt.listen(port, address);
};

Object.defineProperty(MQTTServer.prototype, "port", { get: function () { return this._mqtt.port; } });
Object.defineProperty(MQTTServer.prototype, "address", { get: function () { return this._mqtt.address; } });

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
  return this._mqtt.connect(urlStr);
};

/**
 * mqtt.close() Close MQTT Session 
 *
 * @method connect
 * @this MQTTServer MQTTServer instance
 * @returns {Promise()}
 * @public
 */
MQTTServer.prototype._close = function mqttServer_close() {
  return this._mqtt.close();
};

module.exports = MQTTServer;