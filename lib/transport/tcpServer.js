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
var TcpClient = require('./tcpClient.js');
var iopaStream = require('../common/iopaStream.js');

Promise.promisifyAll(net);

/* *********************************************************
 * IOPA TCP SERVER (GENERIC)  
 * ********************************************************* */

/**
 * Representes TCP Server
 *
 * @class TcpServer
 * @param options (object)  {currently unusued}
 * @param appFunc (function(context))   delegate to which to call with all new inbound requests
 * @event request function(context)    alternative way to get inbound requests
 * @event error function(err, args)
 * @constructor
 * @public
 */
function TcpServer(options, serverPipeline, clientPipeline) {
  if (typeof options === 'function') {
    serverPipeline = options;
    options = {};
  }

  this._options = options;

  if (serverPipeline)
  {
    this._appFunc = serverPipeline;
    this.on('data', this._invoke.bind(this));
  }
  
  if (clientPipeline)
  {
    this._tcpClient = new TcpClient(options, clientPipeline);
    this._clientMessagePipeline = clientPipeline;
  }
  
 }

util.inherits(TcpServer, events.EventEmitter)

/**
 * @method listen
 * Create socket and bind to local port to listen for incoming requests
 *
 * @param {Integer} [port] Port on which to listen
 * @param {String} [address] Local host address on which to listen
 * @returns {Promise} 
 * @public
 */
 TcpServer.prototype.listen = function TcpServer_listen(port, address) {
 
    if (port == undefined) 
    {
     port = 0;
    }
   
  if (this._tcp)
       return Promise.reject('Already listening');

    var that = this;

    this._tcp = net.createServer();
    this._tcp.on("connection", this._onConnection.bind(this));
    this._port = port;
    this._address = address;

    return this._tcp.listenAsync(port, address || '0.0.0.0').then(function(){
          that._linfo = that._tcp.address();
          that._port = that._linfo.port;
          that._address = that._linfo.address;
          
          return Promise.resolve(that._linfo);
    });
};

TcpServer.prototype._onConnection = function TcpServer_onConnection(socket) {
  console.log("TCP SERVER: NEW CONNECTION from " + socket.remoteAddress + ":" + socket.remotePort); 
   
  var context = iopaContextFactory.create();
  context["server.TLS"] = false;
  context["server.RemoteAddress"] = socket.remoteAddress;
  context["server.RemotePort"] = socket.remotePort;
  context["server.LocalAddress"] = this._address;
  context["server.LocalPort"] = this._port;
  context["server.RawStream"] = socket;
  
  var response = context.response;
  response["server.TLS"] = context["server.TLS"];
  response["server.RemoteAddress"] = context["server.TLS"];
  response["server.RemotePort"] = context["server.RemotePort"];
  response["server.LocalAddress"] = context["server.LocalAddress"];
  response["server.LocalPort"] = context["server.LocalPort"];
  response["server.RawStream"] = context["server.RawStream"];

  context["server.InProcess"] = false;
  context["server.RawStream"].on("end", this._onDisconnect.bind(this, context));
  this.emit("data", context);
};

TcpServer.prototype._onDisconnect = function TcpServer_onDisconnect(ctx) {
   console.log('tcp server: remote client disconnected');
   ctx["server.RawStream"].removeAllListeners('end');
   
    setTimeout(function() {
        iopaContextFactory.dispose(ctx);
         }, 1000);
    
   if (ctx["server.InProcess"])
     ctx["iopa.CallCancelledSource"].cancel('Client Socket Disconnected');
};

TcpServer.prototype._invoke = function TcpServer_invoke(context) {
  context["server.createRequest"] = this.createResponseRequest.bind(this, context);
 
  var that = this;
  var ctx = context;

  return this._appFunc(context).then(function(){
     ctx["server.InProcess"] = false;
     iopaContextFactory.dispose(ctx);
     that = null;
     ctx = null;
  });
};

/**
 * Creates a new IOPA TCP Client Connection using URL host and port name
 *
 * @method conect

 * @parm {string} urlStr url representation of Request://127.0.0.1:8002
 * @returns {Promise(context)}
 * @public
 */
TcpServer.prototype.connect = function TcpServer_connect(urlStr){
    return this._tcpClient.connect(urlStr);
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
 
TcpServer.prototype.createResponseRequest = function TcpServer_createResponseRequest(originalContext, path, method){
  var urlStr = originalContext["iopa.Scheme"] + 
   "://" +
   originalContext["server.remoteAddress"] + ":" + originalContext["server.remotePort"] + 
  originalContext["iopa.PathBase"] +
  originalContext["iopa.Path"] + path;
  
  var context = iopaContextFactory.createRequest(urlStr, method); 
  

  context["iopa.Body"] = new iopaStream.OutgoingRequestStream();
  context.response["iopa.Body"] = new iopaStream.IncomingMessageStream();
  
  //REVERSE STREAMS SINCE SENDING REQUEST (e.g., PUBLISH) BACK ON RESPONSE CHANNEL
  context["server.RawStream"] = originalContext.response["server.RawStream"];
  context.response["server.RawStream"] = originalContext["server.RawStream"];
  
  context["iopa.Body"].on("start", function(){
    context["server.InProcess"] = true;
  });
  
  var that = this; 
    
  context["iopa.Body"].on("finish", function(){
     var ctx = context;
     ctx["server.InProcess"] = true;
     return that._clientMessagePipeline(context).then(function(){
       iopaContextFactory.dispose(ctx);  
       that = null;
       ctx = null;
     });
  });
  
  return context;
};

/**
 * @method close
 * Close the underlying socket and stop listening for data on it.
 * 
 * @public
 */
TcpServer.prototype.close = function TcpServer_close() {
  // TO DO:  CANCEL ALL OPEN CONTEXTS (STORING ON CREATION)
  this._tcp.close();
}

module.exports = TcpServer;