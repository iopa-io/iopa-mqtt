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

var util = require('util');
var stream = require('stream');
var Readable  = stream.Readable;
var Writable = stream.Writable;
var BufferList = require('bl');

/**
 * Represents an IOPA Incoming Message Body 
 *
 * @class IncomingMessagetream
 * @constructor
 */
 function IncomingMessageStream() {
  Readable.call(this)
  this._lastId = 0
}

util.inherits(IncomingMessageStream, Readable)

IncomingMessageStream.prototype.append = function(buf) {
  if (!this.readable)
    return;

  this.push(buf);
}

IncomingMessageStream.prototype.close = function() {
  this.push(null);
  this.emit('finish');
}

// nothing to do, data will be pushed from the server
IncomingMessageStream.prototype._read = function() {}

module.exports.IncomingMessageStream = IncomingMessageStream;

/**
 * Represents an IOPA Outgoing Message Body for send-once protocols (e.g., HTTP Request)
 *
 * @class OutgoingStream
 * @constructor
 */
function OutgoingStream() {
  Writable.call(this);
  this._firstwrite = false;
  this._buffer = new BufferList();
}

util.inherits(OutgoingStream, Writable);

OutgoingStream.prototype._write = function (chunk, encoding, done) {
  if (!this._firstwrite)
  {
    this._firstwrite = true;
     this.emit('start');
  }
  
  this._buffer.write(chunk);
  //  this.emit('data', chunk);
    
  done();
};

OutgoingStream.prototype.slice = function() {
  return this._buffer.slice();
}

OutgoingStream.prototype.toString = function() {
   return this._buffer.slice().toString();
};

module.exports.OutgoingStream = OutgoingStream;

/**
 * Represents an IOPA Stream that Transforms data using supplied function
 *
 * @class OutgoingStream
 * @constructor
 */
function OutgoingStreamTransform(transformFunc) {
  Writable.call(this);
  this._write = transformFunc;
 }

util.inherits(OutgoingStreamTransform, Writable);

module.exports.OutgoingStreamTransform = OutgoingStreamTransform;


var EmptyBuffer = new Buffer(0);

/**
 * Represents an IOPA Outgoing Message Body for no payload protocols (e.g., MQTT Acknowledge)
 *
 * @class OutgoingNoPayloadStream
 * @constructor
 */
function OutgoingNoPayloadStream() {
  Writable.call(this);
}

util.inherits(OutgoingNoPayloadStream, Writable);

OutgoingNoPayloadStream.prototype._write = function (chunk, encoding, done) {
   throw new Error("Stream does not support payload data in IOPA Body");
};

OutgoingNoPayloadStream.prototype.slice = function() {
  return EmptyBuffer;
};

OutgoingNoPayloadStream.prototype.toString = function() {
  return "";
};

module.exports.OutgoingNoPayloadStream = OutgoingNoPayloadStream;

/**
 * Represents an IOPA Outgoing Message Body for multi-send protocols (e.g., COAP Observe, MQTT, WebSocket)
 *
 * @class OutgoingMultiSendStream
 * @constructor
 */
function OutgoingMultiSendStream() {
  Writable.call(this);

  this._counter = 0;
  this._firstwrite = false;
  this.lastData = EmptyBuffer;
}

util.inherits(OutgoingMultiSendStream, Writable);

OutgoingMultiSendStream.prototype._write = function write(data, encoding, callback) {
   if (!this._firstwrite)
  {
    this._firstwrite = true;
     this.emit('start');
  }
  
 // this._context["iopa.Headers"]["Observe"] = ++this._counter;
 
  if (this._counter === 16777215)
    this._counter = 1;

  this.emit('data', data);
  this.lastData = data;
  callback();
};

OutgoingMultiSendStream.prototype.slice = function() {
  return this.lastData;
};

OutgoingMultiSendStream.prototype.toString = function() {
   return this.lastData.toString();
};

module.exports.OutgoingMultiSendStream = OutgoingMultiSendStream;
