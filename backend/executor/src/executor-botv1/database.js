"use strict";
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
exports.database = exports.MinimalDatabase = void 0;
var fs = require("fs");
var path = require("path");
var MinimalDatabase = /** @class */ (function () {
    function MinimalDatabase(dataDir) {
        if (dataDir === void 0) { dataDir = './data'; }
        this.backupPath = path.join(dataDir, 'executor-data.json');
        this.ensureDataDirectory(dataDir);
        this.data = this.loadFromBackup();
        console.log('💾 Minimal database initialized');
    }
    // ====================================================================
    // BALANCE MANAGEMENT
    // ====================================================================
    /**
     * Add balance to user (can be negative for deductions)
     */
    MinimalDatabase.prototype.addBalance = function (address, amount) {
        try {
            var current = this.getUserBalance(address);
            this.updateBalance(address, {
                total: current.total + amount,
                available: current.available + amount,
                locked: current.locked
            });
            var action = amount >= 0n ? 'Added' : 'Deducted';
            var absAmount = amount >= 0n ? amount : -amount;
            console.log("\uD83D\uDCB0 ".concat(action, " ").concat(this.formatUSDC(absAmount), " ").concat(amount >= 0n ? 'to' : 'from', " ").concat(address));
            return true;
        }
        catch (error) {
            console.error('Failed to add/deduct balance:', error);
            return false;
        }
    };
    /**
     * Get user balance
     */
    MinimalDatabase.prototype.getUserBalance = function (address) {
        var key = address.toLowerCase();
        var stored = this.data.balances[key];
        if (!stored) {
            return {
                total: 0n,
                available: 0n,
                locked: 0n,
                lastUpdate: Date.now()
            };
        }
        return {
            total: BigInt(stored.total),
            available: BigInt(stored.available),
            locked: BigInt(stored.locked),
            lastUpdate: stored.lastUpdate
        };
    };
    /**
     * Update user balance
     */
    MinimalDatabase.prototype.updateBalance = function (address, balance) {
        var key = address.toLowerCase();
        this.data.balances[key] = {
            total: balance.total.toString(),
            available: balance.available.toString(),
            locked: balance.locked.toString(),
            lastUpdate: Date.now()
        };
        this.saveToBackup();
        console.log("\uD83D\uDCBE Updated balance: ".concat(address));
    };
    /**
     * Lock balance for trading
     */
    MinimalDatabase.prototype.lockBalance = function (address, amount) {
        var current = this.getUserBalance(address);
        if (current.available < amount) {
            console.error("\u274C Insufficient balance to lock: ".concat(this.formatUSDC(current.available), " < ").concat(this.formatUSDC(amount)));
            return false;
        }
        this.updateBalance(address, {
            total: current.total,
            available: current.available - amount,
            locked: current.locked + amount
        });
        console.log("\uD83D\uDD12 Locked ".concat(this.formatUSDC(amount), " for ").concat(address));
        this.saveToBackup();
        return true;
    };
    /**
     * Unlock balance after trade settlement
     */
    MinimalDatabase.prototype.unlockBalance = function (address, amount) {
        var current = this.getUserBalance(address);
        if (current.locked < amount) {
            console.error("\u274C Insufficient locked balance: ".concat(this.formatUSDC(current.locked), " < ").concat(this.formatUSDC(amount)));
            return false;
        }
        this.updateBalance(address, {
            total: current.total,
            available: current.available + amount,
            locked: current.locked - amount
        });
        console.log("\uD83D\uDD13 Unlocked ".concat(this.formatUSDC(amount), " for ").concat(address));
        this.saveToBackup();
        return true;
    };
    /**
     * Deduct fees from balance
     */
    MinimalDatabase.prototype.deductFee = function (address, amount) {
        var current = this.getUserBalance(address);
        if (current.total < amount) {
            console.error("\u274C Insufficient balance for fee: ".concat(this.formatUSDC(current.total), " < ").concat(this.formatUSDC(amount)));
            return false;
        }
        // Deduct from available first, then locked
        var newAvailable = current.available;
        var newLocked = current.locked;
        if (current.available >= amount) {
            newAvailable -= amount;
        }
        else {
            var fromAvailable = current.available;
            var fromLocked = amount - fromAvailable;
            newAvailable = 0n;
            newLocked -= fromLocked;
        }
        this.updateBalance(address, {
            total: current.total - amount,
            available: newAvailable,
            locked: newLocked
        });
        console.log("\uD83D\uDCB8 Deducted ".concat(this.formatUSDC(amount), " fee from ").concat(address));
        this.saveToBackup();
        return true;
    };
    /**
     * Get all balances
     */
    MinimalDatabase.prototype.getAllBalances = function () {
        return Object.entries(this.data.balances).map(function (_a) {
            var address = _a[0], stored = _a[1];
            return ({
                address: address,
                balance: {
                    total: BigInt(stored.total),
                    available: BigInt(stored.available),
                    locked: BigInt(stored.locked),
                    lastUpdate: stored.lastUpdate
                }
            });
        });
    };
    // ====================================================================
    // POSITION MANAGEMENT
    // ====================================================================
    /**
     * Save position
     */
    MinimalDatabase.prototype.savePosition = function (position) {
        var key = "".concat(position.trader.toLowerCase(), "-").concat(position.assetId);
        this.data.positions[key] = {
            trader: position.trader,
            assetId: position.assetId,
            size: position.size.toString(),
            margin: position.margin.toString(),
            entryPrice: position.entryPrice.toString(),
            lastUpdate: position.lastUpdate
        };
        console.log("\uD83D\uDCCA Saved position: ".concat(key, " ").concat(this.formatPosition(position)));
        this.saveToBackup();
    };
    /**
     * Update position size (for partial closes)
     */
    MinimalDatabase.prototype.updatePositionSize = function (trader, assetId, newSize) {
        var position = this.getPosition(trader, assetId);
        if (!position) {
            console.error("\u274C Position not found for update: ".concat(trader, " asset ").concat(assetId));
            return false;
        }
        if (newSize === 0n) {
            // Remove position entirely
            var key = "".concat(trader.toLowerCase(), "-").concat(assetId);
            delete this.data.positions[key];
            console.log("\uD83D\uDDD1\uFE0F Position removed: ".concat(key));
        }
        else {
            // Update position size
            var updatedPosition = __assign(__assign({}, position), { size: newSize, lastUpdate: Date.now() });
            this.savePosition(updatedPosition);
            console.log("\uD83D\uDCCF Position size updated: ".concat(trader, " asset ").concat(assetId, " new size: ").concat(this.formatPosition(updatedPosition)));
        }
        this.saveToBackup();
        return true;
    };
    /**
     * Get position
     */
    MinimalDatabase.prototype.getPosition = function (trader, assetId) {
        var key = "".concat(trader.toLowerCase(), "-").concat(assetId);
        var stored = this.data.positions[key];
        if (!stored)
            return null;
        return {
            trader: stored.trader,
            assetId: stored.assetId,
            size: BigInt(stored.size),
            margin: BigInt(stored.margin),
            entryPrice: BigInt(stored.entryPrice),
            lastUpdate: stored.lastUpdate
        };
    };
    /**
     * Get all positions
     */
    MinimalDatabase.prototype.getAllPositions = function () {
        return Object.values(this.data.positions).map(function (stored) { return ({
            trader: stored.trader,
            assetId: stored.assetId,
            size: BigInt(stored.size),
            margin: BigInt(stored.margin),
            entryPrice: BigInt(stored.entryPrice),
            lastUpdate: stored.lastUpdate
        }); });
    };
    /**
     * Get trader positions
     */
    MinimalDatabase.prototype.getTraderPositions = function (trader) {
        return this.getAllPositions().filter(function (pos) { return pos.trader.toLowerCase() === trader.toLowerCase(); });
    };
    // ====================================================================
    // PERSISTENCE
    // ====================================================================
    MinimalDatabase.prototype.ensureDataDirectory = function (dataDir) {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log("\uD83D\uDCC1 Created data directory: ".concat(dataDir));
        }
    };
    MinimalDatabase.prototype.loadFromBackup = function () {
        var defaultData = {
            balances: {},
            positions: {},
            config: { lastBackup: Date.now() }
        };
        if (!fs.existsSync(this.backupPath)) {
            console.log('📝 No existing data found, starting fresh');
            return defaultData;
        }
        try {
            var content = fs.readFileSync(this.backupPath, 'utf8');
            var data = JSON.parse(content);
            console.log('📥 Loaded data from backup');
            return data;
        }
        catch (error) {
            console.error('❌ Failed to load backup, starting fresh:', error);
            return defaultData;
        }
    };
    MinimalDatabase.prototype.saveToBackup = function () {
        try {
            this.data.config.lastBackup = Date.now();
            fs.writeFileSync(this.backupPath, JSON.stringify(this.data, null, 2));
        }
        catch (error) {
            console.error('❌ Failed to save backup:', error);
        }
    };
    // ====================================================================
    // UTILITIES
    // ====================================================================
    MinimalDatabase.prototype.formatUSDC = function (amount) {
        return "$".concat((Number(amount) / 1e6).toFixed(2));
    };
    MinimalDatabase.prototype.formatPosition = function (position) {
        var side = position.size > 0n ? 'LONG' : 'SHORT';
        var size = position.size > 0n ? position.size : -position.size;
        return "".concat(side, " $").concat((Number(size) / 1e6).toFixed(2));
    };
    /**
     * Get database statistics
     */
    MinimalDatabase.prototype.getStats = function () {
        var balances = this.getAllBalances();
        var positions = this.getAllPositions();
        var totalBalance = 0n;
        var totalLocked = 0n;
        for (var _i = 0, balances_1 = balances; _i < balances_1.length; _i++) {
            var balance = balances_1[_i].balance;
            totalBalance += balance.total;
            totalLocked += balance.locked;
        }
        return {
            totalUsers: balances.length,
            totalBalance: totalBalance,
            totalLocked: totalLocked,
            totalPositions: positions.length,
            lastBackup: new Date(this.data.config.lastBackup).toISOString()
        };
    };
    /**
     * Clear all data (for testing)
     */
    MinimalDatabase.prototype.clear = function () {
        this.data = {
            balances: {},
            positions: {},
            config: { lastBackup: Date.now() }
        };
        this.saveToBackup();
        console.log('🧹 Database cleared');
    };
    return MinimalDatabase;
}());
exports.MinimalDatabase = MinimalDatabase;
// Export singleton instance
exports.database = new MinimalDatabase();
