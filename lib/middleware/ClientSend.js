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
    
    var Promise = require('bluebird');
    
/**
 * MQTT IOPA Middleware 
 *
 * @class ClientSend
 * @this app.properties  the IOPA AppBuilder Properties Dictionary, used to add server.capabilities
 * @constructor
 * @public
 */
function ClientSend(app) {
     app.properties["server.Capabilities"]["ClientSend.Version"] = "1.0";
}

/**
 * @method invoke
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
ClientSend.prototype.invoke = function ClientSend_invoke(context, next) {
    context["server.createRequest"] = this._client_createRequest.bind(this, context, context["server.createRequest"]);
     return next();
};


/**
 * Context Func(tion) to create a new IOPA Request using a Tcp Url including host and port name
 *
 * @method createRequest

 * @parm {string} path url representation of ://127.0.0.1/hello
 * @parm {string} [method]  request method (e.g. 'GET')
 * @returns {Promise(context)}
 * @public
 */
ClientSend.prototype._client_createRequest = function BackForth_client_createRequest(context, nextFactory, path, method){
    var childContext = nextFactory(path, method);
    childContext["iopa.Body"].send = this._client_send.bind(childContext);
    childContext["iopa.Body"].observe = this._client_observe.bind(childContext);
    childContext["iopa.Events"].on("response", this.client_invokeOnResponse.bind(this, childContext));
    return childContext;
};


/**
 * @method _client_send
 * @this context IOPA context dictionary
 * @param buf   optional data to write
 */
ClientSend.prototype._client_send = function ClientSend_client_send(buf){
    var context = this;
    return new Promise(function(resolve, reject){
        context["clientSend.SendPromiseClose"] = resolve;
        context["iopa.Body"].end(buf);
    }); 
};

/**
 * @method _client_send
 * @this context IOPA context dictionary
 * @param buf   optional data to write
 */
ClientSend.prototype._client_observe = function ClientSend_client_observe(callback){
    var context = this;
    return new Promise(function(resolve, reject){
        context["clientSend.ObserveCallback"] = callback;
        context["iopa.Body"].end();
    }); 
};

/**
 * @method _client_invokeOnParentResponse
 * @param context IOPA request context dictionary
 * @param responseContext IOPA responseContext context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
ClientSend.prototype.client_invokeOnResponse = function ClientSend_client_invokeOnResponse(context, responseContext) {
    if ("clientSend.SendPromiseClose" in context)
       context["clientSend.SendPromiseClose"](responseContext);
    
     if ("clientSend.ObserveCallback" in context)
       context["clientSend.ObserveCallback"](responseContext);
};

module.exports = ClientSend;