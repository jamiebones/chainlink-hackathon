// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {OwnerIsCreator} from "@chainlink/contracts/src/v0.8/shared/access/OwnerIsCreator.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAsset} from "../interfaces/IAsset.sol";
import {Utils} from "../lib/Utils.sol";

//LINK token address: 0xb1D4538B4571d411F07960EF2838Ce337FE1E80E

//this contract must have LINK token to pay for CCIP fees

//router address: 0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165
//chain selector: 3478487238524512106
//USDC token address: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
//Link token address: 0xb1D4538B4571d411F07960EF2838Ce337FE1E80E

//Vault Contract is deployed on Ethereum Sepolia


contract VaultContractSender is OwnerIsCreator {
    using SafeERC20 for IERC20;
    

    error InvalidRouter();
    error InvalidLinkToken();
    error InvalidUsdcToken();
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees);
    error NothingToWithdraw();
    error InvalidDestinationChain();
    error InvalidReceiverAddress();
    error NoReceiverOnDestinationChain(uint64 destinationChainSelector);
    error AmountIsZero();
    error InvalidGasLimit();
    error NoGasLimitOnDestinationChain(uint64 destinationChainSelector);
    error InvalidAmount();
    error InvalidAssetTypeUsed();
    error AddressIsZeroAddress();
    error InvalidVault();
    error InvalidSourceChain();
    error InvalidSenderAddress();
    error NoSenderOnSourceChain(uint64 sourceChainSelector);
    error WrongSenderForSourceChain(uint64 sourceChainSelector);
    error OnlySelf();
    error NoReturnDataExpected();
    error MessageNotFailed(bytes32 messageId);

    struct PositionRequest {
        Utils.Asset asset;
        uint256 amount;
        address recipient;
        uint64 fujiChainSelector; //the chain selector on fuji
        address fujiReceiver; //receiver contract on Fuji
    }

    // Event emitted when a message is sent to another chain.
    event MessageSent(
        bytes32 indexed messageId, // The unique ID of the CCIP message.
        uint64 indexed destinationChainSelector, // The chain selector of the destination chain.
        address indexed receiver, // The address of the receiver contract on the destination chain.
        address trader,
        address token, // The token address that was transferred.
        uint256 tokenAmount, // The token amount that was transferred.
        address feeToken, // the token address used to pay CCIP fees.
        uint256 fees // The fees paid for sending the message.
    );

    IRouterClient private immutable i_router;
    IERC20 private immutable i_linkToken;
    IERC20 private immutable i_usdcToken;
   
  
    // Mapping to keep track of the receiver contract per destination chain.
    mapping(uint64 => address) public s_receivers;
    // Mapping to store the gas limit per destination chain.
    mapping(uint64 => uint256) public s_gasLimits;

    modifier validateDestinationChain(uint64 _destinationChainSelector) {
        if (_destinationChainSelector == 0) revert InvalidDestinationChain();
        _;
    }

    constructor(address _router, address _usdcToken, address _linkTokenAddress) {
        if (_usdcToken == address(0)) revert InvalidUsdcToken();
        if ( _router == address(0)) revert InvalidRouter();
        i_router = IRouterClient(_router);
        i_usdcToken = IERC20(_usdcToken);
        i_linkToken = IERC20(_linkTokenAddress);
        i_usdcToken.approve(address(i_router), type(uint256).max);
        i_linkToken.approve(address(i_router), type(uint256).max);
    }

    /// @dev Set the receiver contract for a given destination chain.
    /// @notice This function can only be called by the owner.
    /// @param _destinationChainSelector The selector of the destination chain.
    /// @param _receiver The receiver contract on the destination chain .
    function setReceiverForDestinationChain(
        uint64 _destinationChainSelector,
        address _receiver
    ) external onlyOwner validateDestinationChain(_destinationChainSelector) {
        if (_receiver == address(0)) revert InvalidReceiverAddress();
        s_receivers[_destinationChainSelector] = _receiver;
    }

    /// @dev Set the gas limit for a given destination chain.
    /// @notice This function can only be called by the owner.
    /// @param _destinationChainSelector The selector of the destination chain.
    /// @param _gasLimit The gas limit on the destination chain .
    function setGasLimitForDestinationChain(
        uint64 _destinationChainSelector,
        uint256 _gasLimit
    ) external onlyOwner validateDestinationChain(_destinationChainSelector) {
        if (_gasLimit == 0) revert InvalidGasLimit();
        s_gasLimits[_destinationChainSelector] = _gasLimit;
    }

    /// @param _destinationChainSelector The selector of the destination chain.
    function deleteReceiverForDestinationChain(
        uint64 _destinationChainSelector
    ) external onlyOwner validateDestinationChain(_destinationChainSelector) {
        if (s_receivers[_destinationChainSelector] == address(0))
            revert NoReceiverOnDestinationChain(_destinationChainSelector);
        delete s_receivers[_destinationChainSelector];
    }

   
    function openPositionViaCCIP(
        PositionRequest calldata _request
    )
        external
        validateDestinationChain(_request.fujiChainSelector)
        returns (bytes32 messageId)
    {
        address receiver = s_receivers[_request.fujiChainSelector];
        if (_request.fujiReceiver == address(0)) revert AddressIsZeroAddress();
        if (receiver != _request.fujiReceiver)
            revert NoReceiverOnDestinationChain(_request.fujiChainSelector);
        if (i_usdcToken.balanceOf(msg.sender) < _request.amount)
            revert NotEnoughBalance(
                i_usdcToken.balanceOf(msg.sender),
                _request.amount
            );
        uint256 gasLimit = s_gasLimits[_request.fujiChainSelector];
        if (gasLimit == 0)
            revert NoGasLimitOnDestinationChain(_request.fujiChainSelector);
        //transfer the amount from the user
        i_usdcToken.safeTransferFrom(
            msg.sender,
            address(this),
            _request.amount
        );
        
        Client.EVMTokenAmount[]
            memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({
            token: address(i_usdcToken), //USDC token address in Sepolia Arbritium
            amount: _request.amount
        });

        Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver), // ABI-encoded receiver address
            data: abi.encode(Utils.RequestType.OPEN_POSITION,
                _request.recipient,
                _request.asset,
                _request.amount
            ),
            tokenAmounts: tokenAmounts, // The amount and type of token being transferred
            extraArgs: Client._argsToBytes(
                Client.GenericExtraArgsV2({
                    gasLimit: gasLimit,
                    allowOutOfOrderExecution: true
                })
            ),
            feeToken: address(i_linkToken)
        });
        uint256 fees = i_router.getFee(
            _request.fujiChainSelector,
            evm2AnyMessage
        );
         if (fees > i_linkToken.balanceOf(address(this)))
            revert NotEnoughBalance(i_linkToken.balanceOf(address(this)), fees);
         messageId = i_router.ccipSend(
            _request.fujiChainSelector,
            evm2AnyMessage
        );

        emit MessageSent(
            messageId,
            _request.fujiChainSelector,
            receiver,
            _request.recipient,
            address(i_usdcToken),
            _request.amount, 
            address(i_linkToken),
            fees
        );
    }

    function withdrawLinkToken(address _beneficiary) public onlyOwner {
        uint256 amount = i_linkToken.balanceOf(address(this));
        if (amount == 0) revert NothingToWithdraw();

        i_linkToken.safeTransfer(_beneficiary, amount);
    }

    function withdrawUsdcToken(address _beneficiary) public onlyOwner {
        uint256 amount = i_usdcToken.balanceOf(address(this));
        if (amount == 0) revert NothingToWithdraw();
        i_usdcToken.safeTransfer(_beneficiary, amount);
    }
}
