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

const iopa = require('iopa')
    , mqtt = require('./index.js')      
    , Promise = require('bluebird')
    , util = require('util');


var app = new iopa.App();


app.use(function(context, next){
   context.log.info("MQTT DEMO " + context["iopa.Method"]);
   
   if (context["iopa.Method"] === "SUBSCRIBE")
   {
     setTimeout(function() {
               server.publish("/projector", new Buffer("Hello World 2"));
            }, 1000);
   }

   return next();
    });
    
var serverOptions = {
    "server.LocalPortReuse" : true
  , "server.IsGlobalClient" : false
};

var clientOptions = { "server.IsGlobalClient" : true
                    , "server.LocalPortReuse" : false};
                    
var server = mqtt.createServer(serverOptions, app.build());

if (!process.env.PORT)
  process.env.PORT = 1883;

var context;
var mqttClient;
server.listen(process.env.PORT, process.env.IP)
  .then(function(){
    server.log.info("Server is on port " + server.port );
    return server.connect("mqtt://127.0.0.1");
  })
  .then(function(cl){
    mqttClient = cl;
    server.log.info("Client is on port " + mqttClient["server.LocalPort"]);
    return mqttClient.connect("CLIENTID-1", false);
  })
  .then(function(response){
       server.log.info("MQTT DEMO Response " + response["iopa.Method"]);
       return mqttClient.subscribe("/projector", function(context){
           console.log("/projector RESPONSE " + context["iopa.Body"].toString());
           });
        })
  .then(function(response){
       server.log.info("MQTT DEMO Response " + response["iopa.Method"]);
       server.publish("/projector", new Buffer("Hello World"));
    })
  .then(function(response){
     //  server.log.info("MQTT DEMO Response " + response["iopa.Method"]);
    //   server.close().then(function(){server.log.info("MQTT DEMO Closed");});
    });
    