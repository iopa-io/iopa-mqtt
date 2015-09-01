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
 * @class MQTTMessageCreateDefaults
 * @this app.properties  the IOPA AppBuilder Properties Dictionary, used to add server.capabilities
 * @constructor
 * @public
 */
function MQTTMessageCreateDefaults(app) {
      app.properties["server.Capabilities"]["iopa-mqtt.Version"] = "1.2";
      app.properties["server.Capabilities"]["iopa-mqtt.Support"] = {
        "mqtt.Version": "3.1.1"
      };
 }

MQTTMessageCreateDefaults.prototype.invoke = function MQTTMessageCreateDefaults_invoke(context, next){
     context["server.CreateRequest"] = MQTTMessageCreateDefaults_createRequest.bind(this, context["iopa.Seq"], context["server.CreateRequest"]);
     return next();
};

 /**
 * MQTT IOPA Middleware for Client Message Request Defaults
 *
 * @method MQTTMessageCreateDefaults_createRequest
 * @parm {string} path url representation of ://127.0.0.1/hello
 * @parm {string} [method]  request method (e.g. 'GET')
 * @returns context
 * @public
 */
function MQTTMessageCreateDefaults_createRequest(id, nextFactory, urlStr, method){
    var context = nextFactory(urlStr, method);
      MqttFormat.defaultContext(context);
     return context;
};

module.exports = MQTTMessageCreateDefaults;