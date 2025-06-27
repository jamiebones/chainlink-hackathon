// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library Utils {
    enum Asset {
        TSLA,
        APPL
    }

     enum RequestType {
        OPEN_POSITION
    }

    function calculateMintFee(
        uint256 dexPrice,
        uint256 oraclePrice
    ) public pure returns (uint256) {
        // All values are scaled by 1e18 (18 decimals)
        uint256 BASE_FEE = 5e15; // 0.005 * 1e18 = 0.5%
        uint256 MAX_FEE = 5e16; // 0.05 * 1e18 = 5%
        uint256 MIN_FEE = 2e15; // 0.002 * 1e18 = 0.2%
        uint256 RELAXED_ZONE = 3e16; // 0.03 * 1e18 = 3%
        uint256 MAX_DEV = 2e16; // 0.02 * 1e18 = 2%

        // Calculate deviation: (dexPrice - oraclePrice) / oraclePrice
        int256 deviation = int256(dexPrice) - int256(oraclePrice);
        deviation = (deviation * int256(1e18)) / int256(oraclePrice); // deviation in 1e18

        int256 absDeviation = deviation >= 0 ? deviation : -deviation;

        // Case 1: Within relaxed zone
        if (uint256(absDeviation) <= RELAXED_ZONE) {
            return BASE_FEE;
        }

        // Case 2: sTSLA is undervalued (deviation < -relaxedZone)
        if (deviation < -int256(RELAXED_ZONE)) {
            // adjustedDev = min(abs(deviation) - relaxedZone, 0.02)
            uint256 adjustedDev = uint256(absDeviation) - RELAXED_ZONE;
            if (adjustedDev > MAX_DEV) adjustedDev = MAX_DEV;
            // fee = baseFee + (adjustedDev / 0.02) * (maxFee - baseFee)
            // (adjustedDev * 1e18) / 0.02e18 = adjustedDev * 1e18 / 2e16 = adjustedDev * 50
            uint256 fee = BASE_FEE +
                (adjustedDev * (MAX_FEE - BASE_FEE)) /
                MAX_DEV;
            return fee > MAX_FEE ? MAX_FEE : fee;
        }

        // Case 3: sTSLA is overvalued (deviation > relaxedZone)
        if (deviation > int256(RELAXED_ZONE)) {
            uint256 adjustedDev = uint256(deviation) - RELAXED_ZONE;
            if (adjustedDev > MAX_DEV) adjustedDev = MAX_DEV;
            // fee = baseFee - (adjustedDev / 0.02) * (baseFee - minFee)
            uint256 fee = BASE_FEE -
                (adjustedDev * (BASE_FEE - MIN_FEE)) /
                MAX_DEV;
            return fee < MIN_FEE ? MIN_FEE : fee;
        }

        // Fallback (should not reach here)
        return BASE_FEE;
    }

    function convert18ToUSDCDecimal(
        uint256 value18
    ) public pure returns (uint256) {
        require(value18 != 0, "Invalid Amount");
        return value18 / 1e12;
    }

    function calculateRedeemFee(
        uint256 dexPrice,
        uint256 oraclePrice
    ) public pure returns (uint256) {
        // All values are scaled by 1e18 (18 decimals)
        uint256 BASE_FEE = 5e15; // 0.005 * 1e18 = 0.5%
        uint256 MAX_FEE = 5e16; // 0.05 * 1e18 = 5%
        uint256 MIN_FEE = 2e15; // 0.002 * 1e18 = 0.2%
        uint256 RELAXED_ZONE = 3e16; // 0.03 * 1e18 = 3%
        uint256 MAX_DEV = 2e16; // 0.02 * 1e18 = 2%

        // Calculate deviation: (dexPrice - oraclePrice) / oraclePrice
        int256 deviation = int256(dexPrice) - int256(oraclePrice);
        deviation = (deviation * int256(1e18)) / int256(oraclePrice); // deviation in 1e18
        int256 absDeviation = deviation >= 0 ? deviation : -deviation;
        // Case 1: Within relaxed zone → use base fee
        if (uint256(absDeviation) <= RELAXED_ZONE) {
            return BASE_FEE;
        }

        // Case 2: sTSLA is overvalued → discourage redemption (increase fee)
        if (deviation > int256(RELAXED_ZONE)) {
            uint256 adjustedDev = uint256(deviation) - RELAXED_ZONE;
            if (adjustedDev > MAX_DEV) adjustedDev = MAX_DEV;
            uint256 fee = BASE_FEE +
                (adjustedDev * (MAX_FEE - BASE_FEE)) /
                MAX_DEV;
            return fee > MAX_FEE ? MAX_FEE : fee;
        }

        // Case 3: sTSLA is undervalued → encourage redemption (decrease fee)
        if (deviation < -int256(RELAXED_ZONE)) {
            uint256 adjustedDev = uint256(absDeviation) - RELAXED_ZONE;
            if (adjustedDev > MAX_DEV) adjustedDev = MAX_DEV;
            uint256 fee = BASE_FEE -
                (adjustedDev * (BASE_FEE - MIN_FEE)) /
                MAX_DEV;
            return fee < MIN_FEE ? MIN_FEE : fee;
        }

        // Fallback (should not reach here)
        return BASE_FEE;
    }


}
