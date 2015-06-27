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

var iopa = require('iopa');
var TcpServer = require('../transport/tcpServer.js');
var MqttFormat = require('../common/mqttFormat.js');
var MQTTPacketServer = require('../middleware/mqttPacketServer.js');
var MQTTPacketClient = require('../middleware/mqttPacketClient.js');
var MQTTAutoAck = require('../middleware/mqttAutoAck.js');
var BackForth = require('../middleware/BackForth.js');
var ClientSend = require('../middleware/ClientSend.js');

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Promise = require('bluebird');
var constants = require('../common/constants.js');

/* *********************************************************
 * IOPA MQTT SERVER / CLIENT WITH MIDDLEWARE CONSTRUCTED
 * ********************************************************* */

/**
 * MQTT IOPA Server includes MQTT Client
 * 
 * @class MQTTServer
 * @param {object} options  
 * @param {appFunc} appFunc  Server callback in IOPA AppFunc format
 * @constructor
 */
function MQTTServer(options, appFunc) {
  if (!(this instanceof MQTTServer))
    return new MQTTServer(options, appFunc);
   
   if (typeof options === 'function') {
    appFunc = options;
    options = {};
  }

  EventEmitter.call(this);
  
  // SERVER CONNECTION PIPELINE
  var serverConnectionApp = new iopa.App();
  serverConnectionApp.use(this._server_invokeOnConnection.bind(this));
  serverConnectionApp.use(MQTTPacketServer);
  var serverConnectionPipeline = serverConnectionApp.build();
  
  // SERVER REQUEST PIPELINE
  this._appFunc = appFunc;
  var serverRequestApp = new iopa.App();
   serverRequestApp.properties["server.Capabilities"]["iopa-mqtt.Version"] = "1.2";
    serverRequestApp.properties["server.Capabilities"]["iopa-mqtt.Support"] = {
        "mqtt.Version": "3.1.1"
    };
  serverRequestApp.use(this.server_invokeOnRequest.bind(this));
  serverRequestApp.use(MQTTAutoAck);
  this.serverRequestPipeline = serverRequestApp.build();
  
  // CLIENT CREATE REQUEST PIPELINE
  var clientConnectApp = new iopa.App();
  clientConnectApp.properties["app.DefaultApp"] = function (context) { return Promise.resolve(context); };
  clientConnectApp.use(this._client_invokeOnConnect.bind(this));
  clientConnectApp.use(BackForth);
  clientConnectApp.use(ClientSend);
  this._clientConnectPipeline = clientConnectApp.build();

  // CLIENT SEND REQUEST PIPELINE
  var clientRequestApp = new iopa.App();
  clientRequestApp.properties["app.DefaultApp"] = function (context) {
     return new Promise(function (resolve, reject){
      context["mqtt.Close"] = resolve;
    }); 
    };
  clientRequestApp.use(MQTTPacketClient);
  var clientSendPipeline = clientRequestApp.build();
  
    // CLIENT RECEIVE RESPONSE PIPELINE
  var clientResponseApp = new iopa.App();
  clientResponseApp.use(this._client_invokeOnResponse.bind(this));
  this._clientResponsePipeline = clientResponseApp.build();
  
   // INIT TCP SERVER
  this._tcp = new TcpServer(options, serverConnectionPipeline, clientSendPipeline);
}

util.inherits(MQTTServer, EventEmitter);

/**
 * Begin accepting connections on the specified port and hostname. 
 * If the hostname is omitted, the server will accept connections directed to any IPv4 address (INADDR_ANY).
 * 
 * @method listen
 * @param {integer} port  
 * @param {string} address (IPV4 or IPV6)
 * @returns promise completes when listening
 * @public
 */
MQTTServer.prototype.listen = function mqttServer_listen(port, address) {
  var that = this;
  return this._tcp.listen(port, address).then(function(linfo){
     that.port = linfo.port;
     that = null;
     return Promise.resolve(linfo);
        });
};

/**
 * Create MQTT Session over TCP Connection to given Host and Port
 *
 * @method connect
 * @this MQTTServer MQTTServer instance
 * @parm {string} urlStr url representation of Request mqtt://127.0.0.1/hello
 * @returns {Promise(context)}
 * @public
 */
MQTTServer.prototype.connect = function mqttServer_connect(urlStr) {
  var that = this;
  return this._tcp.connect(urlStr).then(function(client){
    var p =  that._clientConnectPipeline(client);
    return p.then(function(cl){ return cl;});
  });
};

/**
 * Middleware Called on Each Outbound Client Connect Event
 * 
 * @method _client_invokeOnConnect
 * @this MQTTServer MQTTServer instance
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTServer.prototype._client_invokeOnConnect = function MQTTServer_client_invokeOnConnect(client, next) {
   client["server.createRequest"] = this._client_createRequest.bind(this,  client["server.createRequest"]);
   MqttFormat.inboundParse(client, "response");
   return next();
 };

/**
 * Context Func(tion) to create a new IOPA Request using a Tcp Url including host and port name
 *
 * @method createRequest

 * @parm {string} urlStr url representation of ://127.0.0.1/hello
 * @parm {string} [method]  request method (e.g. 'GET')
 * @returns {Promise(context)}
 * @public
 */
MQTTServer.prototype._client_createRequest = function MQTTServer_client_createRequest(nextFactory, path, method){
    var childContext = nextFactory(path, method);
    var that = this;
     MqttFormat.defaultContext(childContext);
     
     childContext["iopa.Events"].on("response", function(context){ 
       that._clientResponsePipeline(context)
       .then(function(){
         childContext["mqtt.Close"]();
         });
       });
     return childContext;
};

/**
 * @method _client_invokeOnChildResponse
 * @this MQTTServer MQTTServer instance
 * @param context IOPA response context dictionary (not matched to child request)
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTServer.prototype._client_invokeOnResponse = function MQTTServer_client_invokeOnResponse(context, next) {
   console.log("CLIENT RESPONSE RECEIVED: " + context["iopa.Method"]);
   return next();
};

/**
 * Middleware called for each Server Request (at start of TCP session)
 *
 * @method _server_invokeOnConnection
 * @this MQTTServer MQTTServer instance
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 * @public
 */
 MQTTServer.prototype._server_invokeOnConnection = function MQTTServer_server_invokeOnConnection(context, next) {
   context["iopa.Events"].on("request", this.serverRequestPipeline);
   return next();
};

/**
 * Middleware called for each Server IOPA Request (many such requests per session)
 *
 * @method server_invokeOnRequest
 * @this MQTTServer MQTTServer instance
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
 MQTTServer.prototype.server_invokeOnRequest = function MQTTServer_server_invokeOnRequest(context, next) {
  console.log("SERVER REQUEST RECEIVED: " + context["iopa.Method"]);
  context["mqttServer._createRequestOld"] = context["server.createRequest"];
  context["server.createRequest"] = function(path, method){
     return MqttFormat.defaultContext(context["mqttServer._createRequestOld"](path,method));
     };
   return this._appFunc(context).then(next);
};

module.exports = MQTTServer;