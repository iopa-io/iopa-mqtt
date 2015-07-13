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

// DEPENDENCIES

var util = require('util')
  , Promise = require('bluebird')
  , MqttFormat = require('../common/mqttFormat.js');
  
/**
 * IOPA Middleware: Translates IOPA Stream Connections to IOPA Multi-Packet Connection 
 *
 * @class MQTTPacketServer
 * @this app.properties  the IOPA AppBuilder Properties Dictionary
 * @constructor
 */
function MQTTPacketServer(app) {
    app.properties["server.Capabilities"]["iopa-mqtt.Version"] = "1.2";
    app.properties["server.Capabilities"]["iopa-mqtt.Support"] = {
        "mqtt.Version": "3.1.1"
    };
}

/**
 * @method invoke
 * @this context IOPA channelContext dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTPacketServer.prototype.invoke = function MQTTPacketServer(channelContext, next) {
    
    MqttFormat.inboundParseMonitor(channelContext, "request");
    
    return next().then(function(){ return new Promise(function(resolve, reject){
           channelContext["mqttPacketServer.Close"] = resolve;
           channelContext["mqttPacketServer.Error"] = reject;
        }); 
    });
};

module.exports = MQTTPacketServer;