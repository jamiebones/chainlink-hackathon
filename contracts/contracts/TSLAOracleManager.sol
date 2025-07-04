// contract address - 0x9005aa9B6C40369F6486856093C59aA0e8598D88
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

interface IMarketStatusOracle {
    function isMarketOpen() external view returns (bool);
}

contract TSLAOracleManager is FunctionsClient, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    // Chainlink Functions
    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;

    // TWAP/Circuit Breaker
    uint256 public windowSize;
    uint256[] public prices;
    uint256 public pointer;
    uint256 public priceCount;
    uint256 public twap;
    uint256 public lastPrice;
    bool public circuitBreakerActive;

    // External MarketStatusOracle
    IMarketStatusOracle public marketStatusOracle;

    // Chainlink config (update for your network as needed)
    address private router = 0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0;
    bytes32 private donID = 0x66756e2d6176616c616e6368652d66756a692d31000000000000000000000000;
    uint32 constant gasLimit = 300000;

    string constant source =
        'const apiKey = "VQCHMJ6090ZBZRLX";\n'
        "const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=TSLA&apikey=${apiKey}`;\n"
        "const response = await Functions.makeHttpRequest({ url });\n"
        'if (response.error) { throw Error("API request failed") }\n'
        'const data = response.data["Global Quote"];\n'
        'if (!data || !data["05. price"]) { throw Error("Invalid API response") }\n'
        'const tslaPrice = parseFloat(data["05. price"]);\n'
        "return Functions.encodeUint256(Math.round(tslaPrice * 100));";

    event OracleUpdate(
        uint256 indexed price,
        uint256 indexed twap,
        bool circuitBreaker
    );

    constructor(
        uint256 _windowSize,
        address _marketStatusOracle,
        address _router,
        bytes32 _donID
    ) FunctionsClient(_router) ConfirmedOwner(msg.sender) {
        require(_windowSize > 0 && _windowSize < 1000, "Invalid window size");
        windowSize = _windowSize;
        prices = new uint256[](_windowSize);
        pointer = 0;
        priceCount = 0;
        router = _router;
        donID = _donID;
        marketStatusOracle = IMarketStatusOracle(_marketStatusOracle);
    }

    // Allows owner to update window size (resets price history)
    function setWindowSize(uint256 _size) external onlyOwner {
        require(_size > 0 && _size < 1000, "Window too large/small");
        windowSize = _size;
        prices = new uint256[](_size);
        pointer = 0;
        priceCount = 0;
        twap = 0;
        lastPrice = 0;
        circuitBreakerActive = false;
    }

    // Automation or keeper can call this every minute
    function sendRequest(uint64 subscriptionId) public returns (bytes32) {
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

    // Chainlink fulfillment
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (s_lastRequestId != requestId) revert("Bad Request Id");
        s_lastResponse = response;
        s_lastError = err;
        if (err.length == 0 && response.length == 32) {
            uint256 newPrice = abi.decode(response, (uint256));
            prices[pointer] = newPrice;
            pointer = (pointer + 1) % windowSize;
            if (priceCount < windowSize) priceCount++;

            // Compute TWAP
            uint256 sum = 0;
            for (uint256 i = 0; i < priceCount; i++) {
                sum += prices[i];
            }
            twap = sum / priceCount;

            // Circuit breaker: ±20% from TWAP
            circuitBreakerActive = false;
            if (priceCount == windowSize && twap > 0) {
                uint256 pct = (newPrice * 1e4) / twap;
                if (pct > 12000 || pct < 8000) {
                    circuitBreakerActive = true;
                }
            }
            lastPrice = newPrice;
            emit OracleUpdate(newPrice, twap, circuitBreakerActive);
        }
    }

    // Returns true if circuit breaker is active
    function isPaused() external view returns (bool) {
        return circuitBreakerActive;
    }

    // Reads current market status from the MarketStatusOracle contract
    function isMarketOpen() external view returns (bool) {
        return marketStatusOracle.isMarketOpen();
    }

    function getPriceTSLA() external view returns (uint256) {
        return lastPrice;
    }
}


//verify 