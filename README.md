# [![IOPA](http://iopa.io/iopa.png)](http://iopa.io)<br> iopa-mqtt

[![Build Status](https://api.shippable.com/projects/55f5d3431895ca447414fbf6/badge?branchName=master)](https://app.shippable.com/projects/55f5d3431895ca447414fbf6) 
[![IOPA](https://img.shields.io/badge/iopa-middleware-99cc33.svg?style=flat-square)](http://iopa.io)
[![limerun](https://img.shields.io/badge/limerun-certified-3399cc.svg?style=flat-square)](https://nodei.co/npm/limerun/)

[![NPM](https://nodei.co/npm/iopa-mqtt.png?downloads=true)](https://nodei.co/npm/iopa-mqtt/)

## About
`iopa-mqtt` is a full-stack OASIS Message Queuing Telemetry Transport (MQTT) protocol server, based on the Internet of Protocols Alliance (IOPA) open specification  

It servers MQTT messages in standard IOPA format and allows existing middleware for Connect, Express and limerun projects to consume/send each mesage.

It is an open-source, standards-based, lighter-weight replacement for MQTT clients and brokers such as [`mqtt.js`](https://github.com/mqttjs/MQTT.js) [`mosca`](https://github.com/mcollina/mosca) and [`aedes`](https://github.com/mcollina/aedes). 

It uses the standards based ['iopa-mqtt-packet'](https://github.com/iopa-io/iopa-mqtt-packet) for protocol formatting, which in turn is based on the widely used library ['mqtt-packet'](https://github.com/mqttjs/mqtt-packet) for protocol formatting.

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
app.use(iopaMessageLogger);

app.use(function(context, next){
   if (context["iopa.Method"] === "SUBSCRIBE")
   {
     setTimeout(function() {
            server.publish("/projector", new Buffer("Hello World"));
            }, 1000);
   }

   return next();
    });
              
var server = mqtt.createServer(app.build());

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
       server.publish("/projector", new Buffer("Hello World 2"));
    })
  .then(function(){
    setTimeout(function(){
       server.close().then(function(){server.log.info("[DEMO] MQTT DEMO Closed");});
    }, 2000);
    });
    

 });

``` 
  
## Roadmap

Next steps are to build a reference framework to link together server, client, discovery and other protocol functions.

Adding additional features of the protocol such as QOS1 and QOS2, is as simple as adding a new middleware function 
  

 