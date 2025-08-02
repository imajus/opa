// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IAggregationRouter.sol";

/**
 * @title MockAggregationRouter
 * @notice Mock implementation of 1inch Aggregation Router for testing
 * @dev Provides simplified pricing and swap simulation for testing purposes
 */
contract MockAggregationRouter is IAggregationRouter {
    /// @notice Events
    event SwapExecuted(address indexed srcToken, address indexed dstToken, uint256 amount, uint256 returnAmount);
    event ExpectedReturnCalled(address indexed srcToken, address indexed dstToken, uint256 amount);

    /// @notice Flag to simulate failures
    bool public shouldFailSwaps = false;
    bool public shouldFailQuotes = false;

    /// @notice Custom exchange rate (basis points, 10000 = 1:1)
    uint256 public exchangeRate = 10000; // Default 1:1

    /// @notice Errors
    error SwapSimulatedFailure();
    error QuoteSimulatedFailure();

    /**
     * @notice Set custom exchange rate for testing
     * @param _rate Exchange rate in basis points (10000 = 1:1, 9500 = 0.95:1)
     */
    function setExchangeRate(uint256 _rate) external {
        exchangeRate = _rate;
    }

    /**
     * @notice Set failure flags for testing error conditions
     */
    function setShouldFailSwaps(bool _shouldFail) external {
        shouldFailSwaps = _shouldFail;
    }

    function setShouldFailQuotes(bool _shouldFail) external {
        shouldFailQuotes = _shouldFail;
    }

    /**
     * @notice Mock implementation of swap function
     */
    function swap(
        address /* executor */,
        SwapDescription calldata desc,
        bytes calldata /* permit */,
        bytes calldata /* data */
    ) external payable override returns (uint256 returnAmount, uint256 spentAmount) {
        if (shouldFailSwaps) {
            revert SwapSimulatedFailure();
        }

        // Calculate return amount based on exchange rate
        returnAmount = (desc.amount * exchangeRate) / 10000;
        spentAmount = desc.amount;

        emit SwapExecuted(desc.srcToken, desc.dstToken, desc.amount, returnAmount);
        
        return (returnAmount, spentAmount);
    }

    /**
     * @notice Mock implementation of unoswap function
     */
    function unoswap(
        address /* token */,
        uint256 amount,
        uint256 /* minReturn */,
        address /* dex */
    ) external override returns (uint256 returnAmount) {
        if (shouldFailSwaps) {
            revert SwapSimulatedFailure();
        }

        // Calculate return amount based on exchange rate
        returnAmount = (amount * exchangeRate) / 10000;
        
        return returnAmount;
    }

    /**
     * @notice Mock implementation of getExpectedReturn
     */
    function getExpectedReturn(
        address /* srcToken */,
        address /* dstToken */,
        uint256 amount
    ) external view override returns (uint256 returnAmount, uint256[] memory distribution) {
        if (shouldFailQuotes) {
            revert QuoteSimulatedFailure();
        }

        // Calculate return amount based on exchange rate
        returnAmount = (amount * exchangeRate) / 10000;
        
        // Mock distribution (single exchange for simplicity)
        distribution = new uint256[](1);
        distribution[0] = 100; // 100% through one exchange
        
        return (returnAmount, distribution);
    }

    /**
     * @notice Mock implementation of getExpectedReturnWithGas
     */
    function getExpectedReturnWithGas(
        address /* srcToken */,
        address /* dstToken */,
        uint256 amount,
        uint256 /* parts */,
        uint256 /* flags */
    ) external view override returns (
        uint256 returnAmount,
        uint256 estimateGasAmount,
        uint256[] memory distribution
    ) {
        if (shouldFailQuotes) {
            revert QuoteSimulatedFailure();
        }

        // Calculate return amount based on exchange rate
        returnAmount = (amount * exchangeRate) / 10000;
        estimateGasAmount = 200000; // Mock gas estimate
        
        // Mock distribution
        distribution = new uint256[](1);
        distribution[0] = 100;
        
        return (returnAmount, estimateGasAmount, distribution);
    }
} 