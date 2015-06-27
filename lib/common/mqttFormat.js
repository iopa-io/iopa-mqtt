/*
 * Copyright 2015 Domabo
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
 var Promise = require('bluebird')
    , MqttPacket = require('mqtt-packet')
    , util = require('util')
    , Uuid = require('node-uuid')
    , iopaStream = require('../common/iopaStream.js')
    , BufferList = require('bl')
    , iopaContextFactory = require('iopa').context.factory
    
// SETUP REQUEST DEFAULTS 
var maxMessageId   = Math.pow(2, 16);
var _lastMessageId = Math.floor(Math.random() * (maxMessageId - 1));
var _clientId = Uuid.v4();

/**
 * MQTT IOPA Utility to Convert and Send Outgoing Client Owin Request in Raw MQTT Packet (buffer)
 * 
 * @method SendRequest
 * @object context IOPA context dictionary
 * @returns void
 * @private
 */
module.exports.sendRequest = function mqttForamt_SendRequest(context) {
       var  packet = {
              cmd: context["iopa.Method"].toLowerCase()
            };
    
      switch (context["iopa.Method"]) {
        case "CONNECT":
           packet.protocolId = context["mqtt.ProtocolId"];
           packet.protocolVersion = context["mqtt.ProtocolVersion"];
           packet.clean = context["mqtt.Clean"];
           packet.clientId = context["mqtt.ClientID"];
           packet.keepalive = context["mqtt.Keepalive"];
           packet.username = context["mqtt.Username"];
           packet.password = context["mqtt.Password"];
           packet.will = context["mqtt.Will"];
           break;
        case "SUBSCRIBE":
           packet.messageId = context["mqtt.MessageId"];
           packet.qos = context["mqtt.Qos"];           
           packet.subscriptions =  context["mqtt.Subscriptions"];
          break;
        case "UNSUBSCRIBE":
           packet.messageId = context["mqtt.MessageId"];
           packet.unsubscriptions = context["mqtt.Unsubscriptions"];
          break; 
        case "PUBLISH":
           packet.messageId = context["mqtt.MessageId"];
           packet.qos = context["mqtt.Qos"];
           packet.dup = context["mqtt.Dup"];
           packet.retain = context["mqtt.Retain"];
           packet.topic = context["iopa.Path"];
           packet.payload = context["iopa.Body"].slice();
           packet.length = packet.payload.length;
           break; 
        case "PINGREQ":
           break;
        case "DISCONNECT":
           break;
     }
       
     console.log("OUTBOUND PACKET");
     console.log(util.inspect(packet));
     
     var buf = MqttPacket.generate(packet);
     context["server.RawStream"].write(buf);
};

/**
 * @method ResponseParser
 * @object context IOPA context dictionary
  */
module.exports.inboundParse = function ResponseParser(parentContext, eventType) {
     var parser  = MqttPacket.parser();
      
      parser.on('packet', _invokePacket);
      parser.on('error', _error.bind(parentContext));
    
      parentContext["server.RawStream"].on('data', function(chunk) {
          parser.parse(chunk);
      });
      
      var that = this;
       
      function _invokePacket(packet) {
        var context = iopaContextFactory.create();
        context["server.TLS"] = parentContext["server.TLS"];
        context["server.RemoteAddress"] = parentContext["server.RemoteAddress"];
        context["server.RemotePort"] = parentContext["server.RemotePort"] ;
        context["server.LocalAddress"] = parentContext["server.LocalAddress"];
        context["server.LocalPort"] = parentContext["server.LocalPort"]; 
        context["server.RawStream"] = parentContext["server.RawStream"];    
        context.response["server.RawStream"] = parentContext.response["server.RawStream"];    
    
        context["server.RawStream"].on("end", _onClose.bind(this, context));
        context["mqtt.ParentContext"] = parentContext;
        _parsePacket(packet, context);
        
        console.log("INBOUND PACKET " + eventType.toUpperCase());
        console.log(util.inspect(packet));
   
        parentContext["iopa.Events"].emit(eventType, context);
        
        context["server.InProcess"] = false;
        _onClose(context);
        that = null;
        context = null;
      }
      
      function _error(context) {
        console.log("Error parsing MQTT Packet");
      } 
};

/**
 * Default IOPA Request for MQTT fields
 *
 * @method defaultContext

 * @object context IOPA context dictionary
 * @returns void
 * @public
 */
module.exports.defaultContext = function MQTTPacketClient_defaultContext(context) {  

  switch (context["iopa.Method"]) {
    case "CONNECT":
       context["mqtt.ProtocolId"] = "MQTT";
       context["mqtt.ProtocolVersion"] = 4;
       context["mqtt.Clean"] = true;
       context["mqtt.ClientID"] = _clientId;
       context["mqtt.Keepalive"] = 0;
       context["mqtt.Username"] = null;
       context["mqtt.Password"] = null;
       context["mqtt.Will"] = undefined;
       break;
    case "SUBSCRIBE":
       context["mqtt.Qos"] = 0;
       context["mqtt.MessageId"] = _nextMessageId();
       context["mqtt.Subscriptions"] = [{"topic": context["iopa.Path"], "qos": 0}];
      break;
    case "UNSUBSCRIBE":
       context["mqtt.MessageId"] = _nextMessageId();
       context["mqtt.Unsubscriptions"] = [context["iopa.Path"]];
      break; 
    case "PUBLISH":
       context["mqtt.MessageId"] = _nextMessageId();
       context["mqtt.Qos"] = 0;
       context["mqtt.Dup"] = false;
       context["mqtt.Retain"] = false;
       context["mqtt.Topic"] = context["iopa.Path"];
       break; 
    case "PINGREQ":
       break;
    case "DISCONNECT":
       break;
  }
  
  return context;
};


// PRIVATE HELPER FUNCTIONS 

/**
 * Helper to Convert Incoming MQTT Packet to IOPA Format
 * 
 * @method _requestFromPacket
 * @object packet MQTT Raw Packet
 * @object ctx IOPA context dictionary
 * @private
 */
function _parsePacket(packet, context) { 
    context["server.IsServerRequest"] = true;
  
    // PARSE PACKET
    var headers= {};
   
    headers["Content-Length"] = packet.length;
  
    context["iopa.Headers"] = headers;
    context["iopa.Path"] = packet.topic;
    context["iopa.PathBase"] = "";
    context["iopa.QueryString"] = "";
    context["iopa.Method"] = packet.cmd.toUpperCase();
    context["iopa.Protocol"] = "MQTT/3.1.1";

    if (context["server.TLS"])
        context["iopa.Scheme"] = "mqtts";
    else
        context["iopa.Scheme"] = "mqtt";

    switch (context["iopa.Method"]) {
           case "CONNECT":
           context["mqtt.ProtocolId"] = packet.protocolId;
           context["mqtt.ProtocolVersion"] = packet.protocolVersion;
           context["mqtt.Clean"] = packet.clean;
           context["mqtt.ClientID"] = packet.clientId;
           context["mqtt.Keepalive"] = packet.keepalive;
           context["mqtt.Username"] = packet.username;
           context["mqtt.Password"] = packet.password;
           context["mqtt.Will"] = packet.will;
           break;
        case "SUBSCRIBE":
           context["mqtt.MessageId"] = packet.messageId;
           context["mqtt.Subscriptions"] = packet.subscriptions;
          break;
        case "UNSUBSCRIBE":
           context["mqtt.MessageId"] = packet.messageId;
           context["mqtt.Unsubscriptions"] = packet.unsubscriptions;
          break; 
        case "PUBLISH":
           context["mqtt.MessageId"] = packet.messageId;
           context["mqtt.Qos"] = packet.qos;
           context["mqtt.Dup"] =  packet.dup;
           context["mqtt.Retain"] =  packet.retain;
           context["iopa.Path"] = packet.topic;
           context["iopa.Body"] = new BufferList(packet.payload);
           break; 
        case "PINGREQ":
           break;
        case "DISCONNECT":
           break; 
     }
     
    // SETUP RESPONSE DEFAULTS
    var response = context.response;
    
    response["iopa.StatusCode"] = 0;
    response["iopa.Headers"] = {};
    response["iopa.ReasonPhrase"] = null;
    response["iopa.Protocol"] = context["iopa.Protocol"];
   
     switch (context["iopa.Method"]) {
           case "CONNECT":
           response["iopa.Method"] = "CONNACK";
           response["iopa.Body"] = new iopaStream.OutgoingNoPayloadStream();
           break;
        case "SUBSCRIBE":
          response["iopa.Method"] = "SUBACK";
          response["iopa.Body"] = new iopaStream.OutgoingMultiSendStream();
          break;
        case "UNSUBSCRIBE":
           response["iopa.Method"] = "UNSUBACK";
           response["iopa.Body"] = new iopaStream.OutgoingNoPayloadStream();
           break; 
        case "PUBLISH":
           response["iopa.Method"] = "PUBACK";
           response["iopa.Body"] = new iopaStream.OutgoingNoPayloadStream();
           break; 
        case "PINGREQ":
           response["iopa.Method"] = "PINGRESP";
           response["iopa.Body"] = new iopaStream.OutgoingNoPayloadStream();
           break;
        case "DISCONNECT":
            response["iopa.Method"] = null;
            response["iopa.Body"] = {};
        break;
     }
     
     switch (response["iopa.Method"]) {
      case "CONNACK":
         response["iopa.StatusCode"] = 0;
         response["mqtt.SessionPresent"] = false;
          break;
      case "SUBACK":
           response["mqtt.MessageId"] = context["mqtt.MessageId"];
          response["mqtt.Granted"] = [0, 1, 2, 128];
         break;
      case "UNSUBACK":
           response["mqtt.MessageId"] = context["mqtt.MessageId"];
      break; 
      case "PUBACK":
           response["mqtt.MessageId"] = context["mqtt.MessageId"];
        break; 
      case "PUBREC":
          response["mqtt.MessageId"] = context["mqtt.MessageId"];
         break; 
      case "PUBREL":
          response["mqtt.MessageId"] = context["mqtt.MessageId"];
         break; 
      case "PUBCOMP":
         response["mqtt.MessageId"] = context["mqtt.MessageId"];
          break; 
      case "PINGRESP":
         break;
    }
    if (response["iopa.Body"])
    {
      response["iopa.Body"].on("finish", _mqttSendResponse.bind(this, context));
      response["iopa.Body"].on("data", _mqttSendResponse.bind(this, context));
    }
}

/**
 * Private method to send response packet
 * Triggered on data or finish events
 * 
 * @method _requestFromPacket
 * @object packet MQTT Raw Packet
 * @object ctx IOPA context dictionary
 * @private
 */
function _mqttSendResponse(context, payload) { 
    var response = context.response;
     var  packet = { cmd: response["iopa.Method"].toLowerCase() };
   
     switch (response["iopa.Method"]) {
      case "CONNACK":
         packet.returnCode = response["iopa.StatusCode"];
         packet.sessionPresent = response["mqtt.SessionPresent"];
         break;
      case "SUBACK":
         packet.messageId = response["mqtt.MessageId"];
         packet.granted = response["mqtt.Granted"];
        break;
      case "UNSUBACK":
         packet.messageId = response["mqtt.MessageId"];
        break; 
      case "PUBACK":
         packet.messageId = response["mqtt.MessageId"];
          break; 
      case "PUBREC":
         packet.messageId = response["mqtt.MessageId"];
          break; 
      case "PUBREL":
         packet.messageId = response["mqtt.MessageId"];
          break; 
     case "PUBCOMP":
         packet.messageId = response["mqtt.MessageId"];
        break; 
      case "PINGRESP":
         break;
     }
     
     console.log("RESPONSE PACKET OUTBOUND");
     console.log(util.inspect(packet));
     var buf = MqttPacket.generate(packet);
     response["server.RawStream"].write(buf);
}

/**
 * MQTT  Utility for sequential message id
 * 
 * @function _nextMessageId
 * @returns number
 * @private
 */function _nextMessageId() {
  if (++_lastMessageId === maxMessageId)
    _lastMessageId = 1;

  return _lastMessageId;
};

/**
 * Helper to Close Incoming MQTT Packet
 * 
 * @method _onClose
 * @object packet MQTT Raw Packet
 * @object ctx IOPA context dictionary
 * @private
 */
function _onClose(ctx) {
    setTimeout(function() {
        iopaContextFactory.dispose(ctx);
    }, 1000);
    
   if (ctx["server.InProcess"])
     ctx["iopa.CallCancelledSource"].cancel('Client Socket Disconnected');
   
 // ctx["mqtt.ParentContext"]["server.RawComplete"]();
};