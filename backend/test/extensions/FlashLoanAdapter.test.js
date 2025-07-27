const { ethers } = require('hardhat');
const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const TEST_AMOUNT = ethers.parseEther('100');

async function deployFlashLoanAdapterFixture() {
  const [owner, user] = await ethers.getSigners();

  // Deploy mock Aave Pool
  const MockAavePool = await ethers.getContractFactory('MockAavePool');
  const mockAavePool = await MockAavePool.deploy();

  // Deploy FlashLoanAdapter
  const FlashLoanAdapter = await ethers.getContractFactory('FlashLoanAdapter');
  const flashLoanAdapter = await FlashLoanAdapter.deploy();

  return { flashLoanAdapter, mockAavePool, owner, user };
}

describe('FlashLoanAdapter', function () {
  describe('Flash Loan Execution', function () {
    it('should execute flash loan with valid parameters', async function () {
      const { flashLoanAdapter, mockAavePool } = await loadFixture(
        deployFlashLoanAdapterFixture
      );

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
      const { flashLoanAdapter } = await loadFixture(
        deployFlashLoanAdapterFixture
      );

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
      const { flashLoanAdapter, mockAavePool } = await loadFixture(
        deployFlashLoanAdapterFixture
      );

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
      const { flashLoanAdapter } = await loadFixture(
        deployFlashLoanAdapterFixture
      );

      const amount = ethers.parseEther('100');
      const expectedFee = (amount * 5n) / 10000n; // 0.05%

      const calculatedFee = await flashLoanAdapter.getFlashLoanFee(amount);
      expect(calculatedFee).to.equal(expectedFee);
    });

    it('should calculate total repayment correctly', async function () {
      const { flashLoanAdapter } = await loadFixture(
        deployFlashLoanAdapterFixture
      );

      const principal = ethers.parseEther('100');
      const expectedFee = (principal * 5n) / 10000n; // 0.05%
      const expectedTotal = principal + expectedFee;

      const calculatedTotal = await flashLoanAdapter.calculateTotalRepayment(
        principal
      );
      expect(calculatedTotal).to.equal(expectedTotal);
    });

    it('should handle edge case amounts', async function () {
      const { flashLoanAdapter } = await loadFixture(
        deployFlashLoanAdapterFixture
      );

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
      const { flashLoanAdapter, mockAavePool } = await loadFixture(
        deployFlashLoanAdapterFixture
      );

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
      const { flashLoanAdapter } = await loadFixture(
        deployFlashLoanAdapterFixture
      );

      const isValid = await flashLoanAdapter.validateFlashLoanParams(
        ethers.ZeroAddress,
        WETH_ADDRESS,
        TEST_AMOUNT,
        await flashLoanAdapter.getAddress()
      );
      expect(isValid).to.be.false;
    });

    it('should reject invalid asset address', async function () {
      const { flashLoanAdapter, mockAavePool } = await loadFixture(
        deployFlashLoanAdapterFixture
      );

      const isValid = await flashLoanAdapter.validateFlashLoanParams(
        await mockAavePool.getAddress(),
        ethers.ZeroAddress,
        TEST_AMOUNT,
        await flashLoanAdapter.getAddress()
      );
      expect(isValid).to.be.false;
    });

    it('should reject zero amount', async function () {
      const { flashLoanAdapter, mockAavePool } = await loadFixture(
        deployFlashLoanAdapterFixture
      );

      const isValid = await flashLoanAdapter.validateFlashLoanParams(
        await mockAavePool.getAddress(),
        WETH_ADDRESS,
        0,
        await flashLoanAdapter.getAddress()
      );
      expect(isValid).to.be.false;
    });

    it('should reject invalid receiver address', async function () {
      const { flashLoanAdapter, mockAavePool } = await loadFixture(
        deployFlashLoanAdapterFixture
      );

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
      const { flashLoanAdapter, owner } = await loadFixture(
        deployFlashLoanAdapterFixture
      );

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
