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
 var db_Subscriptions = {};
 
 const constants = require('iopa').constants,
    IOPA = constants.IOPA,
    SERVER = constants.SERVER,
    MQTT = constants.MQTT
    
const THISMIDDLEWARE = { CAPABILITY: "urn:io.iopa:mqtt:sessionmanager",
  SESSION: "sessionclient.Session",
  PENDINGMESSAGES: "sessionClient.PendingMessages"
},
  MQTTMIDDLEWARE = { CAPABILITY: "urn:io.iopa:mqtt" },
  packageVersion = require('../../package.json').version;
 
/**
 * MQTT IOPA Middleware for Managing Server Sessions including Auto Subscribing Client Subscribe Requests
 *
 * @class MQTTAutoSubscribe
 * @this app.properties  the IOPA AppBuilder Properties Dictionary, used to add server.capabilities
 * @constructor
 * @public
 */
function MQTTSessionManager(app) {
    if (!app.properties[SERVER.Capabilities][MQTTMIDDLEWARE.CAPABILITY])
      throw ("Missing Dependency: IOPA MQTT Server/Middleware in Pipeline");
  
    app.properties[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY] = {};
    app.properties[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][SERVER.Version] = packageVersion;
    
    //Also register as standard IOPA PUB/SUB PUBLISH MIDDLEWARE
    app.properties[SERVER.Capabilities][IOPA.CAPABILITIES.Publish] = {};
    app.properties[SERVER.Capabilities][IOPA.CAPABILITIES.Publish][SERVER.Version] = app.properties[SERVER.Capabilities][IOPA.CAPABILITIES.App][SERVER.Version];

   this.app = app; 
   app[IOPA.PUBSUB.Publish]  = this._publish.bind(this, app[IOPA.PUBSUB.Publish] || function(){return Promise.resolve(null)});
}

/**
 * @method publish
 * @this MQTTSessionManager IOPA context dictionary
 * @param string topic   IOPA Path of  MQTT topic
 * @param buffer payload  payload to publish to all subscribed clients
 */
MQTTSessionManager.prototype._publish = function MQTTSessionManager_publish(nextPublish, topic, payload) {
  return nextPublish(topic, payload).then(function(){
     return MQTTSessionManager_publishMQTT(topic, payload);
  });
}

/**
 * @method invoke
 * @this MQTTSessionManager
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTSessionManager.prototype.invoke = function MQTTSessionManager_invoke(context, next) {
     var channelContext = context[SERVER.ParentContext];
     var client, session;
         
     switch (context[IOPA.Method]) {
           case MQTT.METHODS.CONNECT:     
             
           client =  context[MQTT.ClientId];   
         
           if (!context[MQTT.Clean] && (client in db_Clients)) 
           {
              session =  db_Clients[client];
              context.response[MQTT.SessionPresent] = true;
           } else
           {
              session = {}
              session[MQTT.Subscriptions] = {};
              session[THISMIDDLEWARE.PENDINGMESSAGES] = [];
           }
        
           session[MQTT.ClientId] = client;
           session[MQTT.ProtocolId] = context[MQTT.ProtocolId];
           session[MQTT.ProtocolVersion] = context[MQTT.ProtocolVersion];
           session[MQTT.KeepAlive] = context[MQTT.KeepAlive];
           session[MQTT.UserName] = context[MQTT.UserName];
           session[MQTT.Will] = context[MQTT.Will];
           session[MQTT.Clean] = context[MQTT.Clean];
           session[SERVER.ParentContext] = channelContext;
           channelContext[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.SESSION] = session;
           db_Clients[client] = session;
           channelContext[IOPA.CancelToken].onCancelled.then(this.disconnectMQTT.bind(this, channelContext));
           break;
       case MQTT.METHODS.SUBSCRIBE:
          session = channelContext[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.SESSION];
          client =  session[MQTT.ClientId]; 
         
          context[MQTT.Subscriptions].forEach(function(subscription){
                var topic = subscription["topic"];
                var qos = subscription["qos"];
                
                // Add to global subscriptions
                 if (topic in db_Subscriptions){
                     if (db_Subscriptions[topic].indexOf(client) > -1)
                     {
                         // SILENTLY IGNORE ALREADY SUBSCRIBED
                     } else
                     {
                         db_Subscriptions[topic].push(client);
                     }
                     
                 } else
                 {
                     db_Subscriptions[topic] = [client];
                 }
                 // Add to session Subscriptions 
                 session[MQTT.Subscriptions][topic] = {"qos": qos};
                 
                 // Set response code in order (valid values: 0, 1, 2, 128)
                 context.response[MQTT.Granted].push(0);

                 context.log.info("[MQTT-SESSION-MANAGER] SUBSCRIBE " + topic + " for client " + client);    
          });
          break;
       case MQTT.METHODS.DISCONNECT:
           channelContext[SERVER.RawStream].end();
           break;
       case MQTT.METHODS.UNSUBSCRIBE:
           session = channelContext[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.SESSION];
           client =  session[MQTT.ClientId]; 
          
          context[MQTT.Subscriptions].forEach(function(subscription){
                var topic = subscription["topic"];
                
                 // Remove from db_Subscriptions (for all clients)
                
                 if (topic in db_Subscriptions){
                   for(var i = db_Subscriptions[topic].length; i--;) {
                          if(db_Subscriptions[topic][i] === client) {
                              db_Subscriptions[topic].splice(i, 1);
                          }
                      }    
                 } else
                 {
                     // SILENTLY IGNORE NOT SUBSCRIBED GLOBALLY FOR ANY CLIENT ON THIS TOPIC
                 }
         
                // Remove from session Subscriptions (for this client only)
                delete session[MQTT.Subscriptions][topic];
                
                context.log.info("[MQTT-SESSION-MANAGER] UNSUBSCRIBE " + topic + " for client " + client);    
 
              });
         break;
          case MQTT.METHODS.PUBACK:
            break;
         default:
            context.log.info("UNKNOWN METHOD" + context[IOPA.Method]);
         throw("Unknown Method");
    }
   
    return next();
};

MQTTSessionManager.prototype.disconnectMQTT = function MQTTSessionManager_disconnect(channelContext) {
      channelContext.log.info("[MQTT-SESSION-MANAGER] DISCONNECT ");
   
      var session = channelContext[SERVER.Capabilities][THISMIDDLEWARE.CAPABILITY][THISMIDDLEWARE.SESSION];
      var client =  session[MQTT.ClientId]; 
         
      if (session[MQTT.Clean])
      {
        if (client in db_Clients)
           {
              delete db_Clients[client] ;
                             
              // Delete all remaining subscriptions for this session               
              Object.keys(session[MQTT.Subscriptions]).forEach(function(topic){
                
                 // Remove from db_Subscriptions (for all clients)
                 if (topic in db_Subscriptions){
                   for(var i = db_Subscriptions[topic].length; i--;) {
                          if(db_Subscriptions[topic][i] === client) {
                              db_Subscriptions[topic].splice(i, 1);
                          }
                      }    
                 } else
                 {
                      // SILENTLY IGNORE NOT SUBSCRIBED FOR ANY CLIENT ON THIS TOPIC
                 }
         
                // Remove from session Subscriptions (for this client only)
                delete session[MQTT.Subscriptions][topic];
    
              });
          }   
          // Remove all channelContext Subscriptions (for this client only)
         session[MQTT.Subscriptions] = {};
      };
}

/**
 * @method publish
 * @this MQTTSessionManager IOPA context dictionary
 * @param string topic   IOPA Path of  MQTT topic
 * @param buffer payload  payload to publish to all subscribed clients
 */
function MQTTSessionManager_publishMQTT(topic, payload) {
    if (topic in db_Subscriptions)
    {
        db_Subscriptions[topic].forEach(function(client){
            var session = db_Clients[client];
            session[SERVER.ParentContext].send(topic, MQTT.METHODS.PUBLISH, payload);
        });
        
    } else
    {
        // no subscriptions, ignore
    }
    
    return Promise.resolve(null);  // could return promise all and check for PUBACK And delete from db_Clients on no response
   
};

module.exports = MQTTSessionManager;