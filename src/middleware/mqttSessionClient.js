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

var db_Clients = {};
const constants = require('iopa').constants,
  IOPA = constants.IOPA,
  SERVER = constants.SERVER,
  MQTT = constants.MQTT
    
/**
 * MQTT IOPA Middleware for Managing Server Sessions including Auto Subscribing Client Subscribe Requests
 *
 * @class MQTTSessionClient
 * @this app.properties  the IOPA AppBuilder Properties Dictionary, used to add server.capabilities
 * @constructor
 * @public
 */
function MQTTSessionClient(app) {
  if (!app.properties[SERVER.Capabilities]["iopa-mqtt.Version"])
    throw ("Missing Dependency: MQTT Server/Middleware in Pipeline");

  app.properties[SERVER.Capabilities]["MQTTSessionClient.Version"] = "1.0";
  this.app = app;
  
  this.server = app.server;
  this.server.connect = this._connect.bind(this, this.server.connect);
}


/**
 * @method connect
 * @this MQTTSessionClient IOPA context dictionary
 *  @param nextConnect bound to next server.connect in chain 
 * @param string clientid  
 * @param bool clean   use clean (persistent) session
 */
MQTTSessionClient.prototype._connect = function MQTTSessionManager_connect(nextConnect, urlStr, clientid, clean){
   var client; 
  return nextConnect(urlStr).then(function(cl){
    if (cl[IOPA.Scheme] !== IOPA.SCHEMES.MQTT && cl[IOPA.Scheme] !== IOPA.SCHEMES.MQTT)
      return cl;
      
      client = cl;
  
      return client.connectMQTT(clientid, clean).then(function(response){
          if (response["iopa.Method"] !== 'CONNACK')
            throw new Error("MQTT server did not respond with CONNACK");
          return client;
      });
  });
}

/**
 * @method connect
 * @this MQTTSessionClient IOPA context dictionary
 *  @param nextDisconnect bound to next client.disconnect in chain 
 * @param channelContext client  
 */
MQTTSessionClient.prototype._disconnect = function MQTTSessionManager_disconnect(nextDisconnect, channelContext){
  return channelContext.fetch("/", MQTT.METHODS.DISCONNECT, function(){}).then(nextDisconnect);
}

/**
 * @method invoke
 * @this MQTTSessionClient
 * @param channelContext IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTSessionClient.prototype.invoke = function MQTTSessionManager_invoke(channelContext, next) {
  channelContext[IOPA.Events].on(IOPA.EVENTS.Response, this._client_invokeOnParentResponse.bind(this, channelContext));
  channelContext.connectMQTT = this.connectMQTT.bind(this, channelContext);
  channelContext.subscribe = this.subscribeMQTT.bind(this, channelContext);
  channelContext.disconnect = this._disconnect.bind(this, channelContext.disconnect, channelContext);
  return next();
};

/**
 * @method _client_invokeOnParentResponse
 * @this CacheMatch
 * @param channelContext IOPA parent context dictionary
 * @param context IOPA childResponse context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTSessionClient.prototype._client_invokeOnParentResponse = function MQTTSessionClient_client_invokeOnParentResponse(channelContext, context) {
  var session = channelContext["MQTTSessionClient.Session"];

  if (context[IOPA.Method] === MQTT.METHODS.PUBLISH) {
    var topic = context[IOPA.Path];

    if (topic in session[MQTT.Subscriptions]) {
      (session[MQTT.Subscriptions][topic]).forEach(function (callback) {
        callback(context);
      });
    };
  }

};

/**
 * @method connect
 * @this MQTTSessionClient IOPA context dictionary
 * @param string clientid  
 * @param bool clean   use clean (persistent) session
 */
MQTTSessionClient.prototype.connectMQTT = function MQTTSessionManager_connectMQTT(channelContext, client, clean) {
  var session;

  if (!clean && (client in db_Clients)) {
    session = db_Clients[client];
  } else {
    session = {}
    session[MQTT.Subscriptions] = {};
    session["MQTTSessionClient.PendingMessages"] = [];
  }

  session[MQTT.ClientId] = client;
  session[MQTT.Clean] = clean;
  session[SERVER.ParentContext] = channelContext;
  db_Clients[client] = session;
    
  channelContext["MQTTSessionClient.Session"] = session;
  channelContext[IOPA.Events].once(IOPA.EVENTS.Disconnect, this.disconnectMQTT.bind(this, channelContext));

  var defaults = {};
  defaults[IOPA.Method] = MQTT.METHODS.CONNECT;
  defaults[MQTT.Clean] = clean;
  defaults[MQTT.ClientId] = client;
  
  return channelContext.send("/", defaults); 
  
};

/**
 * @method subscribe
 * @this MQTTSessionClient IOPA context dictionary
 * @param string topic   IOPA Path of  MQTT topic
 * @param appFunc callback  callback to for published responses
 */
MQTTSessionClient.prototype.subscribeMQTT = function MQTTSessionManager_subscribe(channelContext, topic, callback) {
     var session = channelContext["MQTTSessionClient.Session"];  
     
    // Add to session subscriptions
    if (topic in session[MQTT.Subscriptions])
        session[MQTT.Subscriptions][topic].push(callback)
    else
        session[MQTT.Subscriptions][topic] = [callback];
  
    return channelContext.send(topic, MQTT.METHODS.SUBSCRIBE);
};

MQTTSessionClient.prototype.disconnectMQTT = function MQTTSessionClient_disconnect(channelContext) {
     
     var session = channelContext["MQTTSessionClient.Session"];
      var client =  session[MQTT.ClientId]; 
 
      if (session[MQTT.Clean])
      {
        if (client in db_Clients)
           {
              delete db_Clients[client] ;
          } else {
          // silently ignore
         }
  
          session[MQTT.Subscriptions] = {};
      };

  
}

module.exports = MQTTSessionClient;