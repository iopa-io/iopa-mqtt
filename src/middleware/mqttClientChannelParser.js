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

var Promise = require('bluebird')
    , util = require('util')
    , MqttFormat = require('../common/mqttFormat.js')
  
  /**
 * MQTT IOPA Middleware for Client Connection Defaults
 *
 * @class MQTTClientChannelParser
 * @this app.properties  the IOPA AppBuilder Properties Dictionary, used to add server.capabilities
 * @constructor
 * @public
 */
function MQTTClientChannelParser(app) {
    if (!app.properties["server.Capabilities"]["iopa-mqtt.Version"])
        throw ("Missing Dependency: MQTT Server/Middleware in Pipeline");

   app.properties["server.Capabilities"]["MQTTClientChannelParser.Version"] = "1.0";
}

MQTTClientChannelParser.prototype.invoke = function MQTTClientChannelParser_invoke(channelContext, next){
     MqttFormat.inboundParseMonitor(channelContext, "response");
     return next();
};

module.exports = MQTTClientChannelParser;
