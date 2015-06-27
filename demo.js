/*
 * Copyright 2015 Domabo;  portions copyright wigwagco/OIC consortium
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
   console.log("MQTT DEMO " + context["iopa.Method"]);
   
   if (context["iopa.Method"] === "SUBSCRIBE")
   {
     setTimeout(function() {
                console.log("TO DO: SEND OBSERVATION");
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
  process.env.PORT = mqtt.constants.mqttPort;

var context;
var client;
 server.listen(process.env.PORT, process.env.IP)
   .then(function(){
      console.log("Server is on port " + server.port );
      return server.connect("mqtt://127.0.0.1");
   })
   .then(function(cl){
     client = cl;
      console.log("Client is on port " + client["server.LocalPort"]);
      var context = client["server.createRequest"]("/", "CONNECT");
      return context["iopa.Body"].send();
   })
    .then(function(response){
         console.log("MQTT DEMO Response " + response["iopa.Method"]);
         var context = client["server.createRequest"]("/projector", "SUBSCRIBE");
         return context["iopa.Body"].observe(function(observe){
             console.log("MQTT DEMO Observation " + observe["iopa.Method"]);
         });
      })
       .then(function(response){
         console.log("MQTT DEMO Response " + response["iopa.Method"]);
      });
      