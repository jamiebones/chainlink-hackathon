// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {FunctionsClient} from "@chainlink/contracts@1.4.0/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts@1.4.0/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts@1.4.0/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

contract MarketStatusOracle is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;

    bool public isMarketOpen;

    address constant router = 0x234a5fb5Bd614a7AA2FfAB244D603abFA0Ac5C5C;
    bytes32 constant donID = 0x66756e2d617262697472756d2d7365706f6c69612d3100000000000000000000;
    uint32 constant gasLimit = 200000;

    // Finnhub API key is hardcoded below!
    string constant source =
        "const apiKey = \"d10lgh1r01qlsac9rn90d10lgh1r01qlsac9rn9g\";\n"
        "const url = `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${apiKey}`;\n"
        "const response = await Functions.makeHttpRequest({ url });\n"
        "if (!response || response.error) { return Functions.encodeUint256(0); }\n"
        "const isOpen = response.data.isOpen;\n"
        "return Functions.encodeUint256(isOpen ? 1 : 0);";

    event MarketStatusUpdated(bool isOpen);

    constructor() FunctionsClient(router) ConfirmedOwner(msg.sender) {}

    function sendRequest(uint64 subscriptionId) public onlyOwner returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        s_lastRequestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donID
        );
        return s_lastRequestId;
    }

    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (s_lastRequestId != requestId) revert("Bad Request Id");
        s_lastResponse = response;
        s_lastError = err;
        if (err.length == 0 && response.length == 32) {
            uint256 open = abi.decode(response, (uint256));
            isMarketOpen = (open == 1);
            emit MarketStatusUpdated(isMarketOpen);
        }
    }
}
