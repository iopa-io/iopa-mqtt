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

// DEPENDENCIES
var Promise = require('bluebird');
var iopaContextFactory = require('iopa').context.factory;
var net = require('net');
var util = require('util');
var events = require('events');
var iopaStream = require('../common/iopaStream.js');

/* *********************************************************
 * IOPA TCP CLIENT (GENERIC)  
 * ********************************************************* */

 /**
 * Creates a new IOPA Request using a Tcp Url including host and port name
 *
 * @method TcpClient

 * @parm {object} options not used
 * @parm {string} urlStr url representation of ://127.0.0.1:8200
 * @public
 * @constructor
 */
function TcpClient(options) { 
   events.EventEmitter.call(this);
  
  this._options = options;
}

util.inherits(TcpClient, events.EventEmitter);

 /**
 * Creates a new IOPA Request using a Tcp Url including host and port name
 *
 * @method TcpClient

 * @parm {object} options not used
 * @parm {string} urlStr url representation of ://127.0.0.1:8200
 * @public
 * @constructor
 */
 TcpClient.prototype.connect = function TcpClient_connect(urlStr){
     
  var context = iopaContextFactory.createRequest(urlStr, "TCP");
  context["tcp._BaseUrl"] = urlStr;
  context["server.createRequest"] = this.createRequest.bind(this, context);
  
  var that = this;
  return new Promise(function(resolve, reject){
  console.log("TCP CONNECTING TO " + context["server.RemoteIpAddress"] + ":" + context["server.RemotePort"]);
      var socket = net.createConnection(
        context["server.RemotePort"], 
        context["server.RemoteAddress"],
        function() {
          context["server.RawStream"] = socket;
          context["server.LocalAddress"] = socket.localAddress;
          context["server.LocalPort"] = socket.localPort;
          context["server.RawStream"].on('finish', that._closeContext.bind(that, context));
          resolve(context);
         });
     });
 };
 
/**
 * Creates a new IOPA Request using a Tcp Url including host and port name
 *
 * @method createRequest

 * @parm {string} urlStr url representation of ://127.0.0.1/hello
 * @parm {string} [method]  request method (e.g. 'GET')
 * @returns {Promise(context)}
 * @public
 */
TcpClient.prototype.createRequest = function TcpClient_CreateRequest(parentContext, path, method, appFunc){
  var urlStr = parentContext["tcp._BaseUrl"] + path;
  var context = iopaContextFactory.createRequest(urlStr, method); 
  
  context["iopa.Body"] = new iopaStream.OutgoingStream();
  context.response["iopa.Body"] = new iopaStream.IncomingMessageStream();
  
  context["server.RawStream"] = parentContext["server.RawStream"];
  context.response["server.RawStream"] = parentContext.response["server.RawStream"];
  
  context["iopa.Body"].on("start", function(){
    context["server.InProcess"] = true;
  });
  
   var that = this; 
 
  context["iopa.Body"].on("finish", function(){
     var ctx = context;
     ctx["server.InProcess"] = true;
     return appFunc(context).then(function(){
       that._closeContext(ctx);  
       that = null;
       ctx = null;
     });
  });
  
  return context;
};


/**
 * Close and clean up context after response client processing complete
 * @private
 */
TcpClient.prototype._closeContext = function TcpClient_closeContext(context) {
  context["server.InProcess"] = false;
  for (var prop in context) { if (context.hasOwnProperty(prop)) { delete context[prop]; } };
  iopaContextFactory.free(context);
}

module.exports = TcpClient;