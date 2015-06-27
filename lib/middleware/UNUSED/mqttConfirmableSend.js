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

const Events = require('events');
const LRU = require('lru-cache');
const constants = require('./common/constants.js');


/**
 * Coap IOPA Middleware for Auto Retrying Sends until Confirmed
 *
 * @class CoAPConfirmableSend
 * @param {dictionary} properties  the IOPA AppBuilder Properties Dictionary
 * @constructor
 */
function CoAPConfirmableSend(properties) {
    if (!properties["server.Capabilities"]["coap.Version"])
        throw ("Missing Dependency: COAP Server/Middleware in Pipeline");

    properties["server.Capabilities"]["coapConfirmableSend.Version"] = "1.0";
}

/**
 * @method invoke
 * @this context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
CoAPConfirmableSend.prototype.invoke = function CoAPConfirmableSend_invoke(context, next) {
    context["coapConfirmableSend_SendRawAsyncNext"] = context["server.SendRawAsync"];
    context["server.SendRawAsync"] = this._sendRawHook.bind(this, context);
    return next();
}

CoAPConfirmableSend.prototype._sendRawHook = function ConfirmableSend_sendRawHook(context, outgoingContext) {
    var sendWithRetry = false;
    
    var packet = context["coap.OutgoingPacket"];
    if (packet && !(packet.ack || packet.reset || packet.confirmable === false))
        sendWithRetry = true;

    if (sendWithRetry) {
        outgoingContext["CoAPConfirmableSend._retrySender"] = new retrySender(context["coapConfirmableSend_SendRawAsyncNext"]);
        return outgoingContext["CoAPConfirmableSend._retrySender"].send(outgoingContext);
    }
    else {
        return context["coapConfirmableSend_SendRawAsyncNext"](outgoingContext);
    }
}

/**
 * Internal UDP Sender that keeps retrying sends until reset by "coap.finish" event
 *
 * @class retrySender
 * @constructor
 * @private
 */
function retrySender(rawSender) {
    this._sendAttempts = 0;
    this._currentTime = constants.ackTimeout * (1 + (constants.ackRandomFactor - 1) * Math.random()) * 1000;
    this._rawSender = rawSender;
}

retrySender.prototype.send = function retrySender_send(responseData) {
    this._responseData = responseData;

    if (!responseData["owin.Events"])
        responseData["owin.Events"] = new Events.EventEmitter();

    var that1 = this;

    responseData["owin.Events"].on("coap.Finish", function(rData) {
        that1.reset();
        that1 = null;
    });

    var that2 = this;
    this._maxRetrytimer = setTimeout(function() {
        var err = new Error('No reply in ' + constants.exchangeLifetime + 's');
        err.retransmitTimeout = constants.exchangeLifetime;
        that2.emit('error', err);
        that2 = null;
    }, constants.exchangeLifetime * 1000);

    return this._sendWithTimeout();
}

retrySender.prototype._sendWithTimeout = function _retrySender_sendWithTimeout() {
    var that = this;
    return this._rawSender(this._responseData).then(function() {
        if (++that._sendAttempts <= constants.maxRetransmit)
            that._retryTimer = setTimeout(that._retry.bind(that), that._currentTime);
        that = null;
    });
}

retrySender.prototype._retry = function _retrySender_retry() {
    this._currentTime = this._currentTime * 2;
    this._responseData["coap.OutgoingDoNotCache"] = true;
    return this._sendWithTimeout();
}

retrySender.prototype.reset = function _retrySender_reset() {
    clearTimeout(this._maxRetrytimer)
    clearTimeout(this._retryTimer)
    delete this._maxRetrytimer;
    delete this._retryTimer;
    var responseData = this._responseData;
    for (var prop in responseData) {
        if (responseData.hasOwnProperty(prop)) {
            delete responseData[prop];
        }
    }
}

module.exports = CoAPConfirmableSend; 