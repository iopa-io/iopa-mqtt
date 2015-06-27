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

const Promise = require('bluebird');
const LRU = require('lru-cache');
const constants = require('./common/constants.js');
const helpers = require('./common/helpers.js');

// GLOBALS

/** 
 * LRU exposed as context["server.Capabilities"]["coapCache.Support"]["coapCache.cache"].lru
 *
 * LRU cache for responses to avoid DDOS etc.
 * max packet size is 1280
 * 32 MB / 1280 = 26214
 * The max lifetime is roughly 200s per packet.
 * Which equates to ~131 packets/second
 *
 * @private
 */
var _lru = LRU({
    max: (32768 * 1024),
    length: function(n) {
        return n.length
    },
    maxAge: constants.exchangeLifetime,
    dispose: function(key, value) {
        if (value["iopa.Events"])
            value["iopa.Events"].emit("coap.Finish");
        for (var prop in value) {
            if (value.hasOwnProperty(prop)) {
                delete value[prop];
            }
        };
    }
});

/**
 * Coap IOPA Middleware for Cache of Outgoing Messages on Servers/Clients
 *
 * @class CoAPCacheServer
 * @constructor
 * @public
 */
function CoAPCache(properties) {
    properties["server.Capabilities"]["coapCache.Version"] = "1.0";
    properties["server.Capabilities"]["coapCache.Support"] = {
        "coapCache.cache": this
    };
}

CoAPCache.prototype.lru = function() {
    return _lru;
};

/**
 * @method invoke
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
CoAPCache.prototype.invoke = function CoAPCache_invoke(context, next) {
    //HOOK INTO SEND PACKET PIPELINE
    context["coapCache._SendRawAsyncNext"] = context["server.SendRawAsync"];
    context["server.SendRawAsync"] = this._sendRawHook.bind(this, context);
    return next();
};

CoAPCache.prototype._sendRawHook = function _CoAPCache_sendRawHook(originalContext, outgoingContext) {
  
    if (!outgoingContext["coap.OutgoingDoNotCache"]) {
        var cacheData = {
            "server.InProcess": originalContext["server.InProcess"],
            "server.IsLocal": originalContext["server.IsLocal"],
            "iopa.CallCancelledSource": originalContext["iopa.CallCancelledSource"],
            "iopa.Events": originalContext["iopa.Events"],
            "server.OutgoingRaw": outgoingContext["server.OutgoingRaw"]
        };

        _lru.set(helpers.lruToKey(originalContext["server.IsLocal"] ? "request" : "response", originalContext, originalContext["coap.MessageId"], originalContext["coap.Token"]), cacheData);
  
        originalContext.response["iopa.Body"].on('closing', this._closeContext.bind(this, originalContext));
    }
    

    return originalContext["coapCache._SendRawAsyncNext"](outgoingContext);
}

CoAPCache.prototype._closeContext = function _CoAPCache_closeContext(originalContext) {
   _lru.del(helpers.lruToKey(originalContext["server.IsLocal"] ? "request" : "response", originalContext, originalContext["coap.RequestMessageId"], originalContext["coap.Token"]));
}

module.exports = CoAPCache;

/* *********************************************************
 * IOPA MIDDLEWARE: COAP CACHE MIDDLEWARE SERVER EXTENSIONS
 * ********************************************************* */

/**
 * Coap IOPA Middleware for Cache Handling on Incoming Server Requests
 *
 * @class CoAPCacheServer
 * @constructor
 * @public
 */
function CoAPCacheMatchRequest(properties) {
    if (!properties["server.Capabilities"]["coap.Version"])
        throw ("Missing Dependency: COAP Server/Middleware in Pipeline");

    if (!properties["server.Capabilities"]["coapCache.Version"])
        throw ("Missing Dependency: CoAP coapCache Server/Middleware in Pipeline");

    this._lru = properties["server.Capabilities"]["coapCache.Support"]["coapCache.cache"].lru();

    properties["server.Capabilities"]["coapCacheServerRequest.Version"] = "1.0";
}

/**
 * @method invoke
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
CoAPCacheMatchRequest.prototype.invoke = function CoAPCacheMatchRequest_invoke(context, next) {

    // SERVER REQUESTS ONLY;  IGNORE CLIENT RESPONSES
    if (!context["server.IsServerRequest"])
        return next();

    //CHECK CACHE
    var lru = this._lru;
    var cachedOriginal = lru.peek(helpers.lruToKey("response", context, context["coap.RequestMessageId"], context["coap.RequestToken"]))

    //  if (cachedOriginal && !context["coap.RequestAck"] && !context["coap.RequestReset"])
    //  return this._resend(context, cachedOriginal).then(next());
    //else
    if (cachedOriginal && (context["coap.RequestAck"] || context["coap.RequestReset"])) {
        if (cachedOriginal["server.InProcess"] && context["coap.RequestReset"])
            cachedOriginal["iopa.CallCancelledSource"].cancel('Reset Packet Received');

        lru.del(helpers.lruToKey("response", context, context["coap.RequestMessageId"], context["coap.RequestToken"]));

        return next()
    }
    else if (context["coap.RequestAck"] || context["coap.RequestReset"]) {
        return Promise.resolve(null) // IGNORE SILENTLY DO NOT CONINUE PROCESSING
    }
    else if (cachedOriginal) {
        if (cachedOriginal["server.InProcess"]) {
            return Promise.resolve(null)
        }
    }
    return next();
}

CoAPCacheMatchRequest.prototype._resend = function CoAPCacheMatchRequest_resend(context, outgoingContext) {
    outgoingContext["coap.OutgoingDoNotCache"] = true;
    return context["coapCache._SendRawAsyncNext"](outgoingContext);
}

module.exports.CoAPCacheMatchRequest = CoAPCacheMatchRequest;

/**
 * Coap IOPA Middleware for Cache Handling on Incoming Server Responses for Client
 *
 * @class CoAPCacheClientResponse
 * @constructor
 * @public
 */
function CoAPCacheMatchResponse(properties) {
    if (!properties["server.Capabilities"]["coap.Version"])
        throw ("Missing Dependency: COAP Server/Middleware in Pipeline");

    if (!properties["server.Capabilities"]["coapCache.Version"])
        throw ("Missing Dependency: CoAP coapCache Server/Middleware in Pipeline");

    this._lru = properties["server.Capabilities"]["coapCache.Support"]["coapCache.cache"].lru();

    properties["server.Capabilities"]["CoAPCacheMatchResponse.Version"] = "1.0";
}

/**
 * @method invoke
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
CoAPCacheMatchResponse.prototype.invoke = function CoAPCacheMatchResponse_invoke(context, next) {

    // CLIENT RESPONSES ONLY;  IGNORE SERVER REQUESTS
    if (context["server.IsServerRequest"])
        return next();

    //CHECK CACHE
    var lru = this._lru;
    var cachedOriginal = lru.peek(helpers.lruToKey("request", context, context["coap.ResponseMessageId"], context["coap.ResponseToken"]))

    if (cachedOriginal && context["coap.RequestReset"]) {
        if (cachedOriginal["server.InProcess"])
            cachedOriginal["iopa.CallCancelledSource"].cancel('Reset Packet Received');
            lru.del(helpers.lruToKey("request", context, context["coap.RequestMessageId"], context["coap.RequestToken"]));
        return Promise.resolve(null);
    }
    else if (context["coap.RequestAck"] || context["coap.RequestReset"]) {
        return Promise.resolve(null); // IGNORE SILENTLY DO NOT CONINUE PROCESSING
    }
    else if (cachedOriginal) {
        if (cachedOriginal["server.InProcess"]) {
            cachedOriginal["iopa.Events"].emit("coap.MatchResponse", context); // TRANSFER ONTO EVENTS PIPELINE, CLOSE THIS NEW ONE
            return Promise.resolve(null);
        }
        else {
            return next();
        }
    }
    return next();
}

module.exports.CoAPCacheMatchResponse = CoAPCacheMatchResponse;
