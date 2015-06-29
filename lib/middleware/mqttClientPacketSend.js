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
 * Parses IOPA request into MQTT packet
 * IOPA Default App in Client Pipeline
 *
 * @method invoke
 * @param context IOPA context dictionary
 */
module.exports = function MQTTClientPacketSend(context) {   
    try {
        // send the request
        MqttFormat.sendRequest(context);
        
   ///    TO DO CHANGE TO DEFAULT APP
    }
    catch (err) {
        console.log("Unable to send MQTT packet: " + err);
        context =null;
        return Promise.reject('Unable to parse IOPA Message into MQTT packet');
    }
  
     return Promise.resolve(context.response)
};