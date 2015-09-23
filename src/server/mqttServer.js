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
 
const iopaMQTTPacket = require('iopa-mqtt-packet');
     
const MQTTAutoAck = require('../middleware/mqttAutoAck.js')
    , MQTTSessionManager = require('../middleware/mqttSessionManager.js')
    , MQTTSessionClient = require('../middleware/mqttSessionClient.js');
    
const constants = require('iopa').constants,
    IOPA = constants.IOPA,
    SERVER = constants.SERVER,
    MQTT = constants.MQTT;
    
const MQTTMIDDLEWARE = {CAPABILITY: "urn:io.iopa:mqtt", PROTOCOLVERSION: "OASIS 3.1.1"},
    packageVersion = require('../../package.json').version;
    
/* *********************************************************
 * IOPA MQTT SERVER / CLIENT WITH MIDDLEWARE CONSTRUCTED
 * ********************************************************* */

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * MATT IOPA Server includes MQTT Client
 * 
 * @class CoAPServer
 * @param {object} options  
 * @param {appFunc} appFunc  Server callback in IOPA AppFunc format
 * @constructor
 */
function MQTTServer(app) {
   _classCallCheck(this, MQTTServer);
      
    app.properties[SERVER.Capabilities][MQTTMIDDLEWARE.CAPABILITY] = {};
    app.properties[SERVER.Capabilities][MQTTMIDDLEWARE.CAPABILITY][SERVER.Version] = packageVersion;
    app.properties[SERVER.Capabilities][MQTTMIDDLEWARE.CAPABILITY][IOPA.Protocol] = MQTTMIDDLEWARE.PROTOCOLVERSION;

    app.use(iopaMQTTPacket);
    app.use(MQTTSessionClient);
    app.use(MQTTAutoAck);
    app.use(MQTTSessionManager);
}

module.exports = MQTTServer;
