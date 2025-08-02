// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockSwapRouter
 * @notice Mock implementation of Uniswap V3 Swap Router for testing
 * @dev Provides simplified swap functionality for testing purposes
 */
contract MockSwapRouter is ISwapRouter {
    /// @notice Mock exchange rates (1e18 = 1:1)
    mapping(address => mapping(address => uint256)) public exchangeRates;
    
    /// @notice Should swaps fail
    bool public shouldFailSwaps;
    
    /// @notice Mock slippage tolerance (default 5%)
    uint256 public slippageTolerance = 500; // 5% = 500 basis points

    /**
     * @notice Set exchange rate between two tokens
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param rate Exchange rate (1e18 = 1:1)
     */
    function setExchangeRate(address tokenIn, address tokenOut, uint256 rate) external {
        exchangeRates[tokenIn][tokenOut] = rate;
    }

    /**
     * @notice Set whether swaps should fail
     * @param _shouldFail Whether swaps should fail
     */
    function setShouldFailSwaps(bool _shouldFail) external {
        shouldFailSwaps = _shouldFail;
    }

    /**
     * @notice Set slippage tolerance
     * @param _slippageTolerance Slippage tolerance in basis points
     */
    function setSlippageTolerance(uint256 _slippageTolerance) external {
        slippageTolerance = _slippageTolerance;
    }

    /**
     * @notice Execute exact input single swap
     * @param params The parameters for the swap
     * @return amountOut The amount of output tokens received
     */
    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable override returns (uint256 amountOut) {
        if (shouldFailSwaps) {
            revert("MockSwapRouter: swap failed");
        }

        // Calculate output amount based on exchange rate
        uint256 rate = exchangeRates[params.tokenIn][params.tokenOut];
        if (rate == 0) {
            // Default to 1:1 if no rate set
            rate = 1e18;
        }

        amountOut = (params.amountIn * rate) / 1e18;

        // Apply slippage tolerance
        uint256 minAmountOut = (amountOut * (10000 - slippageTolerance)) / 10000;
        require(amountOut >= params.amountOutMinimum, "MockSwapRouter: insufficient output amount");

        // Transfer tokens (simplified - in real implementation this would be more complex)
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        IERC20(params.tokenOut).transfer(params.recipient, amountOut);

        return amountOut;
    }

    /**
     * @notice Execute exact input swap
     * @param params The parameters for the swap
     * @return amountOut The amount of output tokens received
     */
    function exactInput(
        ExactInputParams calldata params
    ) external payable override returns (uint256 amountOut) {
        // For simplicity, we'll just call exactInputSingle with the first hop
        // In a real implementation, this would handle multiple hops
        revert("MockSwapRouter: exactInput not implemented");
    }

    /**
     * @notice Execute exact output single swap
     * @param params The parameters for the swap
     * @return amountIn The amount of input tokens used
     */
    function exactOutputSingle(
        ExactOutputSingleParams calldata params
    ) external payable override returns (uint256 amountIn) {
        if (shouldFailSwaps) {
            revert("MockSwapRouter: swap failed");
        }

        // Calculate input amount based on exchange rate
        uint256 rate = exchangeRates[params.tokenIn][params.tokenOut];
        if (rate == 0) {
            // Default to 1:1 if no rate set
            rate = 1e18;
        }

        amountIn = (params.amountOut * 1e18) / rate;

        // Apply slippage tolerance
        uint256 maxAmountIn = (amountIn * (10000 + slippageTolerance)) / 10000;
        require(amountIn <= params.amountInMaximum, "MockSwapRouter: excessive input amount");

        // Transfer tokens (simplified)
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(params.tokenOut).transfer(params.recipient, params.amountOut);

        return amountIn;
    }

    /**
     * @notice Execute exact output swap
     * @param params The parameters for the swap
     * @return amountIn The amount of input tokens used
     */
    function exactOutput(
        ExactOutputParams calldata params
    ) external payable override returns (uint256 amountIn) {
        // For simplicity, we'll just call exactOutputSingle with the first hop
        // In a real implementation, this would handle multiple hops
        revert("MockSwapRouter: exactOutput not implemented");
    }

    /**
     * @notice Uniswap V3 callback function (not used in this mock)
     */
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        // Mock implementation - do nothing
    }
} 