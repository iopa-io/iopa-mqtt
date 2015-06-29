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
var net = require('net');
var util = require('util');
var events = require('events');
var Duplex = require('stream').Duplex;

var iopaStream = require('../common/iopaStream.js');
var iopaContextFactory = require('iopa').context.factory;

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
function TcpClient(options, clientMessagePipeline) { 
   events.EventEmitter.call(this);
  
  this._options = options;
  this._clientMessagePipeline = clientMessagePipeline;
}

util.inherits(TcpClient, events.EventEmitter);

 /**
 * Creates a new IOPA Request using a Tcp Url including host and port name
 *
 * @method connect

 * @parm {object} options not used
 * @parm {string} urlStr url representation of ://127.0.0.1:8200
 * @public
 * @constructor
 */
 TcpClient.prototype.connect = function TcpClient_connect(urlStr){
     
  var channelContext = iopaContextFactory.createRequest(urlStr, "TCP");
  channelContext["tcp._BaseUrl"] = urlStr;
  channelContext["server.createRequest"] = TcpClient_CreateRequest.bind(this, channelContext);
  
  var that = this;
  return new Promise(function(resolve, reject){
  console.log("TCP CONNECTING TO " + channelContext["server.RemoteIpAddress"] + ":" + channelContext["server.RemotePort"]);
      var socket = net.createConnection(
        channelContext["server.RemotePort"], 
        channelContext["server.RemoteAddress"],
        function() {
          channelContext["server.RawStream"] = socket;
          channelContext["server.LocalAddress"] = socket.localAddress;
          channelContext["server.LocalPort"] = socket.localPort;
          channelContext["server.RawStream"].on('finish', that.close.bind(that, channelContext));
          resolve(channelContext);
         });
     });
 };
 
/**
 * Creates a new IOPA Request using a Tcp Url including host and port name
 *
 * @method TcpClient_CreateRequest

 * @parm {string} urlStr url representation of ://127.0.0.1/hello
 * @parm {string} [method]  request method (e.g. 'GET')
 * @returns {Promise(context)}
 * @public
 */
function TcpClient_CreateRequest(channelContext, path, method){
  
  var urlStr = channelContext["tcp._BaseUrl"] + path;
  var context = iopaContextFactory.createRequest(urlStr, method); 
  
  context["iopa.Body"] = new iopaStream.OutgoingStream();
  context.response["iopa.Body"] = new iopaStream.IncomingMessageStream();
  
  context["server.RawStream"] = channelContext["server.RawStream"];
  context.response["server.RawStream"] = channelContext.response["server.RawStream"];
  
  context["iopa.Body"].on("start", function(){
    context["server.InProcess"] = true;
  });
  
   var that = this; 
 
  context["iopa.Body"].on("finish", function(){
     var ctx = context;
     ctx["server.InProcess"] = true;
     return that._clientMessagePipeline(context).then(function(){
         console.log("CLIENT COMPLETE");
         ctx["server.InProcess"] = false;
     //    iopaContextFactory.dispose(ctx);
       that = null;
       ctx = null;
     });
  });
  
  return context;
};

/**
 * @method close
 * Close the  channel context
 * 
 * @public
 */
TcpClient.prototype.close = function TcpClient_close(channelContext) {
  iopaContextFactory.dispose(channelContext);
}

module.exports = TcpClient;