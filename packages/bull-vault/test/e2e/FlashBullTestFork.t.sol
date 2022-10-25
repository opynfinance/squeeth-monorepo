pragma solidity =0.7.6;

pragma abicoder v2;

// test dependency
import "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
//interface
import {IERC20} from "openzeppelin/token/ERC20/IERC20.sol";
import {IController} from "squeeth-monorepo/interfaces/IController.sol";
import {IEulerMarkets} from "../../src/interface/IEulerMarkets.sol";
import {IEulerEToken} from "../../src/interface/IEulerEToken.sol";
import {IEulerDToken} from "../../src/interface/IEulerDToken.sol";
// contract
import {BullStrategy} from "../../src/BullStrategy.sol";
import {CrabStrategyV2} from "squeeth-monorepo/strategy/CrabStrategyV2.sol";
import {Controller} from "squeeth-monorepo/core/Controller.sol";
import {UniBullHelper} from "../helper/UniBullHelper.sol";
import {FlashBull} from "../../src/FlashBull.sol";
// lib
import {VaultLib} from "squeeth-monorepo/libs/VaultLib.sol";
import {StrategyMath} from "squeeth-monorepo/strategy/base/StrategyMath.sol"; // StrategyMath licensed under AGPL-3.0-only
<<<<<<< HEAD
import {Power2Base} from "squeeth-monorepo/libs/Power2Base.sol";
=======
>>>>>>> c7f1baf08dfd0df481a9fdc1b4a3972c43d1b2ad

/**
 * @notice Ropsten fork testing
 */
contract FlashBullTestFork is Test {
    using StrategyMath for uint256;

    uint32 internal constant TWAP = 420;
<<<<<<< HEAD
    uint128 internal constant ONE = 1e18;
=======
>>>>>>> c7f1baf08dfd0df481a9fdc1b4a3972c43d1b2ad

    FlashBull internal flashBull;
    BullStrategy internal bullStrategy;
    CrabStrategyV2 internal crabV2;
    Controller internal controller;
    UniBullHelper internal uniBullHelper;

    uint256 internal user1Pk;
    address internal user1;
    address internal weth;
    address internal usdc;
    address internal euler;
    address internal eulerMarketsModule;
    address internal eToken;
    address internal dToken;
    address internal wPowerPerp;
<<<<<<< HEAD
    address internal oracle;
    address internal ethWSqueethPool;
    uint256 ethToCrab = 5e18;
    uint256 totalEthToBull = 20e18;
=======
>>>>>>> c7f1baf08dfd0df481a9fdc1b4a3972c43d1b2ad

    function setUp() public {
        string memory FORK_URL = vm.envString("FORK_URL");
        vm.createSelectFork(FORK_URL, 15781550);

<<<<<<< HEAD
        oracle = 0x65D66c76447ccB45dAf1e8044e918fA786A483A1;
=======
>>>>>>> c7f1baf08dfd0df481a9fdc1b4a3972c43d1b2ad
        euler = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
        eulerMarketsModule = 0x3520d5a913427E6F0D6A83E07ccD4A4da316e4d3;
        controller = Controller(0x64187ae08781B09368e6253F9E94951243A493D5);
        crabV2 = CrabStrategyV2(0x3B960E47784150F5a63777201ee2B15253D713e8);
<<<<<<< HEAD
        bullStrategy = new BullStrategy(
            address(crabV2),
            address(controller),
            0x1F98431c8aD98523631AE4a59f267346ea31F984,
            euler,
            eulerMarketsModule
        );
        uniBullHelper = new UniBullHelper(
            0x1F98431c8aD98523631AE4a59f267346ea31F984
        );
        flashBull = new FlashBull(
            address(bullStrategy),
            0x1F98431c8aD98523631AE4a59f267346ea31F984,
            0x65D66c76447ccB45dAf1e8044e918fA786A483A1
        );
=======
        bullStrategy =
        new BullStrategy(address(crabV2), address(controller), 0x1F98431c8aD98523631AE4a59f267346ea31F984, euler, eulerMarketsModule);
        uniBullHelper = new UniBullHelper(0x1F98431c8aD98523631AE4a59f267346ea31F984);
        flashBull = new FlashBull(address(bullStrategy), 0x1F98431c8aD98523631AE4a59f267346ea31F984);
>>>>>>> c7f1baf08dfd0df481a9fdc1b4a3972c43d1b2ad
        usdc = controller.quoteCurrency();
        weth = controller.weth();
        eToken = IEulerMarkets(eulerMarketsModule).underlyingToEToken(weth);
        dToken = IEulerMarkets(eulerMarketsModule).underlyingToDToken(usdc);
        wPowerPerp = controller.wPowerPerp();
<<<<<<< HEAD
        ethWSqueethPool = IController(bullStrategy.powerTokenController())
            .wPowerPerpPool();
=======
>>>>>>> c7f1baf08dfd0df481a9fdc1b4a3972c43d1b2ad

        user1Pk = 0xA11CE;
        user1 = vm.addr(user1Pk);

        vm.label(user1, "User 1");
        vm.label(address(bullStrategy), "BullStrategy");
        vm.label(address(flashBull), "FlashBull");
        vm.label(euler, "Euler");
        vm.label(eulerMarketsModule, "EulerMarkets");
        vm.label(usdc, "USDC");
        vm.label(weth, "WETH");

        vm.deal(user1, 100000000e18);
        // this is a crab whale, get some crab token from
        vm.prank(0x06CECFbac34101aE41C88EbC2450f8602b3d164b);
        IERC20(crabV2).transfer(user1, 100e18);
        // some WETH and USDC rich address
        vm.prank(0x57757E3D981446D585Af0D9Ae4d7DF6D64647806);
        IERC20(weth).transfer(user1, 10000e18);
    }

    function testInitialFlashDeposit() public {
<<<<<<< HEAD

        vm.startPrank(user1);
        flashBull.flashDeposit{value: totalEthToBull}(
            totalEthToBull,
            ethToCrab,
            3000
        );
        vm.stopPrank();

        // Check we have the right number of ETH in Euler
        uint256 ethUsdPrice = uniBullHelper.getTwap(
            controller.ethQuoteCurrencyPool(),
            controller.weth(),
            controller.quoteCurrency(),
            TWAP,
            false
        );
        uint256 squeethEthPrice = uniBullHelper.getTwap(
            controller.wPowerPerpPool(),
            controller.wPowerPerp(),
            controller.weth(),
            TWAP,
            false
        );
        (uint256 ethInCrab, uint256 squeethInCrab) = _getCrabVaultDetails();
        uint256 crabUsdPrice = (
            ethInCrab.wmul(ethUsdPrice).sub(
                squeethInCrab.wmul(squeethEthPrice).wmul(ethUsdPrice)
            )
        ).wdiv(crabV2.totalSupply());

        uint256 crabToDeposit = IERC20(crabV2).balanceOf(address(bullStrategy));

        // Check that flashbull has the right number of bull tokens
        assertEq(bullStrategy.balanceOf(address(flashBull)), crabToDeposit);

        // Check the flashbull does not hold any squeeth or dollars still
        assertEq(IERC20(usdc).balanceOf(address(flashBull)), 0);
        assertEq(IERC20(wPowerPerp).balanceOf(address(flashBull)), 0);

        // Check the leverage component calculations
        uint256 bullShare = bullStrategy.balanceOf(address(flashBull)).wdiv(
            bullStrategy.totalSupply()
        );
        (uint256 wethToLend, uint256 usdcToBorrow) = bullStrategy
            .calcLeverageEthUsdc(
                crabToDeposit,
                bullShare,
                crabUsdPrice,
                ethUsdPrice
            );
        assertEq(
            IEulerDToken(dToken).balanceOf(address(bullStrategy)),
            usdcToBorrow
        );
        assertTrue(
            wethToLend.sub(
                IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy))
            ) <= 1
        );

        // Check we have the right number of Crab tokens
        (, uint256 fee) = _calcWsqueethToMintAndFee(
            ethToCrab,
            squeethInCrab,
            ethInCrab
        );
        assertEq(
            IERC20(crabV2).balanceOf(address(bullStrategy)),
            _calcSharesToMint(
                ethToCrab.sub(fee),
                ethInCrab,
                IERC20(crabV2).totalSupply()
            )
        );
    }

    function _calcWsqueethToMintAndFee(
        uint256 _depositedAmount,
        uint256 _strategyDebtAmount,
        uint256 _strategyCollateralAmount
    ) internal view returns (uint256, uint256) {
        uint256 wSqueethToMint;
        uint256 feeAdjustment = _calcFeeAdjustment();

        wSqueethToMint = _depositedAmount.wmul(_strategyDebtAmount).wdiv(
            _strategyCollateralAmount.add(
                _strategyDebtAmount.wmul(feeAdjustment)
            )
        );

        uint256 fee = wSqueethToMint.wmul(feeAdjustment);

        return (wSqueethToMint, fee);
    }

    /**
     * @notice calculate the fee adjustment factor, which is the amount of ETH owed per 1 wSqueeth minted
     * @dev the fee is a based off the index value of squeeth and uses a twap scaled down by the PowerPerp's INDEX_SCALE
     * @return the fee adjustment factor
     */
    function _calcFeeAdjustment() internal view returns (uint256) {
        uint256 wSqueethEthPrice = Power2Base._getTwap(
            oracle,
            ethWSqueethPool,
            wPowerPerp,
            weth,
            TWAP,
            false
        );
        uint256 feeRate = IController(bullStrategy.powerTokenController())
            .feeRate();
        return wSqueethEthPrice.mul(feeRate).div(10000);
    }

    /**
     * @dev calculate amount of strategy token to mint for depositor
     * @param _amount amount of ETH deposited
     * @param _strategyCollateralAmount amount of strategy collateral
     * @param _crabTotalSupply total supply of strategy token
     * @return amount of strategy token to mint
     */
    function _calcSharesToMint(
        uint256 _amount,
        uint256 _strategyCollateralAmount,
        uint256 _crabTotalSupply
    ) internal pure returns (uint256) {
        uint256 depositorShare = _amount.wdiv(
            _strategyCollateralAmount.add(_amount)
        );

        if (_crabTotalSupply != 0)
            return
                _crabTotalSupply.wmul(depositorShare).wdiv(
                    uint256(ONE).sub(depositorShare)
                );

        return _amount;
    }

    function _getCrabVaultDetails() internal view returns (uint256, uint256) {
        VaultLib.Vault memory strategyVault = IController(address(controller))
            .vaults(crabV2.vaultId());

        return (strategyVault.collateralAmount, strategyVault.shortAmount);
=======
        uint256 ethToCrab = 5e18;
        uint256 totalEthToBull = 25e18;
        uint24 poolFee = 3000;

        vm.startPrank(user1);
        flashBull.flashDeposit{value: totalEthToBull}(totalEthToBull, ethToCrab, poolFee);
        vm.stopPrank();

        // assertEq(bullStrategy.balanceOf(user1), crabToDeposit);
        // assertEq(IEulerDToken(dToken).balanceOf(address(bullStrategy)), usdcToBorrow);
        // assertTrue(wethToLend.sub(IEulerEToken(eToken).balanceOfUnderlying(address(bullStrategy))) <= 1);
        // assertEq(IERC20(usdc).balanceOf(user1), usdcToBorrow);
>>>>>>> c7f1baf08dfd0df481a9fdc1b4a3972c43d1b2ad
    }
}
