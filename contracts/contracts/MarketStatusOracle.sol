//contract address - 0x7C8cb9E7f3Ff6C81169976bF87F761174B298902
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

contract MarketStatusOracle is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;

    bool public isMarketOpen;
    address private router;
    bytes32 private donID;
    uint32 constant gasLimit = 200000;

    // Finnhub API key is hardcoded below!
    string constant source =
        'const apiKey = "d10lgh1r01qlsac9rn90d10lgh1r01qlsac9rn9g";\n'
        "const url = `https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${apiKey}`;\n"
        "const response = await Functions.makeHttpRequest({ url });\n"
        "if (!response || response.error) { return Functions.encodeUint256(0); }\n"
        "const isOpen = response.data.isOpen;\n"
        "return Functions.encodeUint256(isOpen ? 1 : 0);";

    event MarketStatusUpdated(bool isOpen);

    constructor(address _router, bytes32 _donID) FunctionsClient(_router) ConfirmedOwner(msg.sender) {
        router = _router;
        donID = _donID;
    }

    function sendRequest(
        uint64 subscriptionId
    ) public returns (bytes32 requestId) {
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