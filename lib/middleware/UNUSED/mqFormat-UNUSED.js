// PUBLIC METHODS

/**
 * Coap IOPA Utility to Convert Raw CoAP Buffer to IOPA Incoming Server Request/Response 
 * 
 * @function RequestFromBuffer
 * @public
 */
 module.exports.ParseFromBuffer = function coapFormat_requestFromBuffer(context, buffer) {
    /*
     *   packet contains:
     *       code   string
     *       confirmable   boolean
     *       reset   boolean    
     *       ack    boolean
     *       messageId  UInt16
     *       token: buffer hex
     *       options    array   {name: string, value: buffer}
     *       payload   buffer
     */

    var packet = CoapPacket.parse(buffer);
 
    if (packet.code > '0.00' && packet.code<'1.00')
      return _coapFormat_requestFromPacket(packet, context)
    else
      return _coapFormat_responseFromBuffer(packet, context);
  }



/**
 * Coap IOPA Utility to Convert Raw CoAP Buffer to IOPA Incoming Server Response 
 * 
 * @function _coapFormat_responseFromBuffer
 * @private
 */
function _coapFormat_responseFromBuffer(packet, context) {
    /*
     *   packet contains:
     *       code   string
     *       confirmable   boolean
     *       reset   boolean    
     *       ack    boolean
     *       messageId  UInt16
     *       token: buffer hex
     *       options    array   {name: string, value: buffer}
     *       payload   buffer
     */
 
    context["server.IsRequest"] = false;
  
    // PARSE PACKET
    var headers= {};
    var options = packet.options;
    var paths   = [];
    var queries = [];

    for (var i=0; i < options.length; i++) {
    var option = options[i]

    if (option.name === 'Uri-Path') {
    paths.push(option.value)
    }

    if (option.name === 'Uri-Query') {
    queries.push(option.value)
    }

    option.value = helpers.fromBinary(option.name, option.value);

    headers[option.name] = option.value;
    };

    if (headers['Content-Format'])
        headers['Content-Type'] = headers['Content-Format'];

    context["iopa.ResponseHeaders"] = headers;
    context['iopa.ResponseStatusCode'] = packet.code;
    context["iopa.ResponseReasonPhrase"] = helpers.STATUS_CODES[packet.code];
    context["iopa.ResponseProtocol"] = "MQTT/3.1.1";
    context["coap.ResponseAck"] = packet.ack;
    context["coap.ResponseReset"] = packet.reset;
    context["coap.ResponseConfirmable"] = packet.confirmable;
    context["coap.ResponseMessageId"] = packet.messageId;
    context["coap.ResponseToken"] = packet.token;
    context["iopa.ResponseBody"] = new IopaStream.BufferStream(packet.payload);
    context["coap.ResponseOptions"] = undefined;  // USE iopa.ResponseHeaders instead
    context["coap.ResponseCode"] = undefined;  // USE iopa.ResponseStatusCode instead
}

/**
 * Coap IOPA Utility to Convert IOPA Outgoing Server Response to Raw CoAP Buffer
 * 
 * @function ResponseToBuffer
 * @public
 */
 module.exports.ResponseToBuffer = function coapFormat_responseToBuffer(context) {
   var packet = {
     code: context['iopa.ResponseStatusCode'],
     confirmable: context["coap.ResponseConfirmable"],
     reset: context["coap.ResponseReset"],
     ack: context["coap.ResponseAck"],
     messageId: context["coap.ResponseMessageId"],
     token: context["coap.ResponseToken"],
     payload: context["iopa.ResponseBody"].slice()
   };
 
   var headers = context["iopa.ResponseHeaders"];
   var options = [];
 
   for (var key in headers) {
     if (headers.hasOwnProperty(key)) {
       if (key == 'Content-Type')
         key = 'Content-Format';
 
       options.push({
         name: key,
         value: headers[key]
       });
     }
   };
 
   packet.options = options;
 
   context["coap.OutgoingPacket"] = packet;

   var buf = CoapPacket.generate(packet);
 
   return buf;
 }

/**
 * Coap IOPA Utility to Convert IOPA Outgoing Server Append Message to Raw CoAP Buffer
 * 
 * @function ResponseAppendToBuffer
 * @public
 */
module.exports.ResponseAppendToBuffer = function coapFormat_responseAppendToBuffer(context, data) {
   var  packet = {
      code: context['iopa.ResponseStatusCode']
    , confirmable: context["coap.ResponseConfirmable"]
    , reset: context["coap.ResponseReset"]
    , ack: context["coap.ResponseAck"]
    , messageId: context["coap.ResponseMessageId"]
    , token: context["coap.ResponseToken"]
    , payload: data
  }
  
    var headers = context["iopa.ResponseHeaders"];
    var options= [];
  
    for(var key in headers){    
      if( headers.hasOwnProperty( key ) ) {
        if (key == 'Content-Type')
          key = 'Content-Format';

        options.push({ name: key, value: headers[key] });
      }
    };

    packet.options = options;

    context["coap.OutgoingPacket"] = packet;

    var buf = CoapPacket.generate(packet)
  
    return buf
}

/**
 * Coap IOPA Utility to create Raw CoAP Buffer containing 5.00 Error Message
 * 
 * @function Generate500ErrorToBuffer
 * @public
 */
module.exports.Generate500ErrorToBuffer = function coapFormat_500ErrorToBuffer(errorPayload) {
  var buf = CoapPacket.generate({ code: '5.00', payload: errorPayload });
  return buf
}

/**
 * Coap IOPA Utility to create Raw CoAP Buffer containing 0.00 Ack Message for given Message Id
 * 
 * @function GenerateAckToBuffer
 * @public
 */
module.exports.GenerateAckToBuffer = function coapFormat_GenerateAckToBuffer(context) {
    var buf = CoapPacket.generate( {
              messageId: context["coap.MessageId"]
            , code: '0.00'
            , options: []
            , confirmable: false
            , ack: true
            , reset: false
          });
   
  return buf
}