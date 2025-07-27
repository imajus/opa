const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { expect, time } = require('@1inch/solidity-utils');
const { deploySwapTokens } = require('./helpers/fixtures');
const {
  buildOrder,
  buildMakerTraits,
  buildTakerTraits,
  signOrder,
} = require('./helpers/order');
const { getPermit, withTarget } = require('./helpers/eip712');

async function defaultDeadline() {
  return (await time.latest()) + time.duration.hours(1);
}

async function deployContractsAndInit() {
  const [, maker, taker] = await ethers.getSigners();
  const { dai, weth, usdc, swap } = await deploySwapTokens();
  const tokens = { dai, weth, usdc };
  const contracts = { swap };
  const chainId = (await ethers.provider.getNetwork()).chainId;
  return {
    taker,
    maker,
    tokens,
    contracts,
    chainId,
    async createTakerPermitOrder({
      makerAsset,
      takerAsset,
      makingAmount,
      takingAmount,
    }) {
      const parsedMakingAmount = makerAsset.parseAmount(makingAmount);
      const parsedTakingAmount = takerAsset.parseAmount(takingAmount);
      const order = buildOrder({
        makerAsset: makerAsset.address,
        takerAsset: takerAsset.address,
        makingAmount: parsedMakingAmount,
        takingAmount: parsedTakingAmount,
        maker: maker.address,
      });
      const { r, yParityAndS: vs } = ethers.Signature.from(
        await signOrder(order, chainId, await swap.getAddress(), maker)
      );
      return {
        order,
        r,
        vs,
        makingAmount: parsedMakingAmount,
        takingAmount: parsedTakingAmount,
      };
    },
    async createMakerPermitOrder({
      makerAsset,
      takerAsset,
      makingAmount,
      takingAmount,
      deadline,
    }) {
      const parsedMakingAmount = makerAsset.parseAmount(makingAmount);
      const parsedTakingAmount = takerAsset.parseAmount(takingAmount);
      const makerTraits = buildMakerTraits({});
      const permit = withTarget(
        makerAsset.address,
        await getPermit(
          maker.address,
          maker,
          makerAsset.contract,
          '1',
          chainId,
          await swap.getAddress(),
          parsedMakingAmount,
          deadline ?? (await defaultDeadline())
        )
      );
      const order = buildOrder(
        {
          makerAsset: makerAsset.address,
          takerAsset: takerAsset.address,
          makingAmount: parsedMakingAmount,
          takingAmount: parsedTakingAmount,
          maker: maker.address,
          makerTraits,
        },
        {
          permit,
        }
      );
      const { r, yParityAndS: vs } = ethers.Signature.from(
        await signOrder(order, chainId, await swap.getAddress(), maker)
      );
      return {
        order,
        r,
        vs,
        permit,
        makingAmount: parsedMakingAmount,
        takingAmount: parsedTakingAmount,
      };
    },
    async executeOrderFill({
      order,
      r,
      vs,
      fillAmount,
      makingAmountFill = false,
      threshold = '0',
      skipMakerPermit = false,
    }) {
      const takerTraits = buildTakerTraits({
        threshold: BigInt(threshold),
        makingAmount: makingAmountFill,
        skipMakerPermit,
        usePermit2: false,
        extension: order.extension,
      });
      return await swap
        .connect(taker)
        .fillOrderArgs(
          order,
          r,
          vs,
          fillAmount,
          takerTraits.traits,
          takerTraits.args
        );
    },
  };
}

describe('LimitOrderProtocol', function () {
  describe('Permit', function () {
    // describe('Taker Permit', function () {
    //   it('DAI => WETH, no allowance', async function () {
    //     const {
    //       taker,
    //       maker,
    //       tokens,
    //       contracts: { swap },
    //       chainId,
    //       createTakerPermitOrder,
    //     } = await loadFixture(deployContractsAndInit);
    //     const setup = {
    //       makerAsset: tokens.weth,
    //       takerAsset: tokens.dai,
    //       makingAmount: '0.026797',
    //       takingAmount: '100',
    //     };
    //     await setup.makerAsset.mint(maker, setup.makingAmount);
    //     await setup.makerAsset.approve(maker, swap, setup.makingAmount);
    //     await setup.takerAsset.mint(taker, setup.takingAmount);
    //     // No initial approval for taker - they will use permit
    //     const { makingAmount, takingAmount, order, r, vs } =
    //       await createTakerPermitOrder({
    //         makerAsset: setup.makerAsset,
    //         takerAsset: setup.takerAsset,
    //         makingAmount: setup.makingAmount,
    //         takingAmount: setup.takingAmount,
    //       });
    //     const permit = await getPermit(
    //       taker.address,
    //       taker,
    //       setup.takerAsset.contract,
    //       '1',
    //       chainId,
    //       await swap.getAddress(),
    //       takingAmount,
    //       await defaultDeadline()
    //     );
    //     const takerTraits = buildTakerTraits({
    //       // threshold: setup.makerAsset.parseAmount(setup.makingAmount),
    //       makingAmount: true,
    //     });
    //     // Ensure allowance is 0
    //     await setup.takerAsset.approve(taker, swap, '0');
    //     const fillTx = swap.permitAndCall(
    //       ethers.solidityPacked(
    //         ['address', 'bytes'],
    //         [setup.takerAsset.address, permit]
    //       ),
    //       swap.interface.encodeFunctionData('fillOrderArgs', [
    //         order,
    //         r,
    //         vs,
    //         makingAmount,
    //         takerTraits.traits,
    //         takerTraits.args,
    //       ])
    //     );
    //     await expect(fillTx).to.changeTokenBalances(
    //       setup.makerAsset.contract,
    //       [taker.address, maker.address],
    //       [makingAmount, -makingAmount]
    //     );
    //     await expect(fillTx).to.changeTokenBalances(
    //       setup.takerAsset.contract,
    //       [taker.address, maker.address],
    //       [-takingAmount, takingAmount]
    //     );
    //   });
    //   it('skips expired permit if allowance is enough', async function () {
    //     const {
    //       taker,
    //       maker,
    //       tokens,
    //       contracts,
    //       chainId,
    //       createTakerPermitOrder,
    //     } = await loadFixture(deployContractsAndInit);
    //     const setup = {
    //       makerAsset: tokens.dai,
    //       takerAsset: tokens.weth,
    //       makingAmount: '1',
    //       takingAmount: '1',
    //     };
    //     await setup.makerAsset.mint(maker, setup.makingAmount);
    //     await setup.makerAsset.approve(
    //       maker,
    //       contracts.swap,
    //       setup.makingAmount
    //     );
    //     await setup.takerAsset.mint(taker, setup.takingAmount);
    //     await setup.takerAsset.approve(
    //       taker,
    //       contracts.swap,
    //       setup.takingAmount
    //     );
    //     const { order, r, vs } = await createTakerPermitOrder({
    //       makerAsset: setup.makerAsset,
    //       takerAsset: setup.takerAsset,
    //       makingAmount: setup.makingAmount,
    //       takingAmount: setup.takingAmount,
    //     });
    //     const deadline = (await time.latest()) - time.duration.weeks(1);
    //     const permit = await getPermit(
    //       taker.address,
    //       taker,
    //       setup.takerAsset.contract,
    //       '1',
    //       chainId,
    //       await contracts.swap.getAddress(),
    //       setup.takingAmount,
    //       deadline
    //     );
    //     const fillTx = contracts.swap.permitAndCall(
    //       ethers.solidityPacked(
    //         ['address', 'bytes'],
    //         [setup.takerAsset.address, permit]
    //       ),
    //       contracts.swap.interface.encodeFunctionData('fillOrderArgs', [
    //         order,
    //         r,
    //         vs,
    //         setup.takerAsset.parseAmount(setup.takingAmount),
    //         buildTakerTraits({
    //           threshold: setup.makerAsset.parseAmount(setup.makingAmount),
    //         }).traits,
    //         buildTakerTraits({
    //           threshold: setup.makerAsset.parseAmount(setup.makingAmount),
    //         }).args,
    //       ])
    //     );
    //     await expect(fillTx).to.changeTokenBalances(
    //       setup.makerAsset.contract,
    //       [taker.address, maker.address],
    //       [
    //         setup.makerAsset.parseAmount(setup.makingAmount),
    //         -setup.makerAsset.parseAmount(setup.makingAmount),
    //       ]
    //     );
    //     await expect(fillTx).to.changeTokenBalances(
    //       setup.takerAsset.contract,
    //       [taker.address, maker.address],
    //       [
    //         -setup.takerAsset.parseAmount(setup.takingAmount),
    //         setup.takerAsset.parseAmount(setup.takingAmount),
    //       ]
    //     );
    //   });
    //   it('rejects expired permit when allowance is not enough', async function () {
    //     const {
    //       taker,
    //       maker,
    //       tokens,
    //       contracts,
    //       chainId,
    //       createTakerPermitOrder,
    //     } = await loadFixture(deployContractsAndInit);
    //     const setup = {
    //       makerAsset: tokens.dai,
    //       takerAsset: tokens.weth,
    //       makingAmount: '1',
    //       takingAmount: '1',
    //     };
    //     await setup.makerAsset.mint(maker, setup.makingAmount);
    //     await setup.makerAsset.approve(
    //       maker,
    //       contracts.swap,
    //       setup.makingAmount
    //     );
    //     await setup.takerAsset.mint(taker, setup.takingAmount);
    //     const { order, r, vs } = await createTakerPermitOrder({
    //       makerAsset: setup.makerAsset,
    //       takerAsset: setup.takerAsset,
    //       makingAmount: setup.makingAmount,
    //       takingAmount: setup.takingAmount,
    //     });
    //     const deadline = (await time.latest()) - time.duration.weeks(1);
    //     const permit = await getPermit(
    //       taker.address,
    //       taker,
    //       setup.takerAsset.contract,
    //       '1',
    //       chainId,
    //       await contracts.swap.getAddress(),
    //       setup.takingAmount,
    //       deadline
    //     );
    //     await setup.takerAsset.approve(taker, contracts.swap, '0');
    //     await expect(
    //       contracts.swap.permitAndCall(
    //         ethers.solidityPacked(
    //           ['address', 'bytes'],
    //           [setup.takerAsset.address, permit]
    //         ),
    //         contracts.swap.interface.encodeFunctionData('fillOrderArgs', [
    //           order,
    //           r,
    //           vs,
    //           setup.takerAsset.parseAmount(setup.takingAmount),
    //           buildTakerTraits({
    //             threshold: setup.makerAsset.parseAmount(setup.makingAmount),
    //           }).traits,
    //           buildTakerTraits({
    //             threshold: setup.makerAsset.parseAmount(setup.makingAmount),
    //           }).args,
    //         ])
    //       )
    //     ).to.be.revertedWithCustomError(
    //       contracts.swap,
    //       'TransferFromTakerToMakerFailed'
    //     );
    //   });
    // });
    describe('Maker Permit', function () {
      it('Maker permit works, no allowance', async function () {
        const {
          taker,
          maker,
          tokens,
          contracts,
          createMakerPermitOrder,
          executeOrderFill,
        } = await loadFixture(deployContractsAndInit);
        const setup = {
          makerAsset: tokens.weth,
          takerAsset: tokens.dai,
          makingAmount: '0.026797',
          takingAmount: '100',
        };
        await setup.makerAsset.mint(maker, setup.makingAmount);
        await setup.takerAsset.mint(taker, setup.takingAmount);
        await setup.takerAsset.approve(
          taker,
          contracts.swap,
          setup.takingAmount
        );
        const deadline = (await time.latest()) + time.duration.weeks(1);
        const { order, r, vs } = await createMakerPermitOrder({
          makerAsset: setup.makerAsset,
          takerAsset: setup.takerAsset,
          makingAmount: setup.makingAmount,
          takingAmount: setup.takingAmount,
          deadline,
        });
        await setup.makerAsset.approve(maker, contracts.swap, '0');
        const fillTx = await executeOrderFill({
          order,
          r,
          vs,
          fillAmount: setup.makerAsset.parseAmount(setup.makingAmount),
          makingAmountFill: true,
          threshold: setup.takerAsset.parseAmount(setup.takingAmount),
        });
        await expect(fillTx).to.changeTokenBalances(
          setup.takerAsset.contract,
          [taker.address, maker.address],
          [
            -setup.takerAsset.parseAmount(setup.takingAmount),
            setup.takerAsset.parseAmount(setup.takingAmount),
          ]
        );
        await expect(fillTx).to.changeTokenBalances(
          setup.makerAsset.contract,
          [taker.address, maker.address],
          [
            setup.makerAsset.parseAmount(setup.makingAmount),
            -setup.makerAsset.parseAmount(setup.makingAmount),
          ]
        );
      });
      it('skips expired permit if allowance is enough', async function () {
        const {
          taker,
          maker,
          tokens,
          contracts,
          createMakerPermitOrder,
          executeOrderFill,
        } = await loadFixture(deployContractsAndInit);
        const setup = {
          makerAsset: tokens.weth,
          takerAsset: tokens.dai,
          makingAmount: '0.026797',
          takingAmount: '100',
        };
        await setup.makerAsset.mint(maker, setup.makingAmount);
        await setup.makerAsset.approve(
          maker,
          contracts.swap,
          setup.makingAmount
        );
        await setup.takerAsset.mint(taker, setup.takingAmount);
        await setup.takerAsset.approve(
          taker,
          contracts.swap,
          setup.takingAmount
        );
        const deadline = (await time.latest()) + time.duration.weeks(1);
        const { order, r, vs } = await createMakerPermitOrder({
          makerAsset: setup.makerAsset,
          takerAsset: setup.takerAsset,
          makingAmount: setup.makingAmount,
          takingAmount: setup.takingAmount,
          deadline,
        });
        await time.increaseTo(deadline + 1);
        const fillTx = await executeOrderFill({
          order,
          r,
          vs,
          fillAmount: setup.makerAsset.parseAmount(setup.makingAmount),
          makingAmountFill: true,
          threshold: setup.takerAsset.parseAmount(setup.takingAmount),
        });
        await expect(fillTx).to.changeTokenBalances(
          setup.takerAsset.contract,
          [taker.address, maker.address],
          [
            -setup.takerAsset.parseAmount(setup.takingAmount),
            setup.takerAsset.parseAmount(setup.takingAmount),
          ]
        );
        await expect(fillTx).to.changeTokenBalances(
          setup.makerAsset.contract,
          [taker.address, maker.address],
          [
            setup.makerAsset.parseAmount(setup.makingAmount),
            -setup.makerAsset.parseAmount(setup.makingAmount),
          ]
        );
      });
      it('rejects expired permit when allowance is not enough', async function () {
        const {
          taker,
          maker,
          tokens,
          contracts,
          createMakerPermitOrder,
          executeOrderFill,
        } = await loadFixture(deployContractsAndInit);
        const setup = {
          makerAsset: tokens.weth,
          takerAsset: tokens.dai,
          makingAmount: '1',
          takingAmount: '1',
        };
        await setup.makerAsset.mint(maker, setup.makingAmount);
        await setup.takerAsset.mint(taker, setup.takingAmount);
        await setup.takerAsset.approve(
          taker,
          contracts.swap,
          setup.takingAmount
        );
        const deadline = (await time.latest()) + time.duration.weeks(1);
        const { order, r, vs } = await createMakerPermitOrder({
          makerAsset: setup.makerAsset,
          takerAsset: setup.takerAsset,
          makingAmount: setup.makingAmount,
          takingAmount: setup.takingAmount,
          deadline,
        });
        await setup.makerAsset.approve(maker, contracts.swap, '0');
        await time.increaseTo(deadline + 1);
        await expect(
          executeOrderFill({
            order,
            r,
            vs,
            fillAmount: setup.makerAsset.parseAmount(setup.makingAmount),
            makingAmountFill: true,
            threshold: setup.takerAsset.parseAmount(setup.takingAmount),
          })
        ).to.be.revertedWithCustomError(
          contracts.swap,
          'TransferFromMakerToTakerFailed'
        );
      });
      it('skips order permit flag', async function () {
        const {
          taker,
          maker,
          tokens,
          contracts,
          createMakerPermitOrder,
          executeOrderFill,
        } = await loadFixture(deployContractsAndInit);
        const setup = {
          makerAsset: tokens.weth,
          takerAsset: tokens.dai,
          makingAmount: '1',
          takingAmount: '1',
        };
        await setup.makerAsset.mint(maker, setup.makingAmount);
        await setup.takerAsset.mint(taker, setup.takingAmount);
        await setup.takerAsset.approve(
          taker,
          contracts.swap,
          setup.takingAmount
        );
        const deadline = (await time.latest()) + time.duration.weeks(1);
        const { order, r, vs, permit } = await createMakerPermitOrder({
          makerAsset: setup.makerAsset,
          takerAsset: setup.takerAsset,
          makingAmount: setup.makingAmount,
          takingAmount: setup.takingAmount,
          deadline,
        });
        await setup.makerAsset.approve(maker, contracts.swap, '0');
        await taker.sendTransaction({
          to: setup.makerAsset.address,
          data: '0xd505accf' + permit.substring(42),
        });
        const fillTx = await executeOrderFill({
          order,
          r,
          vs,
          fillAmount: setup.makerAsset.parseAmount(setup.makingAmount),
          makingAmountFill: true,
          threshold: 0n,
          skipMakerPermit: true,
        });
        await expect(fillTx).to.changeTokenBalances(
          setup.takerAsset.contract,
          [taker.address, maker.address],
          [
            -setup.takerAsset.parseAmount(setup.takingAmount),
            setup.takerAsset.parseAmount(setup.takingAmount),
          ]
        );
        await expect(fillTx).to.changeTokenBalances(
          setup.makerAsset.contract,
          [taker.address, maker.address],
          [
            setup.makerAsset.parseAmount(setup.makingAmount),
            -setup.makerAsset.parseAmount(setup.makingAmount),
          ]
        );
      });
    });
  });
});
