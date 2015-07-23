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
 
 var db_Clients = {};
 var db_Subscriptions = {};
 
/**
 * MQTT IOPA Middleware for Managing Server Sessions including Auto Subscribing Client Subscribe Requests
 *
 * @class MQTTAutoSubscribe
 * @this app.properties  the IOPA AppBuilder Properties Dictionary, used to add server.capabilities
 * @constructor
 * @public
 */
function MQTTSessionManager(app) {
    if (!app.properties["server.Capabilities"]["iopa-mqtt.Version"])
        throw ("Missing Dependency: MQTT Server/Middleware in Pipeline");

   app.properties["server.Capabilities"]["MQTTSessionManager.Version"] = "1.0";
   this.app = app;
   this.server = app.server;
   
   this.server.publish = this.publish.bind(this);
}

/**
 * @method invoke
 * @this MQTTSessionManager
 * @param context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTSessionManager.prototype.invoke = function MQTTSessionManager_invoke(context, next) {
     var channelContext = context["server.ChannelContext"];
     var client, session;
         
     switch (context["iopa.Method"]) {
           case "CONNECT":     
             
           client =  context["mqtt.ClientID"];   
         
           if (!context["mqtt.Clean"] && (client in db_Clients)) 
           {
              session =  db_Clients[client];
              context.response["mqtt.SessionPresent"] = true;
           } else
           {
              session = {}
              session["mqtt.Subscriptions"] = {};
              session["mqtt.PendingMessages"] = [];
           }
        
           session["mqtt.ClientID"] = client;
           session["mqtt.ProtocolId"] = context["mqtt.ProtocolId"];
           session["mqtt.ProtocolVersion"] = context["mqtt.ProtocolVersion"];
           session["mqtt.Keepalive"] = context["mqtt.Keepalive"];
           session["mqtt.Username"] = context["mqtt.Username"];
           session["mqtt.Will"] = context["mqtt.Will"];
           session["mqtt.Clean"] = context["mqtt.Clean"];
           session["server.ChannelContext"] = channelContext;
           channelContext["mqtt.Session"] = session;
           db_Clients[client] = session;
           channelContext["mqttSessionManager._DisconnectListener"] = this.disconnect.bind(this, channelContext);
           channelContext["iopa.Events"].on("disconnect", channelContext["mqttSessionManager._DisconnectListener"]);
           break;
       case "SUBSCRIBE":
          session = channelContext["mqtt.Session"];
          client =  session["mqtt.ClientID"]; 
         
          context["mqtt.Subscriptions"].forEach(function(subscription){
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
                 session["mqtt.Subscriptions"][topic] = {"qos": qos};
                 
                 // Set response code in order (valid values: 0, 1, 2, 128)
                 context.response["mqtt.Granted"].push(0);

                 context.log.info("[MQTT-SESSION-MANAGER] SUBSCRIBE " + topic + " for client " + client);    
          });
          break;
       case "DISCONNECT":
           channelContext["iopa.Events"].emit("disconnect");
           break;
       case "UNSUBSCRIBE":
           session = channelContext["mqtt.Session"];
           client =  session["mqtt.ClientID"]; 
          
          context["mqtt.Unsubscriptions"].forEach(function(subscription){
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
                delete session["mqtt.Subscriptions"][topic];
                
                context.log.info("[MQTT-SESSION-MANAGER] UNSUBSCRIBE " + topic + " for client " + client);    
 
              });
         break;
    }
   
    return next();
};

MQTTSessionManager.prototype.disconnect = function MQTTSessionManager_disconnect(channelContext) {
      channelContext["iopa.Events"].removeListener("disconnect", channelContext["mqttSessionManager._DisconnectListener"]);
      delete channelContext["mqttSessionManager._DisconnectListener"];
  
         var session = channelContext["mqtt.Session"];
          var client =  session["mqtt.ClientID"]; 
         
      if (session["mqtt.Clean"])
      {
        if (client in db_Clients)
           {
              delete db_Clients[client] ;
                             
              // Delete all remaining subscriptions for this session               
              Object.keys(session["mqtt.Subscriptions"]).forEach(function(topic){
                
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
                delete session["mqtt.Subscriptions"][topic];
    
              });
          } else {
          // silently ignore
         }
  
          // Remove all channelContext Subscriptions (for this client only)
         session["mqtt.Subscriptions"] = {};
      };
}

/**
 * @method publish
 * @this MQTTSessionManager IOPA context dictionary
 * @param string topic   IOPA Path of  MQTT topic
 * @param buffer payload  payload to publish to all subscribed clients
 */
MQTTSessionManager.prototype.publish = function MQTTSessionManager_publish(topic, payload) {
    if (topic in db_Subscriptions)
    {
        db_Subscriptions[topic].forEach(function(client){
            var session = db_Clients[client];
            var channelContext = session["server.ChannelContext"];
            var context = channelContext["server.createRequest"](topic, "PUBLISH");
            // ignore PUBACK Responses so no promises here
            context["iopa.Body"].end(payload);
        });
        
    } else
    {
        // no subscriptions, ignore
    }
};

module.exports = MQTTSessionManager;