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
global.Promise = require('bluebird');

const iopa = require('iopa')
    , util = require('util')
    , Events = require('events')
    , mqtt = require('../index.js')
    , tcp = require('iopa-tcp');
   const iopaMessageLogger = require('iopa-logger').MessageLogger

var should = require('should');

var numberConnections = 0;

describe('#MQTT Server()', function() {
  
  var server, mqttClient;
  var events = new Events.EventEmitter();
  var app;
  
  before(function(done){
     app = new iopa.App();
     app.use(iopaMessageLogger);
     app.use(mqtt);

      
      app.use(function(context, next){
         context.log.info("[TEST] APP USE " + context["iopa.Method"]); 
         events.emit("data", context);  
         return next();
          });
          
      server = tcp.createServer(app.build());
      
      if (!process.env.PORT)
        process.env.PORT = 1883;
      
       server.listen(process.env.PORT, process.env.IP).then(function(){
            done();
            setTimeout(function(){ events.emit("SERVER-TCP");}, 50);
             });
    });
    
   it('should listen via TCP', function(done) {   
           server.port.should.equal(1883);
           done();
    });
    
         
   it('should connect via MQTT', function (done) {
     server.connect("mqtt://127.0.0.1")
       .then(function (cl) {
         mqttClient = cl;
         mqttClient["server.RemotePort"].should.equal(1883);
          numberConnections ++;
          events.emit("CLIENT-CONNACK");
          setTimeout(done, 50);
       });
   });
     
    it('should publish / subscribe via MQTT', function(done) {
         mqttClient["pubsub.Subscribe"]("/projector", function(publet){
         if (numberConnections == 1)
         {
           console.log("[TEST] /projector RESPONSE " + publet["iopa.Body"].toString());
           publet["iopa.Body"].toString().should.equal('Hello World');
           done();
         }
           else
             events.emit("CLIENT-PUB", publet);
           }).then(function(response){
              response["iopa.Method"].should.equal('SUBACK');
              app["pubsub.Publish"]("/projector", new Buffer("Hello World"));
           });
    });
    
    it('should disconnect client', function(done) {
        mqttClient.disconnect();
        done();
    });
    
    it('should restablish connectionion via MQTT', function(done) {
         
       server.connect("mqtt://127.0.0.1")
       .then(function (cl) {
         mqttClient = cl;
         mqttClient["server.RemotePort"].should.equal(1883);
          numberConnections ++;
             events.emit("CLIENT-CONNACK");
             })
          .then(function(){
             return mqttClient["pubsub.Subscribe"]("/projector", function(publet){
             console.log("[TEST] /projector RESPONSE3 " + publet["iopa.Body"].toString());
             publet["iopa.Body"].toString().should.equal('Hello World 2');
             done();
             })
           })
          .then(function(response){
              response["iopa.Method"].should.equal('SUBACK');
              app["pubsub.Publish"]("/projector", new Buffer("Hello World 2"));
             });
    });
    
    it('should close', function(done) {
    
       server.close().then(function(){
         app.log.info("MQTT DEMO Closed");
         done();});
    });
    
});
