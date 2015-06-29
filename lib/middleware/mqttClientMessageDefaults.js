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
 * MQTT IOPA Middleware for Client Message Request Defaults
 *
 * @method MQTTClientMessageDefaults_invoke
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 * @returns promise
 * @public
 */
module.exports = function MQTTClientMessageDefaults_invoke(context, next){
     MqttFormat.defaultContext(context);
     return next();
};