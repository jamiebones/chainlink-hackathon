// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OwnerIsCreator} from "@chainlink/contracts/src/v0.8/shared/access/OwnerIsCreator.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {IERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/utils/SafeERC20.sol";
import {EnumerableMap} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/utils/structs/EnumerableMap.sol";
import {ChainlinkManager} from "./ChainlinkManager.sol";
import {Vault} from "./Vault.sol";
import {Utils} from "../lib/Utils.sol";


//this contract is deployed on the destination chain which is Avalanche Fuji
//it receives messages from the source chain (Ethereum Sepolia) and processes them
//chain selector for Avalance Fuji: 14767482510784806043
//router address on Avalanche Fuji: 0xf694e193200268f9a4868e4aa017a0118c9a8177
//Receiver contract deployed on Avalanche Fiji
contract ReceiverContract is CCIPReceiver, OwnerIsCreator {
    using SafeERC20 for IERC20;
    using EnumerableMap for EnumerableMap.Bytes32ToUintMap;

    error InvalidUsdcToken(); 
    error InvalidVault(); 
    error InvalidSourceChain(); 
    error InvalidSenderAddress(); 
    error NoSenderOnSourceChain(uint64 sourceChainSelector); 
    error WrongSenderForSourceChain(uint64 sourceChainSelector); 
    error OnlySelf(); 
    error WrongReceivedToken(address usdcToken, address receivedToken); 
    error CallToVaultFailed(); 
    error NoReturnDataExpected(); 
    error MessageNotFailed(bytes32 messageId); 

    // Event emitted when a message is received from another chain.
    event MessageReceived(
        bytes32 indexed messageId, // The unique ID of the CCIP message.
        uint64 indexed sourceChainSelector, // The chain selector of the source chain.
        address indexed sender, // The address of the sender from the source chain.
        bytes data, // The data that was received.
        address token, // The token address that was transferred.
        uint256 tokenAmount // The token amount that was transferred.
    );

    event MessageFailed(bytes32 indexed messageId, bytes reason);
    event MessageRecovered(bytes32 indexed messageId);

    // Example error code, could have many different error codes.
    enum ErrorCode {
        RESOLVED,
        FAILED
    }
    struct FailedMessage {
        bytes32 messageId;
        ErrorCode errorCode;
    }

    ChainlinkManager private immutable i_chainlinkManager;
    Vault private immutable i_vault;
    IERC20 private immutable i_usdcToken;
    

    // Mapping to keep track of the sender contract per source chain.
    mapping(uint64 => address) public s_senders;
    // The message contents of failed messages are stored here.
    mapping(bytes32 => Client.Any2EVMMessage) public s_messageContents;

    // Contains failed messages and their state.
    EnumerableMap.Bytes32ToUintMap internal s_failedMessages;

    modifier validateSourceChain(uint64 _sourceChainSelector) {
        if (_sourceChainSelector == 0) revert InvalidSourceChain();
        _;
    }

    /// @dev Modifier to allow only the contract itself to execute a function.
    /// Throws an exception if called by any account other than the contract itself.
    modifier onlySelf() {
        if (msg.sender != address(this)) revert OnlySelf();
        _;
    }

    constructor(
        address _router,
        address _usdcToken,
        address _vault,
        address _chainlinkManagerAddress
    ) CCIPReceiver(_router) {
        if (_usdcToken == address(0)) revert InvalidUsdcToken();
        if (_vault == address(0)) revert InvalidVault();
        i_usdcToken = IERC20(_usdcToken);
        i_vault = Vault(_vault);
        i_chainlinkManager = ChainlinkManager(_chainlinkManagerAddress);
        i_usdcToken.safeApprove(_vault, type(uint256).max);
    }


    /// @param _sourceChainSelector The selector of the source chain. Eth Sepolia
    /// @param _sender The sender contract on the source chain .
    function setSenderForSourceChain(
        uint64 _sourceChainSelector,
        address _sender //VaultContractSenderAddress
    ) external onlyOwner validateSourceChain(_sourceChainSelector) {
        if (_sender == address(0)) revert InvalidSenderAddress();
        s_senders[_sourceChainSelector] = _sender;
    }


    /// @param _sourceChainSelector The selector of the source chain.
    function deleteSenderForSourceChain(
        uint64 _sourceChainSelector
    ) external onlyOwner validateSourceChain(_sourceChainSelector) {
        if (s_senders[_sourceChainSelector] == address(0))
            revert NoSenderOnSourceChain(_sourceChainSelector);
        delete s_senders[_sourceChainSelector];
    }

    /// @notice The entrypoint for the CCIP router to call. This function should
    /// never revert, all errors should be handled internally in this contract.
    /// @param any2EvmMessage The message to process.
    /// @dev Extremely important to ensure only router calls this.
    function ccipReceive(
        Client.Any2EVMMessage calldata any2EvmMessage
    ) external override onlyRouter {
        // validate the sender contract
        if (
            abi.decode(any2EvmMessage.sender, (address)) !=
            s_senders[any2EvmMessage.sourceChainSelector]
        ) revert WrongSenderForSourceChain(any2EvmMessage.sourceChainSelector);
        /* solhint-disable no-empty-blocks */
        try this.processMessage(any2EvmMessage) {
            // Intentionally empty in this example; no action needed if processMessage succeeds
        } catch (bytes memory err) {
            s_failedMessages.set(
                any2EvmMessage.messageId,
                uint256(ErrorCode.FAILED)
            );
            s_messageContents[any2EvmMessage.messageId] = any2EvmMessage;
            // Don't revert so CCIP doesn't revert. Emit event instead.
            // The message can be retried later without having to do manual execution of CCIP.
            emit MessageFailed(any2EvmMessage.messageId, err);
            return;
        }
    }

    /// @notice Serves as the entry point for this contract to process incoming messages.
    /// @param any2EvmMessage Received CCIP message.
    /// @dev Transfers specified token amounts to the owner of this contract. This function
    /// must be external because of the  try/catch for error handling.
    /// It uses the `onlySelf`: can only be called from the contract.
    function processMessage(
        Client.Any2EVMMessage calldata any2EvmMessage
    ) external onlySelf {
        _ccipReceive(any2EvmMessage); // process the message - may revert
    }

    function _ccipReceive(
        Client.Any2EVMMessage memory any2EvmMessage
    ) internal override {
        if (any2EvmMessage.destTokenAmounts[0].token != address(i_usdcToken))
            revert WrongReceivedToken(
                address(i_usdcToken),
                any2EvmMessage.destTokenAmounts[0].token
            );

         (Utils.RequestType requestType, address receipient, Utils.Asset asset, uint256 amount) = 
            abi.decode(any2EvmMessage.data, (Utils.RequestType, address, Utils.Asset, uint256 ));


        if (requestType == Utils.RequestType.OPEN_POSITION) {
            //we open the position here
            _openPosition(amount, receipient, asset);
              emit MessageReceived(
                any2EvmMessage.messageId,
                any2EvmMessage.sourceChainSelector, // fetch the source chain identifier (aka selector)
                abi.decode(any2EvmMessage.sender, (address)), // abi-decoding of the sender address,
                any2EvmMessage.data, // received data
                any2EvmMessage.destTokenAmounts[0].token,
                any2EvmMessage.destTokenAmounts[0].amount
            );
        }
      
    }

    function _openPosition(uint256 amount, address receipient, Utils.Asset asset) private {
        //get the price of the asset from chainlink;
        (uint256 shares, uint256 mintFee, uint256 notionalAmount, uint256 assetPrice ) = 
        i_chainlinkManager.calculateSharesAndMintFeeFromUSDCPaid(asset, amount);
        i_vault.openPositionViaCCIP(
            receipient,
            asset,
            shares,
            notionalAmount,
            mintFee,
            amount,
            assetPrice
        );
    }

    /// @notice Allows the owner to retry a failed message in order to unblock the associated tokens.
    /// @param messageId The unique identifier of the failed message.
    /// @param beneficiary The address to which the tokens will be sent.
    /// @dev This function is only callable by the contract owner. It changes the status of the message
    /// from 'failed' to 'resolved' to prevent reentry and multiple retries of the same message.
    function retryFailedMessage(
        bytes32 messageId,
        address beneficiary
    ) external onlyOwner {
        // Check if the message has failed; if not, revert the transaction.
        if (s_failedMessages.get(messageId) != uint256(ErrorCode.FAILED))
            revert MessageNotFailed(messageId);

        // Set the error code to RESOLVED to disallow reentry and multiple retries of the same failed message.
        s_failedMessages.set(messageId, uint256(ErrorCode.RESOLVED));

        // Retrieve the content of the failed message.
        Client.Any2EVMMessage memory message = s_messageContents[messageId];

        // This example expects one token to have been sent.
        // Transfer the associated tokens to the specified receiver as an escape hatch.
        IERC20(message.destTokenAmounts[0].token).safeTransfer(
            beneficiary,
            message.destTokenAmounts[0].amount
        );
        emit MessageRecovered(messageId);
    }


    function getFailedMessages(
        uint256 offset,
        uint256 limit
    ) external view returns (FailedMessage[] memory) {
        uint256 length = s_failedMessages.length();

        // Calculate the actual number of items to return (can't exceed total length or requested limit)
        uint256 returnLength = (offset + limit > length)
            ? length - offset
            : limit;
        FailedMessage[] memory failedMessages = new FailedMessage[](
            returnLength
        );

        // Adjust loop to respect pagination (start at offset, end at offset + limit or total length)
        for (uint256 i = 0; i < returnLength; i++) {
            (bytes32 messageId, uint256 errorCode) = s_failedMessages.at(
                offset + i
            );
            failedMessages[i] = FailedMessage(messageId, ErrorCode(errorCode));
        }
        return failedMessages;
    }
}
