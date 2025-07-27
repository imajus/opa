const { ethers } = require('hardhat');
const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

describe('FlashLoanAdapter', function () {
  // Mock Aave Pool for testing
  let mockAavePool;
  let flashLoanAdapter;
  let owner;
  let user;

  const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const TEST_AMOUNT = ethers.parseEther('100');

  async function deployFlashLoanAdapterFixture() {
    [owner, user] = await ethers.getSigners();

    // Deploy mock Aave Pool
    const MockAavePool = await ethers.getContractFactory('MockAavePool');
    mockAavePool = await MockAavePool.deploy();

    // Deploy FlashLoanAdapter
    const FlashLoanAdapter = await ethers.getContractFactory(
      'FlashLoanAdapter'
    );
    flashLoanAdapter = await FlashLoanAdapter.deploy();

    return { flashLoanAdapter, mockAavePool, owner, user };
  }

  beforeEach(async function () {
    ({ flashLoanAdapter, mockAavePool, owner, user } = await loadFixture(
      deployFlashLoanAdapterFixture
    ));
  });

  describe('Flash Loan Execution', function () {
    it('should execute flash loan with valid parameters', async function () {
      const params = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256'],
        [123]
      );

      await expect(
        flashLoanAdapter.executeFlashLoan(
          await mockAavePool.getAddress(),
          WETH_ADDRESS,
          TEST_AMOUNT,
          await flashLoanAdapter.getAddress(),
          params
        )
      )
        .to.emit(flashLoanAdapter, 'FlashLoanRequested')
        .withArgs(
          WETH_ADDRESS,
          TEST_AMOUNT,
          await flashLoanAdapter.getAddress()
        );
    });

    it('should revert with invalid pool address', async function () {
      const params = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256'],
        [123]
      );

      await expect(
        flashLoanAdapter.executeFlashLoan(
          ethers.ZeroAddress,
          WETH_ADDRESS,
          TEST_AMOUNT,
          await flashLoanAdapter.getAddress(),
          params
        )
      ).to.be.revertedWithCustomError(flashLoanAdapter, 'InvalidPool');
    });

    it('should revert with zero amount', async function () {
      const params = ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256'],
        [123]
      );

      await expect(
        flashLoanAdapter.executeFlashLoan(
          await mockAavePool.getAddress(),
          WETH_ADDRESS,
          0,
          await flashLoanAdapter.getAddress(),
          params
        )
      ).to.be.revertedWithCustomError(flashLoanAdapter, 'InvalidAmount');
    });
  });

  describe('Fee Calculations', function () {
    it('should calculate flash loan fee correctly', async function () {
      const amount = ethers.parseEther('100');
      const expectedFee = (amount * 5n) / 10000n; // 0.05%

      const calculatedFee = await flashLoanAdapter.getFlashLoanFee(amount);
      expect(calculatedFee).to.equal(expectedFee);
    });

    it('should calculate total repayment correctly', async function () {
      const principal = ethers.parseEther('100');
      const expectedFee = (principal * 5n) / 10000n; // 0.05%
      const expectedTotal = principal + expectedFee;

      const calculatedTotal = await flashLoanAdapter.calculateTotalRepayment(
        principal
      );
      expect(calculatedTotal).to.equal(expectedTotal);
    });

    it('should handle edge case amounts', async function () {
      // Test with very small amount
      const smallAmount = 1000n; // 1000 wei
      const smallFee = await flashLoanAdapter.getFlashLoanFee(smallAmount);
      expect(smallFee).to.equal(0n); // Should round down to 0

      // Test with large amount
      const largeAmount = ethers.parseEther('1000000');
      const largeFee = await flashLoanAdapter.getFlashLoanFee(largeAmount);
      const expectedLargeFee = (largeAmount * 5n) / 10000n;
      expect(largeFee).to.equal(expectedLargeFee);
    });
  });

  describe('Parameter Validation', function () {
    it('should validate flash loan parameters correctly', async function () {
      // Valid parameters
      const isValid = await flashLoanAdapter.validateFlashLoanParams(
        await mockAavePool.getAddress(),
        WETH_ADDRESS,
        TEST_AMOUNT,
        await flashLoanAdapter.getAddress()
      );
      expect(isValid).to.be.true;
    });

    it('should reject invalid pool address', async function () {
      const isValid = await flashLoanAdapter.validateFlashLoanParams(
        ethers.ZeroAddress,
        WETH_ADDRESS,
        TEST_AMOUNT,
        await flashLoanAdapter.getAddress()
      );
      expect(isValid).to.be.false;
    });

    it('should reject invalid asset address', async function () {
      const isValid = await flashLoanAdapter.validateFlashLoanParams(
        await mockAavePool.getAddress(),
        ethers.ZeroAddress,
        TEST_AMOUNT,
        await flashLoanAdapter.getAddress()
      );
      expect(isValid).to.be.false;
    });

    it('should reject zero amount', async function () {
      const isValid = await flashLoanAdapter.validateFlashLoanParams(
        await mockAavePool.getAddress(),
        WETH_ADDRESS,
        0,
        await flashLoanAdapter.getAddress()
      );
      expect(isValid).to.be.false;
    });

    it('should reject invalid receiver address', async function () {
      const isValid = await flashLoanAdapter.validateFlashLoanParams(
        await mockAavePool.getAddress(),
        WETH_ADDRESS,
        TEST_AMOUNT,
        ethers.ZeroAddress
      );
      expect(isValid).to.be.false;
    });
  });

  describe('executeOperation callback', function () {
    it('should return false as it should not be called directly', async function () {
      const result = await flashLoanAdapter.executeOperation.staticCall(
        WETH_ADDRESS,
        TEST_AMOUNT,
        ethers.parseEther('0.05'), // 0.05 ETH premium
        owner.address,
        '0x'
      );
      expect(result).to.be.false;
    });
  });
});

// Mock Aave Pool contract for testing
const MockAavePoolArtifact = {
  contractName: 'MockAavePool',
  abi: [
    {
      inputs: [
        { name: 'receivingAddress', type: 'address' },
        { name: 'asset', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'params', type: 'bytes' },
        { name: 'referralCode', type: 'uint16' },
      ],
      name: 'flashLoanSimple',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ],
  bytecode:
    '0x608060405234801561001057600080fd5b50610150806100206000396000f3fe608060405234801561001057600080fd5b506004361061002b5760003560e01c80635cffe9de14610030575b600080fd5b61004a600480360381019061004591906100a0565b61004c565b005b5050505050565b600080fd5b6000819050919050565b61006b81610058565b811461007657600080fd5b50565b60008135905061008881610062565b92915050565b61009781610058565b82525050565b600080600080600060a086880312156100b9576100b8610053565b5b60006100c788828901610079565b95505060206100d888828901610079565b94505060406100e988828901610079565b935050606086013567ffffffffffffffff81111561010a57610109610053565b5b818801915088601f83011261012257610121610053565b5b813567ffffffffffffffff81111561013d5761013c610053565b5b84891508360208201111561015457610153610053565b5b8092505050925050608061016b88828901610079565b915050929550929590929450505056fea2646970667358221220c5c2c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c5c564736f6c63430008130033',
};
