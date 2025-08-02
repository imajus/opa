// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './FullMath.sol';
import './FixedPoint96.sol';

/// @title Functions based on Q64.96 sqrt price calculations
/// @notice Contains math functions for converting sqrt prices to amounts
library SqrtPriceMath {
    /// @notice Calculates the amount out for a given amount in using the sqrt price
    /// @param sqrtPriceX96 The sqrt price as a Q64.96
    /// @param amountIn The amount of input tokens
    /// @param zeroForOne Whether we're swapping token0 for token1 (true) or token1 for token0 (false)
    /// @return amountOut The amount of output tokens
    function getAmountOut(
        uint160 sqrtPriceX96,
        uint256 amountIn,
        bool zeroForOne
    ) internal pure returns (uint256 amountOut) {
        require(sqrtPriceX96 > 0, "SqrtPriceMath: INVALID_PRICE");
        require(amountIn > 0, "SqrtPriceMath: INVALID_AMOUNT");

        if (zeroForOne) {
            // token0 -> token1
            // amountOut = amountIn * sqrtPrice^2 / 2^192
            amountOut = FullMath.mulDiv(
                amountIn, 
                uint256(sqrtPriceX96) * uint256(sqrtPriceX96), 
                uint256(1) << 192
            );
        } else {
            // token1 -> token0
            // amountOut = amountIn * 2^192 / sqrtPrice^2
            amountOut = FullMath.mulDiv(
                amountIn, 
                uint256(1) << 192, 
                uint256(sqrtPriceX96) * uint256(sqrtPriceX96)
            );
        }
    }

    /// @notice Calculates the amount in required for a given amount out using the sqrt price
    /// @param sqrtPriceX96 The sqrt price as a Q64.96
    /// @param amountOut The desired amount of output tokens
    /// @param zeroForOne Whether we're swapping token0 for token1 (true) or token1 for token0 (false)
    /// @return amountIn The required amount of input tokens
    function getAmountIn(
        uint160 sqrtPriceX96,
        uint256 amountOut,
        bool zeroForOne
    ) internal pure returns (uint256 amountIn) {
        require(sqrtPriceX96 > 0, "SqrtPriceMath: INVALID_PRICE");
        require(amountOut > 0, "SqrtPriceMath: INVALID_AMOUNT");

        if (zeroForOne) {
            // token0 -> token1
            // amountIn = amountOut * 2^192 / sqrtPrice^2
            amountIn = FullMath.mulDiv(
                amountOut, 
                uint256(1) << 192, 
                uint256(sqrtPriceX96) * uint256(sqrtPriceX96)
            );
        } else {
            // token1 -> token0
            // amountIn = amountOut * sqrtPrice^2 / 2^192
            amountIn = FullMath.mulDiv(
                amountOut, 
                uint256(sqrtPriceX96) * uint256(sqrtPriceX96), 
                uint256(1) << 192
            );
        }
    }

    /// @notice Converts a sqrt price to a regular price ratio (token1/token0)
    /// @param sqrtPriceX96 The sqrt price as a Q64.96
    /// @return priceX192 The price as a Q128.128 (token1/token0)
    function sqrtPriceToPrice(uint160 sqrtPriceX96) internal pure returns (uint256 priceX192) {
        return FullMath.mulDiv(uint256(sqrtPriceX96), uint256(sqrtPriceX96), uint256(1) << 0);
    }

    /// @notice Gets the token0 amount equivalent for a given token1 amount at the current price
    /// @param sqrtPriceX96 The current sqrt price
    /// @param amount1 The amount of token1
    /// @return amount0 The equivalent amount of token0
    function getAmount0ForAmount1(uint160 sqrtPriceX96, uint256 amount1) internal pure returns (uint256 amount0) {
        return getAmountOut(sqrtPriceX96, amount1, false);
    }

    /// @notice Gets the token1 amount equivalent for a given token0 amount at the current price
    /// @param sqrtPriceX96 The current sqrt price
    /// @param amount0 The amount of token0
    /// @return amount1 The equivalent amount of token1
    function getAmount1ForAmount0(uint160 sqrtPriceX96, uint256 amount0) internal pure returns (uint256 amount1) {
        return getAmountOut(sqrtPriceX96, amount0, true);
    }
}