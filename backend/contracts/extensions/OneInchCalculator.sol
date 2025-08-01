// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@1inch/limit-order-protocol-contract/contracts/interfaces/IAmountGetter.sol";
import "@1inch/limit-order-protocol-contract/contracts/interfaces/IOrderMixin.sol";
import "../interfaces/IAggregationRouter.sol";

/**
 * @title OneInchCalculator
 * @notice Extension for 1inch Limit Order Protocol that uses 1inch Aggregation Router for price discovery
 * @dev Calculates amounts based on real-time market prices from 1inch aggregator
 *      Blob format: [flags(1)][makerToken(20)][takerToken(20)][spread(32)]
 *      Flags: 0x00 = normal, 0x80 = inverse price calculation
 */
contract OneInchCalculator is IAmountGetter {
    /// @notice Address of the 1inch Aggregation Router for price discovery
    address public immutable aggregationRouter;
    
    /// @notice Spread denominator (1e9 = 1 billion)
    uint256 private constant _SPREAD_DENOMINATOR = 1e9;
    
    /// @notice Inverse flag for price calculation
    bytes1 private constant _INVERSE_FLAG = 0x80;
    
    /// @notice Errors
    error InvalidBlobLength();
    error ZeroAmount();
    error PriceDiscoveryFailed();
    error InsufficientLiquidity();

    /**
     * @notice Constructor to set the 1inch Aggregation Router address
     * @param _aggregationRouter Address of 1inch Aggregation Router
     */
    constructor(address _aggregationRouter) {
        require(_aggregationRouter != address(0), "OneInchCalculator: invalid router");
        aggregationRouter = _aggregationRouter;
    }

    /**
     * @notice Calculates the making amount based on taking amount and current market price
     * @param takingAmount Amount being taken
     * @param extraData Blob containing makerToken, takerToken, and spread
     * @return The calculated making amount
     */
    function getMakingAmount(
        IOrderMixin.Order calldata /* order */,
        bytes calldata /* extension */,
        bytes32 /* orderHash */,
        address /* taker */,
        uint256 takingAmount,
        uint256 /* remainingMakingAmount */,
        bytes calldata extraData
    ) external view override returns (uint256) {
        if (takingAmount == 0) {
            revert ZeroAmount();
        }
        
        return _getSpreadedAmount(takingAmount, extraData);
    }

    /**
     * @notice Calculates the taking amount based on making amount and current market price
     * @param makingAmount Amount being made
     * @param extraData Blob containing makerToken, takerToken, and spread
     * @return The calculated taking amount
     */
    function getTakingAmount(
        IOrderMixin.Order calldata /* order */,
        bytes calldata /* extension */,
        bytes32 /* orderHash */,
        address /* taker */,
        uint256 makingAmount,
        uint256 /* remainingMakingAmount */,
        bytes calldata extraData
    ) external view override returns (uint256) {
        if (makingAmount == 0) {
            revert ZeroAmount();
        }
        
        return _getSpreadedAmount(makingAmount, extraData);
    }

    /**
     * @notice Calculates amount with spread applied based on 1inch market price
     * @dev Blob format: [flags(1)][makerToken(20)][takerToken(20)][spread(32)]
     * @param amount Base amount to calculate from
     * @param blob Encoded data containing flags, tokens, and spread
     * @return Amount with spread applied based on current market price
     */
    function _getSpreadedAmount(uint256 amount, bytes calldata blob) internal view returns (uint256) {
        // Validate blob length: 1 (flags) + 20 (makerToken) + 20 (takerToken) + 32 (spread) = 73 bytes
        if (blob.length != 73) {
            revert InvalidBlobLength();
        }
        
        // Decode blob data
        bytes1 flags = bytes1(blob[:1]);
        address makerToken = address(bytes20(blob[1:21]));
        address takerToken = address(bytes20(blob[21:41]));
        uint256 spread = uint256(bytes32(blob[41:73]));
        
        // Get current market price from 1inch
        uint256 marketPrice = _getMarketPrice(makerToken, takerToken, amount);
        
        // Apply spread
        uint256 spreadedAmount = (marketPrice * spread) / _SPREAD_DENOMINATOR;
        
        // Apply inverse flag if set
        if (flags & _INVERSE_FLAG == _INVERSE_FLAG) {
            // For inverse calculation, we need to calculate the reverse price
            // This is useful when we want to calculate how much of token A we need
            // to get a specific amount of token B
            if (spreadedAmount == 0) {
                revert InsufficientLiquidity();
            }
            return (amount * _SPREAD_DENOMINATOR) / spreadedAmount;
        } else {
            return spreadedAmount;
        }
    }

    /**
     * @notice Get current market price from 1inch Aggregation Router
     * @param srcToken Source token address
     * @param dstToken Destination token address
     * @param amount Amount of source tokens
     * @return Expected output amount in destination tokens
     */
    function _getMarketPrice(
        address srcToken,
        address dstToken,
        uint256 amount
    ) internal view returns (uint256) {
        // Same token case
        if (srcToken == dstToken) {
            return amount;
        }
        
        try IAggregationRouter(aggregationRouter).getExpectedReturn(
            srcToken,
            dstToken,
            amount
        ) returns (uint256 expectedOut, uint256[] memory /* distribution */) {
            if (expectedOut == 0) {
                revert InsufficientLiquidity();
            }
            return expectedOut;
        } catch {
            revert PriceDiscoveryFailed();
        }
    }
} 