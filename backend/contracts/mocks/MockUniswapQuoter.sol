// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";

/**
 * @title MockUniswapQuoter
 * @notice Mock implementation of Uniswap V3 Quoter for testing
 * @dev Provides simplified pricing and quote simulation for testing purposes
 */
contract MockUniswapQuoter is IQuoter {
    /// @notice Events
    event QuoteExecuted(address indexed tokenIn, address indexed tokenOut, uint24 fee, uint256 amountIn, uint256 amountOut);
    event QuoteReverseExecuted(address indexed tokenIn, address indexed tokenOut, uint24 fee, uint256 amountOut, uint256 amountIn);

    /// @notice Flag to simulate failures
    bool public shouldFailQuotes = false;

    /// @notice Custom exchange rate (basis points, 10000 = 1:1)
    uint256 public exchangeRate = 10000; // Default 1:1

    /// @notice Fee multipliers for different tiers (in basis points)
    mapping(uint24 => uint256) public feeMultipliers;

    /// @notice Errors
    error QuoteSimulatedFailure();

    constructor() {
        // Set default fee multipliers (slight differences to simulate real behavior)
        feeMultipliers[500] = 10000;   // 0.05% tier: 1:1
        feeMultipliers[3000] = 9970;   // 0.3% tier: slightly worse rate
        feeMultipliers[10000] = 9900;  // 1% tier: worse rate
    }

    /**
     * @notice Set custom exchange rate for testing
     * @param _rate Exchange rate in basis points (10000 = 1:1, 9500 = 0.95:1)
     */
    function setExchangeRate(uint256 _rate) external {
        exchangeRate = _rate;
    }

    /**
     * @notice Set fee multiplier for a specific tier
     * @param fee Fee tier
     * @param multiplier Multiplier in basis points
     */
    function setFeeMultiplier(uint24 fee, uint256 multiplier) external {
        feeMultipliers[fee] = multiplier;
    }

    /**
     * @notice Set failure flag for testing error conditions
     */
    function setShouldFailQuotes(bool _shouldFail) external {
        shouldFailQuotes = _shouldFail;
    }

    /**
     * @notice Mock implementation of quoteExactInputSingle
     */
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 /* sqrtPriceLimitX96 */
    ) external view override returns (uint256 amountOut) {
        if (shouldFailQuotes) {
            revert QuoteSimulatedFailure();
        }

        // Same token case
        if (tokenIn == tokenOut) {
            return amountIn;
        }

        // Get fee multiplier (default to 10000 if not set)
        uint256 feeMultiplier = feeMultipliers[fee];
        if (feeMultiplier == 0) {
            feeMultiplier = 10000;
        }

        // Calculate return amount: base rate * fee multiplier / 10000
        amountOut = (amountIn * exchangeRate * feeMultiplier) / (10000 * 10000);
        
        return amountOut;
    }

    /**
     * @notice Mock implementation of quoteExactOutputSingle
     */
    function quoteExactOutputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOut,
        uint160 /* sqrtPriceLimitX96 */
    ) external view override returns (uint256 amountIn) {
        if (shouldFailQuotes) {
            revert QuoteSimulatedFailure();
        }

        // Same token case
        if (tokenIn == tokenOut) {
            return amountOut;
        }

        // Get fee multiplier (default to 10000 if not set)
        uint256 feeMultiplier = feeMultipliers[fee];
        if (feeMultiplier == 0) {
            feeMultiplier = 10000;
        }

        // Calculate required input amount (inverse of exact input)
        amountIn = (amountOut * 10000 * 10000) / (exchangeRate * feeMultiplier);
        
        return amountIn;
    }

    /**
     * @notice Mock implementation of quoteExactInput for multi-hop swaps
     */
    function quoteExactInput(bytes memory /* path */, uint256 amountIn)
        external
        view
        override
        returns (uint256 amountOut)
    {
        if (shouldFailQuotes) {
            revert QuoteSimulatedFailure();
        }

        // Simplified: just apply exchange rate (for testing single hops mostly)
        amountOut = (amountIn * exchangeRate) / 10000;
        return amountOut;
    }

    /**
     * @notice Mock implementation of quoteExactOutput for multi-hop swaps
     */
    function quoteExactOutput(bytes memory /* path */, uint256 amountOut)
        external
        view
        override
        returns (uint256 amountIn)
    {
        if (shouldFailQuotes) {
            revert QuoteSimulatedFailure();
        }

        // Simplified: just apply inverse exchange rate
        amountIn = (amountOut * 10000) / exchangeRate;
        return amountIn;
    }

    /**
     * @notice Check if a specific fee tier is supported in the mock
     * @param fee Fee tier to check
     * @return True if supported
     */
    function isFeeTierSupported(uint24 fee) external view returns (bool) {
        return feeMultipliers[fee] > 0 || fee == 500 || fee == 3000 || fee == 10000;
    }

    /**
     * @notice Get the effective rate for a fee tier
     * @param fee Fee tier
     * @return Effective rate in basis points
     */
    function getEffectiveRate(uint24 fee) external view returns (uint256) {
        uint256 feeMultiplier = feeMultipliers[fee];
        if (feeMultiplier == 0) {
            feeMultiplier = 10000; // Default
        }
        return (exchangeRate * feeMultiplier) / 10000;
    }
}