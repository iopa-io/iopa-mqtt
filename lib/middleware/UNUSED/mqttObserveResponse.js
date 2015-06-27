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

/**
 * Coap IOPA Middleware:  Append Matched Response to Original Context Observe Stream or Response Stream
 *
 * @class CoAPObserveResponse
 * @this app.properties  the IOPA AppBuilder Properties Dictionary
 * @constructor
 */
function MQTTObserveResponse() {
  //    if (!this["server.Capabilities"]["CoAPCacheMatchResponse.Version"])
    //    throw ("Missing Dependency: COAP Match Response Middleware in Pipeline");

    this["server.Capabilities"]["CoAPObserve.Version"] = "1.0";
}

/**
 * @method invoke
 * @this context IOPA context dictionary
 * @param next   IOPA application delegate for the remainder of the pipeline
 */
MQTTObserveResponse.invoke = function MQTTObserveResponse_invoke(context, next) {
    context["iopa.Events"].on("coap.MatchResponse", _matchedResponseInvoke.bind(this, context));
    return next();
}

/**
 * @method _matchedResponseInvoke
 * @this the original request context IOPA context dictionary
 * @param response the new response IOPA context dictionary
 */
function _matchedResponseInvoke(response) {
  if (!response["iopa.ResponseHeaders"]['Observe']) {
    this["iopa.ResponseBody"].emit("response");
    this["iopa.ResponseBody"].append(response["iopa.ResponseBody"].slice());
    this["iopa.ResponseBody"].close();
  }
  else if (response["iopa.ResponseHeaders"]['Observe'] > this["iopa.ResponseHeaders"]['Observe']) {
    if (this["iopa.ResponseHeaders"]['Observe'] == 0)
      this["iopa.ResponseBody"].emit("response");
    this["iopa.ResponseHeaders"]['Observe'] = response["iopa.ResponseHeaders"]['Observe'];
    this["iopa.ResponseBody"].append(response["iopa.ResponseBody"].slice());
  }
  else {
    return;
  }
}

module.exports = MQTTObserveResponse;

