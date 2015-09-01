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
 var Promise = require('bluebird')
    , MqttPacket = require('mqtt-packet')
    , util = require('util')
    , iopaStream = require('iopa-common-stream')
    , iopaContextFactory = require('iopa').context.factory
    
// SETUP REQUEST DEFAULTS 
const maxMessageId   = Math.pow(2, 16);
var _lastMessageId = Math.floor(Math.random() * (maxMessageId - 1));

/**
 * MQTT IOPA Utility to Convert and Send Outgoing Client Owin Request in Raw MQTT Packet (buffer)
 * 
 * @method SendRequest
 * @object context IOPA context dictionary
 * @returns void
 * @private
 */
module.exports.sendRequest = function mqttFormat_SendRequest(context) {

       if (!context["iopa.MessageId"])
        context["iopa.MessageId"] = _nextMessageId();
     
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
           packet.messageId = context["iopa.MessageId"];
           packet.qos = context["mqtt.Qos"];           
           packet.subscriptions =  context["mqtt.Subscriptions"];
          break;
        case "UNSUBSCRIBE":
           packet.messageId = context["iopa.MessageId"];
           packet.unsubscriptions = context["mqtt.Unsubscriptions"];
          break; 
        case "PUBLISH":
           packet.messageId = context["iopa.MessageId"];
           packet.qos = context["mqtt.Qos"];
           packet.dup = context["mqtt.Dup"];
           packet.retain = context["mqtt.Retain"];
           packet.topic = context["iopa.Path"];
           packet.payload = context["iopa.Body"].toBuffer();
           packet.length = packet.payload.length;
           break; 
        case "PINGREQ":
           break;
        case "DISCONNECT":
           break;
     }
           
     var buf = MqttPacket.generate(packet);
     context["server.RawStream"].write(buf);
};

/**
 * @method inboundParseMonitor
 * @object context IOPA context dictionary
  */
module.exports.inboundParseMonitor = function ResponseParser(parentContext, eventType) {
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
        context.response["server.TLS"] = parentContext.response["server.TLS"];    
        context.response["server.RemoteAddress"] = parentContext.response["server.RemoteAddress"];    
        context.response["server.RemotePort"] = parentContext.response["server.RemotePort"];    
        context.response["server.LocalAddress"] = parentContext.response["server.LocalAddress"];    
        context.response["server.LocalPort"] = parentContext.response["server.LocalPort"];    
        context.response["server.RawStream"] = parentContext.response["server.RawStream"];    
        context["server.Logger"] = parentContext["server.Logger"];
        
        context["server.ChannelContext"] = parentContext;
        context["server.CreateRequest"] = parentContext["server.CreateRequest"];
        _parsePacket(packet, context);
      
        parentContext["iopa.Events"].emit(eventType, context);
        context["server.InProcess"] = false;
        _onClose(context);
        that = null;
        context = null;
      }
      
      function _error(context) {
        context["server.Logger"].error("[MQTTFORMAT] Error parsing MQTT Packet");
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
       context["mqtt.ClientID"] = context["server.Id"];
       context["mqtt.Keepalive"] = 0;
       context["mqtt.Username"] = null;
       context["mqtt.Password"] = null;
       context["mqtt.Will"] = undefined;
       context["iopa.MessageId"] = "connect";
       break;
    case "SUBSCRIBE":
       context["mqtt.Qos"] = 0;
       context["iopa.MessageId"] = _nextMessageId();
       context["mqtt.Subscriptions"] = [{"topic": context["iopa.Path"], "qos": 0}];
      break;
    case "UNSUBSCRIBE":
       context["iopa.MessageId"] = _nextMessageId();
       context["mqtt.Unsubscriptions"] = [context["iopa.Path"]];
      break; 
    case "PUBLISH":
       context["iopa.MessageId"] = _nextMessageId();
       context["mqtt.Qos"] = 2;
       context["mqtt.Dup"] = false;
       context["mqtt.Retain"] = false;
       break; 
    case "PINGREQ":
       context["iopa.MessageId"] = "ping";
       break;
    case "DISCONNECT":
        context["iopa.MessageId"] = "disconnect";
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
    context["server.IsRequest"] = true;
    context["server.IsLocalOrigin"] = false;
  
    // PARSE PACKET
    var headers= {};
   
    headers["Content-Length"] = packet.length;
  
    context["iopa.Headers"] = headers;
    context["iopa.Path"] = packet.topic || "";
    context["iopa.PathBase"] = "";
    context["iopa.QueryString"] = "";
    context["iopa.Method"] = packet.cmd.toUpperCase();
    context["iopa.Protocol"] = "MQTT/3.1.1";
    context["iopa.Body"] = iopaStream.EmptyStream;
    context["iopa.StatusCode"] = 0;
         
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
           context["iopa.MessageId"] = "connect";
           break;
        case "SUBSCRIBE":
           context["iopa.MessageId"] = packet.messageId;
           context["mqtt.Subscriptions"] = packet.subscriptions;
          break;
        case "UNSUBSCRIBE":
           context["iopa.MessageId"] = packet.messageId;
           context["mqtt.Unsubscriptions"] = packet.unsubscriptions;
          break; 
        case "PUBLISH":
           context["iopa.MessageId"] = packet.messageId;
           context["mqtt.Qos"] = packet.qos;
           context["mqtt.Dup"] =  packet.dup;
           context["mqtt.Retain"] =  packet.retain;
           context["iopa.Path"] = packet.topic;
           context["iopa.Body"] = new iopaStream.BufferStream(packet.payload);
           break; 
        case "PINGREQ":
           context["iopa.MessageId"] = "ping";
           break;
        case "DISCONNECT":
           context["iopa.MessageId"] = "disconnect";
           break; 
         case "CONNACK":
           context["iopa.StatusCode"] = packet.returnCode;
           context["mqtt.SessionPresent"] = packet.sessionPresent;
           context["iopa.MessageId"] = "connect";
           break;
         case "SUBACK":
          context["iopa.MessageId"] = packet.messageId;
          context["mqtt.Granted"] = packet.granted;
          break;
        case "UNSUBACK":
          context["iopa.MessageId"] = packet.messageId;
          break; 
        case "PUBACK":
         context["iopa.MessageId"] = packet.messageId;
             break; 
        case "PUBREC":
         context["iopa.MessageId"] = packet.messageId;
            break; 
        case "PUBREL":
          context["iopa.MessageId"] = packet.messageId;
            break; 
       case "PUBCOMP":
           context["iopa.MessageId"] = packet.messageId;
         break; 
        case "PINGRESP":
           context["iopa.MessageId"] = "ping";
           break;     
     }
     
    context['iopa.ReasonPhrase'] = returnEnum[context["iopa.StatusCode"]];
     
    // SETUP RESPONSE DEFAULTS
    var response = context.response;
    
    response["iopa.StatusCode"] = 0;
    response["iopa.Headers"] = {};
    response["iopa.Protocol"] = context["iopa.Protocol"];
    response["iopa.MessageId"] = context["iopa.MessageId"];
         
     switch (context["iopa.Method"]) {
           case "CONNECT":
           response["iopa.Method"] = "CONNACK";
           response["iopa.Body"] = new iopaStream.OutgoingNoPayloadStream();
           response["iopa.StatusCode"] = 0;
           response["mqtt.SessionPresent"] = false;
           break;
        case "SUBSCRIBE":
          response["iopa.Method"] = "SUBACK";
          response["iopa.Body"] = new iopaStream.OutgoingMultiSendStream();
          response["mqtt.Granted"] = [];
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
            response["iopa.Body"] = undefined;
        break;
     }
     response['iopa.ReasonPhrase'] = returnEnum[response["iopa.StatusCode"]];
           
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
     
        if (!response["iopa.MessageId"])
          response["iopa.MessageId"] = _nextMessageId();
    
     var  packet = { cmd: response["iopa.Method"].toLowerCase() };
   
     switch (response["iopa.Method"]) {
      case "CONNACK":
         packet.returnCode = response["iopa.StatusCode"];
         response['iopa.ReasonPhrase'] = returnEnum[response["iopa.StatusCode"]];
         packet.sessionPresent = response["mqtt.SessionPresent"];
         break;
      case "SUBACK":
         packet.messageId = response["iopa.MessageId"];
         packet.granted = response["mqtt.Granted"];
        break;
      case "UNSUBACK":
         packet.messageId = response["iopa.MessageId"];
        break; 
      case "PUBACK":
         packet.messageId = response["iopa.MessageId"];
          break; 
      case "PUBREC":
         packet.messageId = response["iopa.MessageId"];
          break; 
      case "PUBREL":
         packet.messageId = response["iopa.MessageId"];
          break; 
     case "PUBCOMP":
         packet.messageId = response["iopa.MessageId"];
        break; 
      case "PINGRESP":
         break;
     }
     
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
   
 // ctx["server.ChannelContext"]["server.RawComplete"]();
};

var returnEnum =
{
  0: 'OK',
  1: 'Unacceptable protocol version',
  2: 'Identifier rejected',
 3: 'Server unavailable',
 4: 'Bad user name or password',
 5: 'Not authorized',
};
