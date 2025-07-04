"use strict";
// ====================================================================
// MINIMAL FEE CALCULATOR FOR PERP EXECUTOR
// ====================================================================
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.feeCalculator = exports.FeeCalculator = void 0;
var FeeCalculator = /** @class */ (function () {
    function FeeCalculator() {
        // Default fee configuration (can be updated from contract)
        this.config = {
            openFeeBps: 10, // 0.1%
            closeFeeBps: 10, // 0.1%
            borrowingRateAnnualBps: 1000, // 10% annual
            fundingRateBps: 0, // 0% initially
            lastUpdate: Date.now()
        };
        console.log('💰 Fee calculator initialized');
    }
    // ====================================================================
    // OPENING FEES
    // ====================================================================
    /**
     * Calculate opening fee for a new position
     */
    FeeCalculator.prototype.calculateOpeningFee = function (positionSizeUsd) {
        var fee = (positionSizeUsd * BigInt(this.config.openFeeBps)) / 10000n;
        console.log("\uD83D\uDCB0 Opening fee: ".concat(this.formatUSDC(fee), " (").concat(this.config.openFeeBps / 100, "% of ").concat(this.formatUSDC(positionSizeUsd), ")"));
        return fee;
    };
    /**
     * Calculate closing fee for a position
     */
    FeeCalculator.prototype.calculateClosingFee = function (positionSizeUsd) {
        var fee = (positionSizeUsd * BigInt(this.config.closeFeeBps)) / 10000n;
        console.log("\uD83D\uDCB0 Closing fee: ".concat(this.formatUSDC(fee), " (").concat(this.config.closeFeeBps / 100, "% of ").concat(this.formatUSDC(positionSizeUsd), ")"));
        return fee;
    };
    // ====================================================================
    // BORROWING FEES
    // ====================================================================
    /**
     * Calculate borrowing fee based on time elapsed
     */
    FeeCalculator.prototype.calculateBorrowingFee = function (positionSizeUsd, timeElapsedHours) {
        // Convert annual rate to hourly
        var hourlyRateBps = this.config.borrowingRateAnnualBps / (365 * 24);
        var fee = (positionSizeUsd * BigInt(Math.floor(hourlyRateBps * timeElapsedHours))) / 10000n;
        console.log("\uD83D\uDCB0 Borrowing fee: ".concat(this.formatUSDC(fee), " (").concat(timeElapsedHours, "h at ").concat(this.config.borrowingRateAnnualBps / 100, "% annual)"));
        return fee;
    };
    // ====================================================================
    // FUNDING RATES
    // ====================================================================
    /**
     * Calculate funding fee for a position
     */
    FeeCalculator.prototype.calculateFundingFee = function (positionSizeUsd, isLong, fundingRateBps) {
        if (fundingRateBps === void 0) { fundingRateBps = this.config.fundingRateBps; }
        // Funding fee = position size * funding rate
        // Long pays positive funding, short receives it
        var fee = (positionSizeUsd * BigInt(Math.abs(fundingRateBps))) / 10000n;
        // If long position and positive funding rate, pay fee
        // If short position and positive funding rate, receive fee (negative)
        if (isLong && fundingRateBps > 0) {
            // Long pays
            console.log("\uD83D\uDCB0 Funding fee (LONG pays): ".concat(this.formatUSDC(fee)));
            return fee;
        }
        else if (!isLong && fundingRateBps > 0) {
            // Short receives
            console.log("\uD83D\uDCB0 Funding fee (SHORT receives): -".concat(this.formatUSDC(fee)));
            return -fee;
        }
        else if (isLong && fundingRateBps < 0) {
            // Long receives
            console.log("\uD83D\uDCB0 Funding fee (LONG receives): -".concat(this.formatUSDC(fee)));
            return -fee;
        }
        else if (!isLong && fundingRateBps < 0) {
            // Short pays
            console.log("\uD83D\uDCB0 Funding fee (SHORT pays): ".concat(this.formatUSDC(fee)));
            return fee;
        }
        return 0n; // No funding if rate is 0
    };
    /**
     * Update funding rate based on long/short imbalance
     */
    FeeCalculator.prototype.updateFundingRate = function (totalLongUsd, totalShortUsd, sensitivity // bps per 1% imbalance
    ) {
        if (sensitivity === void 0) { sensitivity = 100; }
        var totalOI = totalLongUsd + totalShortUsd;
        if (totalOI === 0n) {
            this.config.fundingRateBps = 0;
            return;
        }
        // Calculate imbalance: (long - short) / total
        var imbalance = Number(totalLongUsd - totalShortUsd) / Number(totalOI);
        // Funding rate = imbalance * sensitivity
        this.config.fundingRateBps = Math.floor(imbalance * sensitivity);
        this.config.lastUpdate = Date.now();
        console.log("\uD83D\uDCCA Funding rate updated: ".concat(this.config.fundingRateBps / 100, "% (imbalance: ").concat((imbalance * 100).toFixed(2), "%)"));
    };
    // ====================================================================
    // COMPREHENSIVE FEE CALCULATION
    // ====================================================================
    /**
     * Calculate all fees for opening a new position
     */
    FeeCalculator.prototype.calculateNewPositionFees = function (positionSizeUsd, marginAmount, isLong) {
        var openingFee = this.calculateOpeningFee(positionSizeUsd);
        var borrowingFee = 0n; // No borrowing fee on opening
        var fundingFee = 0n; // No funding fee on opening
        var totalFees = openingFee + borrowingFee + fundingFee;
        var netMargin = marginAmount - totalFees;
        if (netMargin < 0n) {
            throw new Error("Insufficient margin to cover fees: ".concat(this.formatUSDC(marginAmount), " < ").concat(this.formatUSDC(totalFees)));
        }
        var breakdown = {
            openingFee: openingFee,
            borrowingFee: borrowingFee,
            fundingFee: fundingFee,
            totalFees: totalFees,
            netMargin: netMargin
        };
        console.log("\uD83D\uDCB0 Position fees breakdown:");
        console.log("   Opening: ".concat(this.formatUSDC(openingFee)));
        console.log("   Total: ".concat(this.formatUSDC(totalFees)));
        console.log("   Net margin: ".concat(this.formatUSDC(netMargin)));
        return breakdown;
    };
    /**
     * Calculate fees for an existing position over time
     */
    FeeCalculator.prototype.calculateExistingPositionFees = function (positionSizeUsd, isLong, hoursElapsed) {
        var openingFee = 0n; // Already paid
        var borrowingFee = this.calculateBorrowingFee(positionSizeUsd, hoursElapsed);
        var fundingFee = this.calculateFundingFee(positionSizeUsd, isLong);
        var totalFees = openingFee + borrowingFee + fundingFee;
        return {
            openingFee: openingFee,
            borrowingFee: borrowingFee,
            fundingFee: fundingFee,
            totalFees: totalFees,
            netMargin: -totalFees // Negative since these are costs
        };
    };
    // ====================================================================
    // BATCH FEE CALCULATIONS
    // ====================================================================
    /**
     * Calculate total fees for a batch of trades
     */
    FeeCalculator.prototype.calculateBatchFees = function (trades) {
        console.log("\uD83D\uDCB0 Calculating fees for batch of ".concat(trades.length, " trades..."));
        var totalFees = 0n;
        var totalNetMargin = 0n;
        var feesByTrade = [];
        for (var _i = 0, trades_1 = trades; _i < trades_1.length; _i++) {
            var trade = trades_1[_i];
            var breakdown = this.calculateNewPositionFees(trade.positionSizeUsd, trade.marginAmount, trade.isLong);
            totalFees += breakdown.totalFees;
            totalNetMargin += breakdown.netMargin;
            feesByTrade.push(breakdown);
        }
        console.log("\uD83D\uDCB0 Batch totals: Fees=".concat(this.formatUSDC(totalFees), ", Net margin=").concat(this.formatUSDC(totalNetMargin)));
        return {
            totalFees: totalFees,
            totalNetMargin: totalNetMargin,
            feesByTrade: feesByTrade
        };
    };
    // ====================================================================
    // CONFIGURATION MANAGEMENT
    // ====================================================================
    /**
     * Update fee configuration (e.g., from contract)
     */
    FeeCalculator.prototype.updateFeeConfig = function (newConfig) {
        this.config = __assign(__assign(__assign({}, this.config), newConfig), { lastUpdate: Date.now() });
        console.log('💰 Fee config updated:', {
            openFee: "".concat(this.config.openFeeBps / 100, "%"),
            closeFee: "".concat(this.config.closeFeeBps / 100, "%"),
            borrowingRate: "".concat(this.config.borrowingRateAnnualBps / 100, "%"),
            fundingRate: "".concat(this.config.fundingRateBps / 100, "%")
        });
    };
    /**
     * Get current fee configuration
     */
    FeeCalculator.prototype.getFeeConfig = function () {
        return __assign({}, this.config);
    };
    /**
     * Get current funding rate
     */
    FeeCalculator.prototype.getCurrentFundingRate = function () {
        return this.config.fundingRateBps;
    };
    // ====================================================================
    // VALIDATION
    // ====================================================================
    /**
     * Validate that margin covers minimum fees
     */
    FeeCalculator.prototype.validateMinimumMargin = function (margin, positionSize) {
        var minimumFees = this.calculateOpeningFee(positionSize);
        return margin > minimumFees;
    };
    /**
     * Calculate minimum margin required
     */
    FeeCalculator.prototype.calculateMinimumMargin = function (positionSize) {
        var openingFee = this.calculateOpeningFee(positionSize);
        // Add 1% buffer
        return openingFee + (openingFee / 100n);
    };
    // ====================================================================
    // UTILITIES
    // ====================================================================
    FeeCalculator.prototype.formatUSDC = function (amount) {
        return "$".concat((Number(amount) / 1e6).toFixed(2));
    };
    /**
     * Get fee summary for display
     */
    FeeCalculator.prototype.getFeeSummary = function () {
        return {
            openingFee: "".concat(this.config.openFeeBps / 100, "%"),
            closingFee: "".concat(this.config.closeFeeBps / 100, "%"),
            borrowingRateAnnual: "".concat(this.config.borrowingRateAnnualBps / 100, "%"),
            currentFundingRate: "".concat(this.config.fundingRateBps / 100, "%"),
            lastUpdated: new Date(this.config.lastUpdate).toISOString()
        };
    };
    /**
     * Clear config (for testing)
     */
    FeeCalculator.prototype.reset = function () {
        this.config = {
            openFeeBps: 10,
            closeFeeBps: 10,
            borrowingRateAnnualBps: 1000,
            fundingRateBps: 0,
            lastUpdate: Date.now()
        };
        console.log('🧹 Fee calculator reset to defaults');
    };
    return FeeCalculator;
}());
exports.FeeCalculator = FeeCalculator;
// Export singleton instance
exports.feeCalculator = new FeeCalculator();
