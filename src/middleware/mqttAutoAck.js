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

var iopaStream = require('iopa-common-stream');
    
/**
 * MQTT IOPA Middleware for Auto Acknowledging Server Requests
 *
 * @class MQTTAutoAck
 * @this app.properties  the IOPA AppBuilder Properties Dictionary, used to add server.capabilities
 * @constructor
 * @public
 */
function MQTTAutoAck(app) {
    if (!app.properties["server.Capabilities"]["iopa-mqtt.Version"])
        throw ("Missing Dependency: MQTT Server/Middleware in Pipeline");

   app.properties["server.Capabilities"]["MQTTAutoAck.Version"] = "1.0";
}


/**
 * @method invoke
 * @this context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTAutoAck.prototype.invoke = function MQTTAutoAck_invoke(context, next) {
    
    if(context["server.IsLocalOrigin"])
    {
         context["iopa.Events"].on("response", this._invokeOnParentResponse.bind(this, context)); 
        return next();
    } 
   
   // SERVER
    
    if (["CONNACK", "PINGRESP"].indexOf(context.response["iopa.Method"]) >=0)
    {  
       context["server.RawStream"] = new iopaStream.OutgoingStreamTransform(this._write.bind(this, context, context.response["server.RawStream"]));  
            context["MQTTAutoAck._acknowledgeTimer"] = setTimeout(function() {
                context.response["iopa.Body"].end();
                context["MQTTAutoAck._acknowledgeTimer"] = null;
            }, 50);
    }
    
     if (["SUBACK"].indexOf(context.response["iopa.Method"]) >=0)
    {  
       context.response["server.RawStream"] = new iopaStream.OutgoingStreamTransform(this._write.bind(this, context, context.response["server.RawStream"]));  
            context["MQTTAutoAck._acknowledgeTimer"] = setTimeout(function() {
                context.response["iopa.Body"].write("");
                context["MQTTAutoAck._acknowledgeTimer"] = null;
                }, 50);
    }
   
    return next();
};

/**
 * @method _invokeOnParentResponse
 * @this CacheMatch
 * @param channelContext IOPA parent context dictionary
 * @param context IOPA childResponse context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTAutoAck.prototype._invokeOnParentResponse = function MQTTAutoAck_invokeOnParentResponse(channelContext, context) {
    if (["PUBACK"].indexOf(context.response["iopa.Method"]) >=0)
    {  
        context.response["iopa.Body"].end();
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
    if (context["MQTTAutoAck._acknowledgeTimer"])
    {
        clearTimeout(context["MQTTAutoAck._acknowledgeTimer"]);
    }
 
    nextStream.write(chunk, encoding, callback);
};

module.exports = MQTTAutoAck;