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
 
/**
 * MQTT IOPA Middleware for Managing Server Sessions including Auto Subscribing Client Subscribe Requests
 *
 * @class MQTTAutoSubscribe
 * @this app.properties  the IOPA AppBuilder Properties Dictionary, used to add server.capabilities
 * @constructor
 * @public
 */
function MQTTSessionClient(app) {
    if (!app.properties["server.Capabilities"]["iopa-mqtt.Version"])
        throw ("Missing Dependency: MQTT Server/Middleware in Pipeline");

   app.properties["server.Capabilities"]["MQTTSessionClient.Version"] = "1.0";
   this.app = app;
  }

/**
 * @method invoke
 * @this MQTTSessionClient
 * @param channelContext IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTSessionClient.prototype.invoke = function MQTTSessionManager_invoke(channelContext, next) {
    channelContext["iopa.Events"].on("response", this._client_invokeOnParentResponse.bind(this, channelContext));
    channelContext.connect = this.connect.bind(this, channelContext);
    channelContext.subscribe = this.subscribe.bind(this, channelContext);
    channelContext.disconnect = this.disconnect.bind(this, channelContext);
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
   var session = channelContext["mqtt.Session"];  
   
   if (context["iopa.Method"] === "PUBLISH")
    {
        var topic = context["iopa.Path"];
         
        if (topic in session["mqtt.Subscriptions"])
        {
             (session["mqtt.Subscriptions"][topic]).forEach(function(callback){
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
MQTTSessionClient.prototype.connect = function MQTTSessionManager_connect(channelContext, client, clean) {
    var session;
        
    if (!clean && (client in db_Clients)) 
       {
          session =  db_Clients[client];
       } else
       {
          session = {}
          session["mqtt.Subscriptions"] = {};
          session["mqtt.PendingMessages"] = [];
       }
           
    var context = channelContext["server.createRequest"]("/", "CONNECT"); 
    context["mqtt.Clean"] = clean;
    context["mqtt.ClientID"] = client;
    
    session["mqtt.ClientID"] = client;
    session["mqtt.Clean"] = clean;
  
    session["mqtt.ProtocolId"] = context["mqtt.ProtocolId"];
    session["mqtt.ProtocolVersion"] = context["mqtt.ProtocolVersion"];
    session["mqtt.Keepalive"] = context["mqtt.Keepalive"];
    session["mqtt.Username"] = context["mqtt.Username"];
    session["mqtt.Will"] = context["mqtt.Will"];
    
    session["server.ChannelContext"] = channelContext;
    channelContext["mqtt.Session"] = session;
    db_Clients[client] = session;
    channelContext["mqttSessionClient._DisconnectListener"] = this.disconnect.bind(this, channelContext);
    channelContext["iopa.Events"].on("disconnect", channelContext["mqttSessionClient._DisconnectListener"]);
        
    return context.send();
};

/**
 * @method subscribe
 * @this MQTTSessionClient IOPA context dictionary
 * @param string topic   IOPA Path of  MQTT topic
 * @param appFunc callback  callback to for published responses
 */
MQTTSessionClient.prototype.subscribe = function MQTTSessionManager_subscribe(channelContext, topic, callback) {
     var session = channelContext["mqtt.Session"];  
     
    // Add to session subscriptions
    if (topic in session["mqtt.Subscriptions"])
        session["mqtt.Subscriptions"][topic].push(callback)
    else
        session["mqtt.Subscriptions"][topic] = [callback];
  
    var context = channelContext["server.createRequest"](topic, "SUBSCRIBE");
    return context.send();
};

MQTTSessionClient.prototype.disconnect = function MQTTSessionClient_disconnect(channelContext) {
      context = channelContext["server.createRequest"]("/", "DISCONNECT");
      context.send()      
      channelContext["server.RawStream"].end();
      channelContext.log.info("[MQTT-SESSION-CLIENT] DISCONNECT ");    
      channelContext["iopa.Events"].removeListener("disconnect", channelContext["mqttSessionClient._DisconnectListener"]);
      delete channelContext["mqttSessionClient._DisconnectListener"];
  
      var session = channelContext["mqtt.Session"];
      var client =  session["mqtt.ClientID"]; 
      
      if (session["mqtt.Clean"])
      {
        if (client in db_Clients)
           {
              delete db_Clients[client] ;
          } else {
          // silently ignore
         }
  
          session["mqtt.Subscriptions"] = {};
      };
}

module.exports = MQTTSessionClient;