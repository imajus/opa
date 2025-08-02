// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";

/**
 * @title MockUniswapFactory
 * @notice Mock implementation of Uniswap V3 Factory for testing
 * @dev Provides simplified pool address resolution for testing purposes
 */
contract MockUniswapFactory is IUniswapV3Factory {
    /// @notice Mock pool addresses
    mapping(address => mapping(address => mapping(uint24 => address))) public pools;
    
    /// @notice All created pools
    address[] public allPools;
    
    /// @notice Pool registry for lookup
    mapping(address => PoolInfo) public poolInfo;
    
    struct PoolInfo {
        address token0;
        address token1;
        uint24 fee;
        bool exists;
    }

    /// @notice Fee amounts enabled for pool creation
    mapping(uint24 => int24) public feeAmountTickSpacing;

    /// @notice Contract owner
    address public override owner;

    constructor() {
        owner = msg.sender;
        
        // Set up standard fee tiers
        feeAmountTickSpacing[500] = 10;    // 0.05%
        feeAmountTickSpacing[3000] = 60;   // 0.3%
        feeAmountTickSpacing[10000] = 200; // 1%
    }

    /**
     * @notice Create a pool for the given two tokens and fee
     * @param tokenA One of the two tokens in the desired pool
     * @param tokenB The other of the two tokens in the desired pool
     * @param fee The desired fee for the pool
     * @return pool The address of the newly created pool
     */
    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external override returns (address pool) {
        require(tokenA != tokenB, "MockFactory: IDENTICAL_ADDRESSES");
        require(feeAmountTickSpacing[fee] != 0, "MockFactory: INVALID_FEE");
        
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "MockFactory: ZERO_ADDRESS");
        require(pools[token0][token1][fee] == address(0), "MockFactory: POOL_EXISTS");

        // Deploy mock pool
        MockUniswapPool mockPool = new MockUniswapPool(token0, token1, fee);
        pool = address(mockPool);
        
        pools[token0][token1][fee] = pool;
        pools[token1][token0][fee] = pool; // Symmetric mapping
        allPools.push(pool);
        
        poolInfo[pool] = PoolInfo({
            token0: token0,
            token1: token1,
            fee: fee,
            exists: true
        });

        emit PoolCreated(token0, token1, fee, feeAmountTickSpacing[fee], pool);
    }

    /**
     * @notice Returns the pool address for a given pair of tokens and a fee
     * @param tokenA One of the two tokens
     * @param tokenB The other of the two tokens
     * @param fee The fee
     * @return pool The pool address
     */
    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view override returns (address pool) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return pools[token0][token1][fee];
    }

    /**
     * @notice Set owner of the factory
     * @param _owner The address to set as owner
     */
    function setOwner(address _owner) external override {
        require(msg.sender == owner, "MockFactory: FORBIDDEN");
        owner = _owner;
    }

    /**
     * @notice Enable a fee amount with the given tickSpacing
     * @param fee The fee amount to enable
     * @param tickSpacing The spacing between usable ticks
     */
    function enableFeeAmount(uint24 fee, int24 tickSpacing) external override {
        require(msg.sender == owner, "MockFactory: FORBIDDEN");
        require(fee < 1000000, "MockFactory: FEE_TOO_HIGH");
        require(tickSpacing > 0 && tickSpacing < 16384, "MockFactory: INVALID_TICK_SPACING");
        require(feeAmountTickSpacing[fee] == 0, "MockFactory: FEE_ALREADY_ENABLED");

        feeAmountTickSpacing[fee] = tickSpacing;
    }

    /**
     * @notice Get all pools count
     */
    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }

    /**
     * @notice Create a pool with mock data for testing
     * @param tokenA One of the tokens
     * @param tokenB The other token
     * @param fee Fee tier
     * @param sqrtPriceX96 Initial sqrt price
     */
    function createPoolWithPrice(
        address tokenA,
        address tokenB,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external returns (address pool) {
        pool = this.createPool(tokenA, tokenB, fee);
        MockUniswapPool(pool).setSqrtPriceX96(sqrtPriceX96);
        return pool;
    }
}

/**
 * @title MockUniswapPool
 * @notice Mock implementation of Uniswap V3 Pool for testing
 */
contract MockUniswapPool {
    address public immutable token0;
    address public immutable token1;
    uint24 public immutable fee;
    
    uint160 public sqrtPriceX96;
    int24 public tick;
    uint16 public observationIndex;
    uint16 public observationCardinality;
    uint16 public observationCardinalityNext;
    uint8 public feeProtocol;
    bool public unlocked;

    constructor(address _token0, address _token1, uint24 _fee) {
        token0 = _token0;
        token1 = _token1;
        fee = _fee;
        
        // Set default sqrt price (approximately 1:1 rate)
        sqrtPriceX96 = 79228162514264337593543950336; // sqrt(1) * 2^96
        unlocked = true;
    }

    /**
     * @notice The first of the two tokens of the pool, sorted by address
     */
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96_,
            int24 tick_,
            uint16 observationIndex_,
            uint16 observationCardinality_,
            uint16 observationCardinalityNext_,
            uint8 feeProtocol_,
            bool unlocked_
        )
    {
        return (
            sqrtPriceX96,
            tick,
            observationIndex,
            observationCardinality,
            observationCardinalityNext,
            feeProtocol,
            unlocked
        );
    }

    /**
     * @notice Set sqrt price for testing
     */
    function setSqrtPriceX96(uint160 _sqrtPriceX96) external {
        sqrtPriceX96 = _sqrtPriceX96;
    }

    /**
     * @notice Set tick for testing
     */
    function setTick(int24 _tick) external {
        tick = _tick;
    }
}