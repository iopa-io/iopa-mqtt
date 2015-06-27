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
 
 const util = require('util') ,
 iopaStream = require('../common/iopaStream.js');

/**
 * MQTT IOPA Middleware:  Log each incoming message
 *
 * @class MQTTLog
 * @this app.properties  the IOPA AppBuilder Properties Dictionary
 * @constructor
 */
function MQTTLog(properties) {
    if (!properties["server.Capabilities"]["iopa-mqtt.Version"])
        throw ("Missing Dependency: MQTT Server/Middleware in Pipeline");

    properties["server.Capabilities"]["mqtt.Log"] = "1.0";
}

/**
 * @method invoke
 * @this context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTLog.prototype.invoke = function MQTTLog_invoke(context, next) {   
    context.response["server.RawStream"] = new iopaStream.OutgoingStreamTransform(this._write.bind(this, context, context.response["server.RawStream"]));  
   
    if(context["server.IsLocal"])
    {
        return next();
    } else if (context["server.IsServerRequest"]) {
        console.log("REQUEST IN " + _requestLog(context))
        return next();
    }
    else {
        console.log("RESPONSE IN " + _responseLog(context));
        return next();
    }
}

/**
 * @method _write
 * @param context IOPA context dictionary
 * @param nextStream Stream The raw stream saved that is next in chain for writing
 * @param chunk     String | Buffer The data to write
 * @param encoding String The encoding, if chunk is a String
 * @param callback Function Callback for when this chunk of data is flushed
 * @private
*/
MQTTLog.prototype._write = function _MQTTLog_write(context, nextStream, chunk, encoding, callback) {
   
    if(context["server.IsLocal"])
        {
            console.log("REQUEST OUT " + _requestLog(context));
        }
        else {
            console.log("RESPONSE OUT " + _responseLog(context));
      }

    nextStream.write(chunk, encoding, callback);
};

function _url(context)
{
    return  context["iopa.Scheme"] 
    + "//" + context["server.RemoteAddress"] 
    + ":" + context["server.RemotePort"] 
    + context["iopa.Path"]
    + (context["iopa.QueryString"]  ? + context["iopa.QueryString"]  : "");
}


function _requestLog(context)
{
    return  context["mqtt.MessageId"] + " " + context["iopa.Method"] +" "
        +  _url(context) 
        + "  " + context["iopa.Body"].toString();
}

function _responseLog(context)
{
    var response = context.response;
    return  response["mqtt.MessageId"]+ " "
   + response["iopa.StatusCode"] + " " 
    + response["iopa.ReasonPhrase"] 
    + " [" + response["server.RemoteAddress"] 
    + ":" + response["server.RemotePort"] + "]" + "  " 
    + response["iopa.Body"].toString();
}

module.exports = MQTTLog;
