# [![IOPA](http://iopa.io/iopa.png)](http://iopa.io)<br> iopa-mqtt

[![Build Status](https://api.shippable.com/projects/5590a50fedd7f2c05243bb52/badge?branchName=master)](https://app.shippable.com/projects/5590a50fedd7f2c05243bb52) 
[![IOPA](https://img.shields.io/badge/iopa-middleware-99cc33.svg?style=flat-square)](http://iopa.io)
[![limerun](https://img.shields.io/badge/limerun-certified-3399cc.svg?style=flat-square)](https://nodei.co/npm/limerun/)

[![NPM](https://nodei.co/npm/iopa-mqtt.png?downloads=true)](https://nodei.co/npm/iopa-mqtt/)

## About
`iopa-mqtt` is a lightweight OASIS Message Queuing Telemetry Transport (MQTT) protocol server, based on the Internet of Protocols Association (IOPA) open standard  

It servers MQTT messages in standard IOPA format and allows existing middleware for Connect, Express and limerun projects to consume/send each mesage.

It is an open-source, standards-based, lighter-weight replacement for MQTT clients and brokers such as [`mqtt.js`](https://github.com/mqttjs/MQTT.js) [`mosca`](https://github.com/mcollina/mosca) and [`aedes`](https://github.com/mcollina/aedes). 

It uses the widely used library ['mqtt-packet'](https://github.com/mqttjs/mqtt-packet) for protocol formatting.

Written in plain javascript for maximum portability to constrained devices

Makes MQTT messages look to an application like a standard Request Response REST (HTTP-style) message so little or no application changes required to support multiple REST protocols

## Status

Fully working prototype include broker and client.

Includes:

### Server/Broker Functions

  * Layered protocol based on native TCP sockets and websockets over HTTP upgrade
  * Translation from RCP Raw Message to MQTT Packet in standard IOPA format, compatible with HTTP, COAP and MQTT applications including those written for Express, Connect, etc!
  * Optional logging middleware for each inbound message
  * Quality of Service 0
  * Observable messages (publish)
  
### Client Functions
  * Layered protocol based on native TCP sockets and websockets over HTTP upgrade
  * Translation from MQTT Packet in standard IOPA format to MQTT Raw Message
  * Optional logging middleware 
  * Quality of Service 0
  * Observable messages (subscribe)
  
## Installation

    npm install iopa-mqtt

## Usage
    
### Simple Hello World Server and Client
``` js
const iopa = require('iopa')
    , mqtt = require('iopa-mqtt')      

var app = new iopa.App();

app.use(function(context, next){
   context.response.end('Hello World from ' + context["iopa.Path"]);
   return next();
    });

var server = mqtt.createServer(serverOptions, app.build());

server.listen(mqtt.constants.mqttPort).then(function(){
   var context = server.clientCreateRequest('mqtt://127.0.0.1/device', "CONNECT");
   context.response.pipe(process.stdout);
   context["iopa.Events"].on("response", function() {
   context.response["iopa.Body"].on('end', function() {
       process.exit(0)
    });
  });
  
  context.end();

 });

``` 

### Multicast and UniCast Server Client Example
``` js
const iopa = require('iopa')
    , mqtt = require('iopa-mqtt')      
    , Promise = require('bluebird')

var app = new iopa.App();
app.use(function(context, next){
  context.response["iopa.Body"].end('Hello World from ' + context["iopa.Path"]);
   return next();
    });
    
var serverOptions = {
    "server.LocalPortMulticast" : MQTT.constants.mqttMulticastIPV4
  , "server.LocalPortReuse" : true
  , "server.IsGlobalClient" : false
}

var server = mqtt.createServer(serverOptions, app.build());

Promise.join( server.listen(process.env.PORT, process.env.IP)).then(function(){
   console.log("Server is on port " + server.port );
  
   server.clientCreateRequest('mqtt://127.0.0.1:' + server.port + '/projector', "GET")
   .then(function(context) {
    context.response["iopa.Body"].pipe(process.stdout);
    context["iopa.Body"].end("CONNECT");
   });
});
``` 
  
## Roadmap

Next steps are to build a reference framework to link together server, client, discovery and other protocol functions.

Adding additional features of the protocol such as QOS1 and QOS2, is as simple as adding a new middleware function 
  

 