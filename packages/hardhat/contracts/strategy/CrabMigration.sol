// SPDX-License-Identifier: GPL-3.0-only

pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IEulerExec, IDToken} from "../interfaces/IEuler.sol";
import {WETH9} from "../external/WETH9.sol";

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// contract
import {CrabStrategyV2} from "./CrabStrategyV2.sol";
import {CrabStrategy} from "./CrabStrategy.sol";
import {StrategyMath} from "./base/StrategyMath.sol";

/**
 * Migration Error Codes:
 * M1: Migration already happened
 * M2: Migration has not yet happened
 * M3: msg.sender is not Euler Mainnet Contract
 * M4: Can only receive ETH from weth, crabv1, or crabv2 contract
 * M5: Can't withdraw more than you own
 * M6: Not enough ETH to repay the loan
 * M7: Invalid crabV2 address
 * M8: _ethToBorrow or _withdrawMaxEthToPay can't be 0
 * M9: Wrong migration function, use flashMigrateAndWithdrawFromV1toV2
 * M10: Wrong migration function, use flashMigrateFromV1toV2
 * M11: crabV2 address not yet set
 */

/**
 * @dev CrabMigration contract
 * @notice Contract for Migrating from Crab V1 to Crab V2
 * @author Opyn team
 */
contract CrabMigration is Ownable {
    using SafeERC20 for IERC20;
    using StrategyMath for uint256;
    using Address for address payable;

    mapping(address => uint256) public sharesDeposited;
    bool public isMigrated;

    address payable public crabV1;
    address payable public crabV2;
    address public immutable euler;
    address public immutable weth;

    address immutable EULER_MAINNET;
    address immutable dToken;
    address immutable wPowerPerp;

    struct FlashloanCallbackData {
        address caller;
        uint256 amountToBorrow;
        uint8 callSource;
        bytes callData;
    }

    struct BatchMigrate {
        uint256 strategyCap;
    }

    struct FlashMigrateV1toV2 {
        uint256 v1oSqthToPay;
        uint256 ethToFlashDeposit;
        uint256 crabV1ToWithdraw;
        uint24 poolFee;
    }

    struct FlashMigrateAndBuyV1toV2 {
        uint256 v1oSqthToPay;
        uint256 ethToFlashDeposit;
        uint256 withdrawMaxEthToPay;
        uint256 crabV1ToWithdraw;
        uint24 poolFeeFlashDeposit;
    }

    enum FLASH_SOURCE {
        BATCH_MIGRATE,
        FLASH_MIGRATE_V1_TO_V2,
        FLASH_MIGRATE_WITHDRAW_V1_TO_V2
    }

    event ClaimAndWithdraw(address indexed user, uint256 crabAmount);
    event DepositV1Shares(address indexed user, uint256 crabV1Amount);
    event ClaimV2Shares(address indexed user, uint256 crabAmount);
    event FlashMigrate(address indexed user, uint256 crabV1Amount, uint256 crabV2Amount, uint256 excessEth);

    event WithdrawV1Shares(address indexed user, uint256 crabV1Amount);

    modifier beforeMigration() {
        require(!isMigrated, "M1");
        _;
    }

    modifier afterMigration() {
        require(isMigrated, "M2");
        _;
    }

    modifier afterInitialized() {
        require(crabV2 != address(0), "M11");
        _;
    }

    /**
     * @notice migration constructor
     * @param _crabV1 address of crab V1
     * @param _weth address of weth
     * @param _eulerExec address of euler exec contract
     * @param _dToken address of euler liability token
     * @param _eulerMainnet address of euler deployment on mainnet
     */
    constructor(
        address payable _crabV1,
        address _weth,
        address _eulerExec,
        address _dToken,
        address _eulerMainnet
    ) {
        require(_eulerExec != address(0), "invalid _eulerExec address");
        require(_dToken != address(0), "invalid _dToken address");
        require(_eulerMainnet != address(0), "invalid _eulerMainnet address");
        require(_weth != address(0), "invalid _weth address");
        require(_crabV1 != address(0), "invalid _crabv1 address");
        require(IDToken(_dToken).underlyingAsset() == _weth, "dToken underlying asset should be weth");

        crabV1 = _crabV1;
        euler = _eulerExec;
        EULER_MAINNET = _eulerMainnet;
        weth = _weth;
        dToken = _dToken;
        wPowerPerp = CrabStrategy(crabV1).wPowerPerp();
        WETH9(_weth).approve(_eulerMainnet, type(uint256).max);
    }

    /**
     * @notice set the crabV2 address
     * @param _crabV2 address of crab V2
     */
    function setCrabV2(address payable _crabV2) external onlyOwner {
        require(_crabV2 != address(0), "M7");
        crabV2 = _crabV2;
    }

    /**
     * @notice deposit crab V1 shares in the pool for migration
     * @param _amount amount of crabV1 shares to deposit
     */
    function depositV1Shares(uint256 _amount) external beforeMigration {
        sharesDeposited[msg.sender] += _amount;

        CrabStrategy(crabV1).transferFrom(msg.sender, address(this), _amount);

        emit DepositV1Shares(msg.sender, _amount);
    }

    /**
     * @notice withdraw crab V1 shares in the pool before migration
     * @param _amount amount of V1 shares to withdraw
     */
    function withdrawV1Shares(uint256 _amount) external beforeMigration {
        sharesDeposited[msg.sender] = sharesDeposited[msg.sender].sub(_amount);
        CrabStrategy(crabV1).transfer(msg.sender, _amount);

        emit WithdrawV1Shares(msg.sender, _amount);
    }

    /**
     * @notice the owner batch migrates all the crab V1 shares in this contract to crab V2 and initializes
     * the V2 contract at the same collateral ratio as the V1 contract
     * @param _strategyCap strategy cap in ETH
     */
    function batchMigrate(uint256 _strategyCap) external onlyOwner afterInitialized beforeMigration {
        // 1. update isMigrated
        isMigrated = true;

        // 2. flash floan eth from euler eq to amt
        uint256 crabV1Balance = CrabStrategy(crabV1).balanceOf(address(this));
        uint256 crabV1Supply = CrabStrategy(crabV1).totalSupply();
        (, , uint256 totalCollateral, ) = CrabStrategy(crabV1).getVaultDetails();
        uint256 amountEthToBorrow = totalCollateral.wmul(crabV1Balance.wdiv(crabV1Supply));
        IEulerExec(euler).deferLiquidityCheck(
            address(this),
            abi.encode(
                FlashloanCallbackData({
                    caller: msg.sender,
                    amountToBorrow: amountEthToBorrow,
                    callSource: uint8(FLASH_SOURCE.BATCH_MIGRATE),
                    callData: abi.encode(BatchMigrate({strategyCap: _strategyCap}))
                })
            )
        );
    }

    /**
     * @notice Euler callback function
     * @param encodedData callback data
     */
    function onDeferredLiquidityCheck(bytes memory encodedData) external afterInitialized {
        require(msg.sender == EULER_MAINNET, "M3");

        FlashloanCallbackData memory data = abi.decode(encodedData, (FlashloanCallbackData));

        // 1. borrow weth
        IDToken(dToken).borrow(0, data.amountToBorrow);
        WETH9(weth).withdraw(data.amountToBorrow);

        // 2. callback
        _flashCallback(data.caller, data.amountToBorrow, data.callSource, data.callData);

        // 3. repay the weth
        WETH9(weth).deposit{value: data.amountToBorrow}();
        IDToken(dToken).repay(0, data.amountToBorrow);
    }

    /**
     * @notice callback function for flash actions
     * @param _initiator address of original function caller
     * @param _amount  amount to pay back for flashswap
     * @param _callSource identifier for which function triggered callback
     * @param _calldata arbitrary data attached to callback

     */
    function _flashCallback(
        address _initiator,
        uint256 _amount,
        uint8 _callSource,
        bytes memory _calldata
    ) internal {
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.BATCH_MIGRATE) {
            BatchMigrate memory data = abi.decode(_calldata, (BatchMigrate));

            uint256 crabV1Balance = CrabStrategy(crabV1).balanceOf(address(this));

            // 2. mint osqth in crab V2
            uint256 wSqueethToMint = CrabStrategy(crabV1).getWsqueethFromCrabAmount(crabV1Balance);
            uint256 timeAtLastHedge = CrabStrategy(crabV1).timeAtLastHedge();
            uint256 priceAtLastHedge = CrabStrategy(crabV1).priceAtLastHedge();
            CrabStrategyV2(crabV2).initialize{value: _amount}(
                wSqueethToMint,
                crabV1Balance,
                timeAtLastHedge,
                priceAtLastHedge,
                data.strategyCap
            );

            // 3. call withdraw from crab V1
            IERC20(wPowerPerp).approve(crabV1, type(uint256).max);
            CrabStrategy(crabV1).withdraw(crabV1Balance);
        } else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_MIGRATE_V1_TO_V2) {
            uint256 initialCrabAmount = CrabStrategyV2(crabV2).balanceOf(address(this));
            FlashMigrateV1toV2 memory data = abi.decode(_calldata, (FlashMigrateV1toV2));

            CrabStrategyV2(crabV2).deposit{value: _amount}();

            CrabStrategy(crabV1).transferFrom(_initiator, address(this), data.crabV1ToWithdraw);

            IERC20(wPowerPerp).approve(crabV1, data.v1oSqthToPay);
            CrabStrategy(crabV1).withdraw(data.crabV1ToWithdraw);

            // flash deposit remaining ETH, otherwise refund
            // if CR1 = CR2 ethToFlashDeposit should be 0
            if (data.ethToFlashDeposit > 0) {
                CrabStrategyV2(crabV2).flashDeposit{value: address(this).balance.sub(_amount)}(
                    data.ethToFlashDeposit,
                    data.poolFee
                );
            }

            uint256 crabV2ToTransfer = CrabStrategyV2(crabV2).balanceOf(address(this)).sub(initialCrabAmount);
            // send back V2 tokens to the user
            CrabStrategyV2(crabV2).transfer(_initiator, crabV2ToTransfer);
            IERC20(wPowerPerp).transfer(_initiator, IERC20(wPowerPerp).balanceOf(address(this)));

            uint256 excessEth = address(this).balance;

            emit FlashMigrate(_initiator, data.crabV1ToWithdraw, crabV2ToTransfer, excessEth.sub(_amount));

            // send back excess ETH
            if (excessEth > _amount) {
                payable(_initiator).sendValue(excessEth.sub(_amount));
            }
        } else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_MIGRATE_WITHDRAW_V1_TO_V2) {
            uint256 initialCrabAmount = CrabStrategyV2(crabV2).balanceOf(address(this));
            FlashMigrateAndBuyV1toV2 memory data = abi.decode(_calldata, (FlashMigrateAndBuyV1toV2));
            (, , , uint256 v1Short) = CrabStrategy(crabV1).getVaultDetails();

            CrabStrategy(crabV1).transferFrom(_initiator, address(this), data.crabV1ToWithdraw);
            CrabStrategyV2(crabV2).deposit{value: _amount}();

            uint256 oSqthToPay = IERC20(wPowerPerp).balanceOf(address(this));
            IERC20(wPowerPerp).approve(crabV1, oSqthToPay);

            // find crab amount for contract's sqth balance
            // remaining crab can be withdrawn using flash withdraw
            uint256 crabV1ToWithdrawRmul = oSqthToPay.wmul(CrabStrategy(crabV1).totalSupply()).rdiv(v1Short);
            uint256 crabV1ToWithdraw = crabV1ToWithdrawRmul.floor(10**9) / (10**9);

            CrabStrategy(crabV1).withdraw(crabV1ToWithdraw);

            CrabStrategy(crabV1).flashWithdraw(data.crabV1ToWithdraw.sub(crabV1ToWithdraw), data.withdrawMaxEthToPay);
            require(address(this).balance >= _amount, "M6");

            if (data.ethToFlashDeposit > 0) {
                CrabStrategyV2(crabV2).flashDeposit{value: address(this).balance.sub(_amount)}(
                    data.ethToFlashDeposit,
                    data.poolFeeFlashDeposit
                );
            }

            uint256 crabV2ToTransfer = CrabStrategyV2(crabV2).balanceOf(address(this)).sub(initialCrabAmount);

            // send V2 tokens to the user
            CrabStrategyV2(crabV2).transfer(_initiator, crabV2ToTransfer);
            IERC20(wPowerPerp).transfer(_initiator, IERC20(wPowerPerp).balanceOf(address(this)));

            uint256 excessEth = address(this).balance;

            emit FlashMigrate(_initiator, data.crabV1ToWithdraw, crabV2ToTransfer, excessEth.sub(_amount));

            // send back the excess ETH
            if (excessEth > _amount) {
                payable(_initiator).sendValue(excessEth.sub(_amount));
            }
        }
    }

    /**
     * @notice claim crab V2 shares
     */
    function claimV2Shares() external afterMigration {
        uint256 amountV1Deposited = sharesDeposited[msg.sender];
        sharesDeposited[msg.sender] = 0;
        CrabStrategyV2(crabV2).transfer(msg.sender, amountV1Deposited);
        emit ClaimV2Shares(msg.sender, amountV1Deposited);
    }

    /**
     * @notice claim crab V2 shares and flash withdraw from crab V2
     * @param _amountToWithdraw V2 shares to claim
     * @param _maxEthToPay maximum ETH to pay to buy back the owed wSqueeth debt
     * @param _poolFee Uniswap pool fee for flash withdraw
     */
    function claimAndWithdraw(
        uint256 _amountToWithdraw,
        uint256 _maxEthToPay,
        uint24 _poolFee
    ) external afterMigration {
        uint256 amountV1Deposited = sharesDeposited[msg.sender];
        require(_amountToWithdraw <= amountV1Deposited, "M5");

        sharesDeposited[msg.sender] = amountV1Deposited.sub(_amountToWithdraw);
        CrabStrategyV2(crabV2).flashWithdraw(_amountToWithdraw, _maxEthToPay, _poolFee);

        emit ClaimAndWithdraw(msg.sender, _amountToWithdraw);

        // send eth to user
        payable(msg.sender).sendValue(address(this).balance);
    }

    /**
     * @notice view details of flash migration for specified amount of V1 shares
     * @param _v1Shares amount of crab V1 shares
     */
    function flashMigrationDetails(uint256 _v1Shares)
        external
        view
        returns (
            bool,
            uint256,
            uint256,
            uint256
        )
    {
        return _flashMigrationDetails(_v1Shares);
    }

    /**
     * @notice used to migrate from crab V1 to crab V2 when CR1 >= CR2
     * @param _v1Shares V1 shares to migrate
     * @param _ethToFlashDeposit flash deposit amount in crab v2 with excess ETH (if 0 will return to sender)
     * @param _poolFee uniswap pool fee for flash deposit
     */
    function flashMigrateFromV1toV2(
        uint256 _v1Shares,
        uint256 _ethToFlashDeposit,
        uint24 _poolFee
    ) external afterMigration {
        (bool isFlashOnlyMigrate, uint256 ethNeededForV2, uint256 v1oSqthToPay, ) = _flashMigrationDetails(_v1Shares);

        require(isFlashOnlyMigrate, "M9");

        IEulerExec(euler).deferLiquidityCheck(
            address(this),
            abi.encode(
                FlashloanCallbackData({
                    caller: msg.sender,
                    amountToBorrow: ethNeededForV2,
                    callSource: uint8(FLASH_SOURCE.FLASH_MIGRATE_V1_TO_V2),
                    callData: abi.encode(
                        FlashMigrateV1toV2({
                            v1oSqthToPay: v1oSqthToPay,
                            ethToFlashDeposit: _ethToFlashDeposit,
                            crabV1ToWithdraw: _v1Shares,
                            poolFee: _poolFee
                        })
                    )
                })
            )
        );
    }

    /**
     * @notice used to migrate from crab V1 to crab V2 when CR1 < CR2
     * @param _v1Shares V1 shares to migrate
     * @param _ethToFlashDeposit flash deposit amount in crab v2 with excess ETH (if 0 will returned to sender)
     * @param _ethToBorrow amount to flash loan to deposit in crab v2
     * @param _withdrawMaxEthToPay maximum ETH to pay to buy back the owed wSqueeth debt
     * @param _poolFee uniswap pool fee for the optional flash deposit into crab v2
     */
    function flashMigrateAndWithdrawFromV1toV2(
        uint256 _v1Shares,
        uint256 _ethToFlashDeposit,
        uint256 _ethToBorrow,
        uint256 _withdrawMaxEthToPay,
        uint24 _poolFee
    ) external afterMigration {
        (bool isFlashOnlyMigrate, , uint256 v1oSqthToPay, ) = _flashMigrationDetails(_v1Shares);

        require(!isFlashOnlyMigrate, "M10");
        require(_ethToBorrow > 0 && _withdrawMaxEthToPay > 0, "M8");

        IEulerExec(euler).deferLiquidityCheck(
            address(this),
            abi.encode(
                FlashloanCallbackData({
                    caller: msg.sender,
                    amountToBorrow: _ethToBorrow,
                    callSource: uint8(FLASH_SOURCE.FLASH_MIGRATE_WITHDRAW_V1_TO_V2),
                    callData: abi.encode(
                        FlashMigrateAndBuyV1toV2({
                            withdrawMaxEthToPay: _withdrawMaxEthToPay,
                            ethToFlashDeposit: _ethToFlashDeposit,
                            v1oSqthToPay: v1oSqthToPay,
                            crabV1ToWithdraw: _v1Shares,
                            poolFeeFlashDeposit: _poolFee
                        })
                    )
                })
            )
        );
    }

    /**
     * @notice get migration details for given amount of V1 shares
     * @param _v1Shares amount of crab V1 shares
     */
    function _flashMigrationDetails(uint256 _v1Shares)
        internal
        view
        returns (
            bool,
            uint256,
            uint256,
            uint256
        )
    {
        (, , uint256 v1TotalCollateral, uint256 v1TotalShort) = CrabStrategy(crabV1).getVaultDetails();
        (, , uint256 v2TotalCollateral, uint256 v2TotalShort) = CrabStrategyV2(crabV2).getVaultDetails();

        uint256 v1oSqthToPay = v1TotalShort.wmul(_v1Shares).wdiv(CrabStrategy(crabV1).totalSupply());
        uint256 ethNeededForV2 = v1oSqthToPay.wmul(v2TotalCollateral).rdiv(v2TotalShort).ceil(10**9) / (10**9);
        uint256 ethToGetFromV1 = _v1Shares.wdiv(CrabStrategy(crabV1).totalSupply()).wmul(v1TotalCollateral);

        return (ethNeededForV2 <= ethToGetFromV1, ethNeededForV2, v1oSqthToPay, ethToGetFromV1);
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == weth || msg.sender == crabV1 || msg.sender == crabV2, "M4");
    }
}
