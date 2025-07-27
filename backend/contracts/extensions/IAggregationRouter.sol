// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IAggregationRouter
 * @notice Interface for 1inch Aggregation Router v6
 * @dev This interface defines the key functions needed for price discovery and swapping
 */
interface IAggregationRouter {
    /**
     * @notice Swap description structure for the 1inch router
     */
    struct SwapDescription {
        address srcToken;
        address dstToken;
        address srcReceiver;
        address dstReceiver;
        uint256 amount;
        uint256 minReturnAmount;
        uint256 flags;
    }

    /**
     * @notice Perform a token swap via 1inch aggregation
     * @param executor The address that will execute the swap
     * @param desc The swap description containing token addresses and amounts
     * @param permit Permit data for the source token (if applicable)
     * @param data Encoded swap data for the specific route
     * @return returnAmount The actual amount of destination tokens received
     * @return spentAmount The actual amount of source tokens spent
     */
    function swap(
        address executor,
        SwapDescription calldata desc,
        bytes calldata permit,
        bytes calldata data
    ) external payable returns (uint256 returnAmount, uint256 spentAmount);

    /**
     * @notice Simple uniswap-style swap for single pool
     * @param token The input token address
     * @param amount The amount to swap
     * @param minReturn The minimum acceptable output amount
     * @param dex The DEX pool address
     * @return returnAmount The actual amount received
     */
    function unoswap(
        address token,
        uint256 amount,
        uint256 minReturn,
        address dex
    ) external returns (uint256 returnAmount);

    /**
     * @notice Get expected return amount for a token swap (view function)
     * @param srcToken Source token address
     * @param dstToken Destination token address  
     * @param amount Amount of source tokens
     * @return returnAmount Expected destination token amount
     * @return distribution Array showing distribution across different exchanges
     */
    function getExpectedReturn(
        address srcToken,
        address dstToken,
        uint256 amount
    ) external view returns (uint256 returnAmount, uint256[] memory distribution);

    /**
     * @notice Get expected return with gas estimation
     * @param srcToken Source token address
     * @param dstToken Destination token address
     * @param amount Amount of source tokens
     * @param parts Number of parts to split the swap
     * @param flags Additional flags for the swap
     * @return returnAmount Expected destination token amount
     * @return estimateGasAmount Estimated gas for the swap
     * @return distribution Distribution across exchanges
     */
    function getExpectedReturnWithGas(
        address srcToken,
        address dstToken,
        uint256 amount,
        uint256 parts,
        uint256 flags
    ) external view returns (
        uint256 returnAmount,
        uint256 estimateGasAmount,
        uint256[] memory distribution
    );
} 