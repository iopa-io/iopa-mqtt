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

var iopaStream = require('iopa-common-stream');

const constants = require('iopa').constants,
    IOPA = constants.IOPA,
    SERVER = constants.SERVER,
    MQTT = constants.MQTT
    
 const THISMIDDLEWARE = {CAPABILITY: "urn:io.iopa:mqtt:autoack", TIMER: "autoack.Timer", DONE: "autoack.Done"},
      MQTTMIDDLEWARE = {CAPABILITY: "urn:io.iopa:mqtt"},
     packageVersion = require('../../package.json').version;
   
/**
 * MQTT IOPA Middleware for Auto Acknowledging Server Requests
 *
 * @class MQTTAutoAck
 * @this app.properties  the IOPA AppBuilder Properties Dictionary, used to add server.capabilities
 * @constructor
 * @public
 */
function MQTTAutoAck(app) {
   if (!app.properties[SERVER.Capabilities][MQTTMIDDLEWARE.CAPABILITY])
        throw ("Missing Dependency: IOPA MQTT Server/Middleware in Pipeline");
     
    app.properties[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY] = {};
    app.properties[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][SERVER.Version] = packageVersion;
}

/**
 * @method invoke
 * @this context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTAutoAck.prototype.invoke = function MQTTAutoAck_invoke(context, next) {
    
      var p = new Promise(function(resolve, reject){
        context[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.DONE] = resolve;
    }); 
 
    
    if(context[SERVER.IsLocalOrigin])
    {
         context[IOPA.Events].on(IOPA.EVENTS.Response, this._invokeOnParentResponse.bind(this, context)); 
        return next();
    } 
   
   // SERVER
    
    if ([MQTT.METHODS.CONNACK, MQTT.METHODS.PINGRESP].indexOf(context.response[IOPA.Method]) >=0)
    {  
       context[SERVER.RawStream] = new iopaStream.OutgoingStreamTransform(this._write.bind(this, context, context.response[SERVER.RawStream]));  
            context[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.TIMER] = setTimeout(function() {
                context.response[IOPA.Body].end();
                context[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.TIMER] = null;
            }, 50);
    }
    
     if ([MQTT.METHODS.SUBACK].indexOf(context.response[IOPA.Method]) >=0)
    {  
       context.response[SERVER.RawStream] = new iopaStream.OutgoingStreamTransform(this._write.bind(this, context, context.response[SERVER.RawStream]));  
            context[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.TIMER] = setTimeout(function() {
                context.response[IOPA.Body].write("");
                context[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.TIMER] = null;
                }, 50);
    }
   
   return next().then(function(){ return p });
};

/**
 * @method _invokeOnParentResponse
 * @this CacheMatch
 * @param channelContext IOPA parent context dictionary
 * @param context IOPA childResponse context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTAutoAck.prototype._invokeOnParentResponse = function MQTTAutoAck_invokeOnParentResponse(channelContext, context) {
    if ([MQTT.METHODS.PUBACK].indexOf(context.response[IOPA.Method]) >=0)
    {  
        process.nextTick(function() {
          context.response[IOPA.Body].end();
          context[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.DONE]();
        });
    }
};

/**
 * @method _write
 * @this context IOPA context dictionary
 * @param nextStream  Raw Stream to send transformed data to
 * @param chunk     String | Buffer The data to write
 * @param encoding String The encoding, if chunk is a String
 * @param callback Function Callback for when this chunk of data is flushed
 * @private
*/
MQTTAutoAck.prototype._write = function MQTTAutoAck_write(context, nextStream, chunk, encoding, callback) {
    if (context[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.TIMER])
    {
        clearTimeout(context[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.TIMER]);
        context[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.TIMER] = null;
         context[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.DONE]();
    }
 
    nextStream.write(chunk, encoding, callback);
};

module.exports = MQTTAutoAck;