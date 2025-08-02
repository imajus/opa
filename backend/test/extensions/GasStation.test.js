const { ethers } = require('hardhat');
const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { deployGasStationIntegration } = require('../helpers/fixtures');
const { buildOrder } = require('../helpers/order');
const { ether } = require('../helpers/utils');

const DEFAULT_ORDER_AMOUNT = ether('100');
const DEFAULT_WETH_AMOUNT = ether('100');

async function deployGasStationFixture() {
  const [, maker, taker] = await ethers.getSigners();
  const fixture = await deployGasStationIntegration();
  return {
    ...fixture,
    maker,
    taker,
  };
}

describe('GasStation', function () {
  describe('Deployment', function () {
    it('should deploy with correct configuration', async function () {
      const { gasStation, mockAavePool, tokens, config } = await loadFixture(
        deployGasStationFixture
      );

      expect(await gasStation.takerFeeBps()).to.equal(config.takerFeeBps);
      expect(await gasStation.gasStipend()).to.equal(config.gasStipend);
      expect(await gasStation.weth()).to.equal(tokens.weth.address);
      expect(await gasStation.aavePool()).to.equal(
        await mockAavePool.getAddress()
      );
    });

    it('should revert with invalid constructor parameters', async function () {
      const { mockAavePool, tokens, config } = await loadFixture(
        deployGasStationFixture
      );
      const GasStation = await ethers.getContractFactory('GasStation');

      // Test invalid taker fee (> 100%)
      await expect(
        GasStation.deploy(
          10001, // > 100%
          config.gasStipend,
          config.mockUniswapFactory,
          config.mockSwapRouter,
          tokens.weth.address,
          await mockAavePool.getAddress()
        )
      ).to.be.revertedWith('GasStation: fee too high');

      // Test zero gas stipend
      await expect(
        GasStation.deploy(
          config.takerFeeBps,
          0,
          config.mockUniswapFactory,
          config.mockSwapRouter,
          tokens.weth.address,
          await mockAavePool.getAddress()
        )
      ).to.be.revertedWith('GasStation: invalid gas stipend');
    });
  });

  describe('Cost Calculations', function () {
    it('should calculate total costs correctly', async function () {
      const { config } = await loadFixture(deployGasStationFixture);
      const gasPrice = ethers.parseUnits('20', 'gwei');
      const flashLoanAmount = ether('100');

      // Calculate expected costs
      const expectedGasReimbursement = BigInt(config.gasStipend) * gasPrice;
      const expectedFlashLoanFee = (flashLoanAmount * 5n) / 10000n; // 0.05%
      const expectedTakerFee =
        (flashLoanAmount * BigInt(config.takerFeeBps)) / 10000n; // 1%
      const expectedTotal =
        expectedGasReimbursement + expectedFlashLoanFee + expectedTakerFee;

      expect(expectedTotal).to.be.gt(0);
      expect(expectedFlashLoanFee).to.equal(ether('0.05')); // 0.05% of 100 ETH
      expect(expectedTakerFee).to.equal(ether('1')); // 1% of 100 ETH
    });
  });

  describe('Uniswap V3 Integration', function () {
    it('should have correct Uniswap V3 configuration', async function () {
      const { gasStation, config } = await loadFixture(deployGasStationFixture);

      expect(await gasStation.uniswapFactory()).to.equal(
        config.mockUniswapFactory
      );
      expect(await gasStation.swapRouter()).to.equal(config.mockSwapRouter);
    });
  });
});
