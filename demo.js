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

const iopa = require('iopa')
    , mqtt = require('./index.js')      
    , util = require('util');
    
 
const iopaMessageLogger = require('iopa-common-middleware').MessageLogger

var app = new iopa.App();
app.use(iopaMessageLogger);

app.use(function(context, next){
   context.log.info("[DEMO] MQTT APP USE " + context["iopa.Method"]);
   
   if (context["iopa.Method"] === "SUBSCRIBE")
   {
     setTimeout(function() {
            server.publish("/projector", new Buffer("Hello World 2 55555"));
            }, 1000);
   }

   return next();
    });
      
var server = mqtt.createServer(app.build());
server.connectuse(iopaMessageLogger.connect);

if (!process.env.PORT)
  process.env.PORT = 1883;

var context;
var mqttClient;
server.listen(process.env.PORT, process.env.IP)
  .then(function(){
    server.log.info("[DEMO] Server is on port " + server.port );
    return server.connect("mqtt://127.0.0.1", "CLIENTID-1", false);
  })
  .then(function(cl){
    mqttClient = cl;
    server.log.info("[DEMO] Client is on port " + mqttClient["server.LocalPort"]);
    return mqttClient.subscribe("/projector", function(pubsub){
             server.log.info("[DEMO] MQTT PUBSUB Response " + pubsub["iopa.Method"] + " " + pubsub["iopa.Body"].toString());
       })
  })
  .then(function(response){
       server.log.info("[DEMO] MQTT Response " + response["iopa.Method"] + " " + response["iopa.Body"].toString());
       server.publish("/projector", new Buffer("Hello World"));
    })
  .then(function(){
    setTimeout(function(){
       server.close().then(function(){server.log.info("[DEMO] MQTT DEMO Closed");});
    }, 2000);
    });
    