contract MockProtocolAccounting {
    struct SyncCall {
        uint256 asset;
        int256 delta;
        uint256 timestamp;
    }
    
    struct FeeCall {
        uint256 asset;
        uint256 amount;
        uint256 timestamp;
    }
    
    SyncCall[] public fundingCalls;
    FeeCall[] public feeCalls;
    
    mapping(uint256 => int256) public netFunding;
    mapping(uint256 => uint256) public netFees;
    
    function syncFunding(uint256 asset, int256 fundingDelta) external {
        fundingCalls.push(SyncCall({
            asset: asset,
            delta: fundingDelta,
            timestamp: block.timestamp
        }));
        
        netFunding[asset] += fundingDelta;
    }
    
    function syncFee(uint256 asset, uint256 feeAmount) external {
        feeCalls.push(FeeCall({
            asset: asset,
            amount: feeAmount,
            timestamp: block.timestamp
        }));
        
        netFees[asset] += feeAmount;
    }
    
    function getFundingCalls() external view returns (SyncCall[] memory) {
        return fundingCalls;
    }
    
    function getFeeCalls() external view returns (FeeCall[] memory) {
        return feeCalls;
    }
    
    function getFundingCallCount() external view returns (uint256) {
        return fundingCalls.length;
    }
    
    function getFeeCallCount() external view returns (uint256) {
        return feeCalls.length;
    }
    
    function getProtocolRevenue(uint256 asset) external view returns (int256) {
        return netFunding[asset] + int256(netFees[asset]);
    }
    
    function resetCounters() external {
        delete fundingCalls;
        delete feeCalls;
    }
}