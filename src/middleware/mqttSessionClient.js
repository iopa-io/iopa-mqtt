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

const THISMIDDLEWARE = {
  CAPABILITY: "urn:io.iopa:mqtt:sessionclient",
  SESSION: "sessionclient.Session",
  PENDINGMESSAGES: "sessionClient.PendingMessages"
},
  MQTTMIDDLEWARE = { CAPABILITY: "urn:io.iopa:mqtt" },
  packageVersion = require('../../package.json').version;

    
/**
 * MQTT IOPA Middleware for Managing Server Sessions including Auto Subscribing Client Subscribe Requests
 *
 * @class MQTTSessionClient
 * @this app.properties  the IOPA AppBuilder Properties Dictionary, used to add server.capabilities
 * @constructor
 * @public
 */
function MQTTSessionClient(app) {
  if (!app.properties[SERVER.Capabilities][MQTTMIDDLEWARE.CAPABILITY])
    throw ("Missing Dependency: IOPA MQTT Server/Middleware in Pipeline");

  app.properties[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY] = {};
  app.properties[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][SERVER.Version] = packageVersion;
  
  //Also register as standard IOPA PUB/SUB SUBSCRIBE MIDDLEWARE
  app.properties[SERVER.Capabilities][IOPA.CAPABILITIES.Subscribe] = {};
  app.properties[SERVER.Capabilities][IOPA.CAPABILITIES.Subscribe][SERVER.Version] = app.properties[SERVER.Capabilities][IOPA.CAPABILITIES.App][SERVER.Version];
  
  this.app = app;
  this.server = app.server;
 }

/**
 * @method connect
 * @this MQTTSessionClient IOPA context dictionary
 *  @param nextConnect bound to next server.connect in chain 
 * @param string clientid  
 * @param bool clean   use clean (persistent) session
 */
MQTTSessionClient.prototype.connect = function MQTTSessionManager_connect(channelContext, next) {
    if (channelContext[IOPA.Scheme] !== IOPA.SCHEMES.MQTT && channelContext[IOPA.Scheme] !== IOPA.SCHEMES.MQTTS)
      return next();
      
    channelContext[IOPA.Events].on(IOPA.EVENTS.Response, this._client_invokeOnParentResponse.bind(this, channelContext));
    channelContext[IOPA.PUBSUB.Subscribe] = this.subscribeMQTT.bind(this, channelContext);
    channelContext.disconnect = this._disconnect.bind(this, channelContext.disconnect, channelContext);
 
    return next()
    .then(function(){
      return MQTTSessionClient_connect.call(this, channelContext)
    })
    .then(function (response) {
      if (response[IOPA.Method] !== MQTT.METHODS.CONNACK)
        throw new Error("MQTT server did not respond with CONNACK");
      return channelContext;
    });
}

/**
 * @method connect
 * @this MQTTSessionClient IOPA context dictionary
 *  @param nextDisconnect bound to next client.disconnect in chain 
 * @param channelContext client  
 */
MQTTSessionClient.prototype._disconnect = function MQTTSessionManager_disconnect(nextDisconnect, channelContext) {
  return channelContext.fetch("/", MQTT.METHODS.DISCONNECT, function () { }).then(nextDisconnect);
}

/**
 * @method _client_invokeOnParentResponse
 * @this CacheMatch
 * @param channelContext IOPA parent context dictionary
 * @param context IOPA childResponse context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTSessionClient.prototype._client_invokeOnParentResponse = function MQTTSessionClient_client_invokeOnParentResponse(channelContext, context) {
  var session = channelContext[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.SESSION];

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
function MQTTSessionClient_connect(channelContext) {
  var session;
  var sessionid = channelContext[SERVER.SessionId];
  var clientid = channelContext[SERVER.LocalThing];
  var clean = channelContext[IOPA.PUBSUB.Clean];
  
  if (!clean && (sessionid in db_Clients)) {
    session = db_Clients[sessionid];
  } else {
    session = {}
    session[MQTT.Subscriptions] = {};
    session[THISMIDDLEWARE.PENDINGMESSAGES] = [];
  }

  session[SERVER.SessionId] = sessionid;
  session[MQTT.Clean] = clean;
  session[SERVER.ParentContext] = channelContext;
  db_Clients[sessionid] = session;

  channelContext[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.SESSION] = session;
  channelContext[IOPA.CancelToken].onCancelled.then(MQTTSessionClient_disconnect.bind(this, channelContext));

  var defaults = {};
  defaults[IOPA.Method] = MQTT.METHODS.CONNECT;
  defaults[MQTT.Clean] = clean;
  defaults[MQTT.ClientId] = clientid;

  return channelContext.send("/", defaults);

};

/**
 * @method subscribe
 * @this MQTTSessionClient IOPA context dictionary
 * @param string topic   IOPA Path of  MQTT topic
 * @param appFunc callback  callback to for published responses
 */
MQTTSessionClient.prototype.subscribeMQTT = function MQTTSessionManager_subscribe(channelContext, topic, callback) {
  var session = channelContext[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.SESSION];  
     
  // Add to session subscriptions
  if (topic in session[MQTT.Subscriptions])
    session[MQTT.Subscriptions][topic].push(callback)
  else
    session[MQTT.Subscriptions][topic] = [callback];

  return channelContext.send(topic, MQTT.METHODS.SUBSCRIBE);
};

function MQTTSessionClient_disconnect(channelContext) {

  var session = channelContext[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.SESSION];
  var sessionId = session[SERVER.SessionId];

  if (session[MQTT.Clean]) {
    if (sessionId in db_Clients) {
      delete db_Clients[sessionId];
    } else {
      // silently ignore
    }

    session[MQTT.Subscriptions] = {};
  };
}

module.exports = MQTTSessionClient;