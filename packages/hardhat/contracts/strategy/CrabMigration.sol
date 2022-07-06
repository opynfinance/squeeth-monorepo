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
 * M1: Crab V2 Address already set
 * M2: Migration already happened
 * M3: Migration has not yet happened
 * M4: msg.sender is not Euler Mainnet Contract
 * M5: msg. sender cannot send ETH
 * M6: Can't withdraw more than you own
 * M7: Not enough ETH to repay the loan
 * M8: _ethToBorrow or _withdrawMaxEthToPay can't be 0
 * M9: Invalid crabV2 address
 * M10: Crab V2 address not yet set
 * M11: Wrong migration function, use flashMigrateAndWithdrawFromV1toV2
 * M12: Wrong migration function, use flashMigrateFromV1toV2
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
    CrabStrategy public crabV1;
    CrabStrategyV2 public crabV2;
    IEulerExec public euler;
    WETH9 weth;

    uint256 public totalCrabV1SharesMigrated;
    uint256 public totalCrabV2SharesReceived;
    address immutable EULER_MAINNET;
    address immutable dToken;
    address immutable wPowerPerp;

    struct FlashloanCallbackData {
        address caller;
        uint256 amountToBorrow;
        uint8 callSource;
        bytes callData;
    }

    struct FlashMigrateV1toV2 {
        uint256 v1oSqthToPay;
        uint256 ethToFlashDeposit;
        uint256 crabV1ToWithdraw;
    }

    struct FlashMigrateAndBuyV1toV2 {
        uint256 v1oSqthToPay;
        uint256 ethToFlashDeposit;
        uint256 withdrawMaxEthToPay;
        uint256 crabV1ToWithdraw;
    }

    enum FLASH_SOURCE {
        BATCH_MIGRATE,
        FLASH_MIGRATE_V1_TO_V2,
        FLASH_MIGRATE_WITHDRAW_V1_TO_V2
    }

    event ClaimAndWithdraw(address indexed user, uint256 crabAmount);

    modifier beforeMigration() {
        require(!isMigrated, "M2");
        _;
    }

    modifier afterMigration() {
        require(isMigrated, "M3");
        _;
    }

    modifier afterInitialized() {
        require(address(crabV2) != address(0), "M8");
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
        crabV1 = CrabStrategy(_crabV1);
        euler = IEulerExec(_eulerExec);
        EULER_MAINNET = _eulerMainnet;
        weth = WETH9(_weth);
        dToken = _dToken;
        wPowerPerp = crabV1.wPowerPerp();
    }

    /**
     * @notice set the crabV2 address
     * @param _crabV2 address of crab V2
     */
    function setCrabV2(address payable _crabV2) external onlyOwner {
        require(address(crabV2) == address(0), "M1");
        require(_crabV2 != address(0), "M9");
        crabV2 = CrabStrategyV2(_crabV2);
    }

    /**
     * @notice allows users to deposit their crab V1 shares in the pool for migration
     * @param _amount amount of crab V1 shares to deposit
     */
    function depositV1Shares(uint256 _amount) external afterInitialized beforeMigration {
        sharesDeposited[msg.sender] = sharesDeposited[msg.sender].add(_amount);
        totalCrabV1SharesMigrated = totalCrabV1SharesMigrated.add(_amount);
        crabV1.transferFrom(msg.sender, address(this), _amount);
    }

    /**
     * @notice the owner batch migrates all the crab V1 shares in this contract to crab V2 and initializes
     * the V2 contract at the same collateral ratio as the V1 contract.
     */
    function batchMigrate() external onlyOwner afterInitialized beforeMigration {
        // 1. update isMigrated
        isMigrated = true;

        // 2. flash floan eth from euler eq to amt
        uint256 crabV1Balance = crabV1.balanceOf(address(this));
        uint256 crabV1Supply = crabV1.totalSupply();
        (, , uint256 totalCollateral, ) = crabV1.getVaultDetails();
        uint256 amountEthToBorrow = totalCollateral.wmul(crabV1Balance.wdiv(crabV1Supply));
        bytes memory data;
        euler.deferLiquidityCheck(
            address(this),
            abi.encode(
                FlashloanCallbackData({
                    caller: msg.sender,
                    amountToBorrow: amountEthToBorrow,
                    callSource: uint8(FLASH_SOURCE.BATCH_MIGRATE),
                    callData: data
                })
            )
        );

        // 3. record totalV2Shares
        totalCrabV2SharesReceived = crabV2.balanceOf(address(this));
    }

    function onDeferredLiquidityCheck(bytes memory encodedData) external afterInitialized {
        require(msg.sender == EULER_MAINNET, "M4");

        FlashloanCallbackData memory data = abi.decode(encodedData, (FlashloanCallbackData));

        // 1. borrow weth
        IDToken(dToken).borrow(0, data.amountToBorrow);
        weth.withdraw(data.amountToBorrow);

        // 2. callback
        _flashCallback(data.caller, data.amountToBorrow, data.callSource, data.callData);

        // 4. repay the weth
        weth.deposit{value: data.amountToBorrow}();
        weth.approve(EULER_MAINNET, type(uint256).max);
        IDToken(dToken).repay(0, data.amountToBorrow);
    }

    function _flashCallback(
        address _initiator,
        uint256 _amount,
        uint8 _callSource,
        bytes memory _calldata
    ) internal {
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.BATCH_MIGRATE) {
            uint256 crabV1Balance = crabV1.balanceOf(address(this));

            // 2. mint osqth in crab V2
            uint256 wSqueethToMint = crabV1.getWsqueethFromCrabAmount(crabV1Balance);
            uint256 timeAtLastHedge = crabV1.timeAtLastHedge();
            uint256 priceAtLastHedge = crabV1.priceAtLastHedge();
            crabV2.initialize{value: _amount}(
                wSqueethToMint,
                totalCrabV1SharesMigrated,
                timeAtLastHedge,
                priceAtLastHedge
            );

            // 3. call withdraw from crab V1
            IERC20(wPowerPerp).approve(address(crabV1), type(uint256).max);
            crabV1.approve(address(crabV1), crabV1Balance);
            crabV1.withdraw(crabV1Balance);
        } else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_MIGRATE_V1_TO_V2) {
            FlashMigrateV1toV2 memory data = abi.decode(_calldata, (FlashMigrateV1toV2));

            crabV2.deposit{value: _amount}();

            crabV1.transferFrom(_initiator, address(this), data.crabV1ToWithdraw);

            IERC20(wPowerPerp).approve(address(crabV1), data.v1oSqthToPay);
            crabV1.withdraw(data.crabV1ToWithdraw);

            // flash deposit remaining ETH, if user said so. Else return back the ETH. If CR1 = CR2 ethToFlashDeposit should be 0
            if (data.ethToFlashDeposit > 0) {
                crabV2.flashDeposit{value: address(this).balance.sub(_amount)}(data.ethToFlashDeposit);
            }

            // sent back the V2 tokens to the user
            crabV2.transfer(_initiator, crabV2.balanceOf(address(this)));
            IERC20(wPowerPerp).transfer(_initiator, IERC20(wPowerPerp).balanceOf(address(this)));

            // sent back the excess ETH
            if (address(this).balance > _amount) {
                payable(_initiator).sendValue(address(this).balance.sub(_amount));
            }
        } else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_MIGRATE_WITHDRAW_V1_TO_V2) {
            FlashMigrateAndBuyV1toV2 memory data = abi.decode(_calldata, (FlashMigrateAndBuyV1toV2));
            (, , , uint256 v1Short) = crabV1.getVaultDetails();

            crabV1.transferFrom(_initiator, address(this), data.crabV1ToWithdraw);
            crabV2.deposit{value: _amount}();

            uint256 oSqthToPay = IERC20(wPowerPerp).balanceOf(address(this));
            IERC20(wPowerPerp).approve(address(crabV1), oSqthToPay);

            // find crab amount for contract's sqth balance. Remaining crab sould be withdrawn using flash withdraw
            uint256 crabV1ToWithdrawRmul = oSqthToPay.wmul(crabV1.totalSupply()).rdiv(v1Short);
            uint256 crabV1ToWithdraw = crabV1ToWithdrawRmul.floor(10**9) / (10**9);

            crabV1.withdraw(crabV1ToWithdraw);

            crabV1.flashWithdraw(data.crabV1ToWithdraw.sub(crabV1ToWithdraw), data.withdrawMaxEthToPay);
            require(address(this).balance >= _amount, "M7");

            if (data.ethToFlashDeposit > 0) {
                crabV2.flashDeposit{value: address(this).balance.sub(_amount)}(data.ethToFlashDeposit);
            }

            // sent back the V2 tokens to the user
            crabV2.transfer(_initiator, crabV2.balanceOf(address(this)));
            IERC20(wPowerPerp).transfer(_initiator, IERC20(wPowerPerp).balanceOf(address(this)));

            // sent back the excess ETH
            if (address(this).balance > _amount) {
                payable(_initiator).sendValue(address(this).balance.sub(_amount));
            }
        }
    }

    /**
     * @notice allows users to claim their amount of crab V2 shares
     */
    function claimV2Shares() external afterMigration {
        uint256 amountV1Deposited = sharesDeposited[msg.sender];
        sharesDeposited[msg.sender] = 0;
        uint256 amountV2ToTransfer = amountV1Deposited.wmul(totalCrabV2SharesReceived).wdiv(totalCrabV1SharesMigrated);
        crabV2.transfer(msg.sender, amountV2ToTransfer);
    }

    /**
     * @notice allows users to claim crabV2 shares and flash withdraw from crabV2
     * @param _amountToWithdraw V2 shares to claim
     * @param _maxEthToPay maximum ETH to pay to buy back the owed wSqueeth debt
     */
    function claimAndWithdraw(uint256 _amountToWithdraw, uint256 _maxEthToPay) external afterMigration {
        uint256 amountV1toClaim = _getV1SharesForV2Share(_amountToWithdraw);
        uint256 amountV1Deposited = sharesDeposited[msg.sender];
        require(amountV1toClaim <= amountV1Deposited, "M6");

        sharesDeposited[msg.sender] = amountV1Deposited.sub(amountV1toClaim);
        crabV2.flashWithdraw(_amountToWithdraw, _maxEthToPay);

        emit ClaimAndWithdraw(msg.sender, _amountToWithdraw);

        // Pay user's ETH back
        payable(msg.sender).sendValue(address(this).balance);
    }

    /**
     * @notice for input V2 shares returns the equivalent V1 shares
     * @param _amountV2 amount of V2 shares
     * @return amount of V1 shares to recieve for specified V2 shares
     */
    function _getV1SharesForV2Share(uint256 _amountV2) internal view returns (uint256) {
        return _amountV2.wmul(totalCrabV1SharesMigrated).wdiv(totalCrabV2SharesReceived);
    }

    /**
     * @notice view details for flash migration of V1 shares
     * @param _v1Shares amount of V1 shares
     * @return bool for eth needed for V2 <= eth received from V1
     * @return eth needed for V2
     * @return wPowerPerp to pay to close V1
     * @return eth to receive from V1
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
     * @param _ethToFlashDeposit flash deposit amount in crab V2 with excess ETH. If 0 will returned to sender
     */
    function flashMigrateFromV1toV2(uint256 _v1Shares, uint256 _ethToFlashDeposit) external afterMigration {
        (bool isFlashOnlyMigrate, uint256 ethNeededForV2, uint256 v1oSqthToPay, ) = _flashMigrationDetails(_v1Shares);

        require(isFlashOnlyMigrate, "M11");

        euler.deferLiquidityCheck(
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
                            crabV1ToWithdraw: _v1Shares
                        })
                    )
                })
            )
        );
    }

    /**
     * @notice used to migrate from crab V1 to crab V2 when CR1 < CR2
     *
     * @param _v1Shares V1 shares to migrate
     * @param _ethToFlashDeposit flash deposit amount in crab V2 with excess ETH. If 0 will returned to sender
     * @param _ethToBorrow amount to flash loan to deposit in crab V2
     * @param _withdrawMaxEthToPay maximum ETH to pay to buy back the owed wSqueeth debt
     */
    function flashMigrateAndWithdrawFromV1toV2(
        uint256 _v1Shares,
        uint256 _ethToFlashDeposit,
        uint256 _ethToBorrow,
        uint256 _withdrawMaxEthToPay
    ) external afterMigration {
        (bool isFlashOnlyMigrate, , uint256 v1oSqthToPay, ) = _flashMigrationDetails(_v1Shares);

        require(!isFlashOnlyMigrate, "M12");
        require(_ethToBorrow > 0 && _withdrawMaxEthToPay > 0, "M8");

        euler.deferLiquidityCheck(
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
                            crabV1ToWithdraw: _v1Shares
                        })
                    )
                })
            )
        );
    }

    /**
     * @notice get migration details for given amount of V1 shares
     * @return bool for eth needed for V2 <= eth received from V1
     * @return eth needed for V2
     * @return wPowerPerp to pay to close V1
     * @return eth to receive from V1
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
        (, , uint256 v1TotalCollateral, uint256 v1TotalShort) = crabV1.getVaultDetails();
        (, , uint256 v2TotalCollateral, uint256 v2TotalShort) = crabV2.getVaultDetails();

        uint256 v1oSqthToPay = v1TotalShort.wmul(_v1Shares).wdiv(crabV1.totalSupply());
        uint256 ethNeededForV2 = v1oSqthToPay.wmul(v2TotalCollateral).rdiv(v2TotalShort).ceil(10**9) / (10**9);
        uint256 ethToGetFromV1 = _v1Shares.wdiv(crabV1.totalSupply()).wmul(v1TotalCollateral);

        return (ethNeededForV2 <= ethToGetFromV1, ethNeededForV2, v1oSqthToPay, ethToGetFromV1);
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == address(weth) || msg.sender == address(crabV1) || msg.sender == address(crabV2), "M5");
    }
}
