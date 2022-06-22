// SPDX-License-Identifier: GPL-3.0-only

pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IEulerExec, IEulerDToken} from "../interfaces/IEuler.sol";
import {WETH9} from "../external/WETH9.sol";
import "hardhat/console.sol";

import {Address} from "@openzeppelin/contracts/utils/Address.sol";

// contract
import {CrabStrategyV2} from "./CrabStrategyV2.sol";
import {CrabStrategy} from "./CrabStrategy.sol";
import {StrategyMath} from "./base/StrategyMath.sol";

/**
 * Migration Error Codes:
 * M1: Not Owner
 * M2: Migration already happened
 * M3: Migration has not yet happened
 * M4: msg.sender is not Euler Mainnet Contract
 * M5: msg. sender cannot send ETH
 * M6: Can't withdraw more than you own
 */

/**
 * @dev CrabMigration contract
 * @notice Contract for Migrating from Crab v1 to Crab v2
 * @author Opyn team
 */
contract CrabMigration {
    using SafeERC20 for IERC20;
    using StrategyMath for uint256;
    using Address for address payable;

    mapping(address => uint256) public sharesDeposited;
    bool public isMigrated;
    CrabStrategy public crabV1;
    CrabStrategyV2 public crabV2;
    IEulerExec public euler;
    WETH9 weth;

    address public owner;
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
    }

    enum FLASH_SOURCE {
        BATCH_MIGRATE,
        FLASH_MIGRATE_V1_TO_V2,
        FLASH_BUY_AND_MIGRATE_V1_TO_V2
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "M1");
        _;
    }

    modifier beforeMigration() {
        require(!isMigrated, "M2");
        _;
    }

    modifier afterMigration() {
        require(isMigrated, "M3");
        _;
    }

    /**
     * @notice migration constructor
     * @param _crabV1 address of crab v1
     * @param _crabV2 address of crab v2
     */
    constructor(
        address payable _crabV1,
        address payable _crabV2,
        address _weth,
        address _eulerExec,
        address _dToken,
        address _eulerMainnet
    ) {
        crabV1 = CrabStrategy(_crabV1);
        crabV2 = CrabStrategyV2(_crabV2);
        euler = IEulerExec(_eulerExec);
        owner = msg.sender;
        EULER_MAINNET = _eulerMainnet;
        weth = WETH9(_weth);
        dToken = _dToken;
        wPowerPerp = crabV2.wPowerPerp();
    }

    /**
     * @notice allows users to deposit their crab v1 shares in the pool for migration
     */
    function depositV1Shares(uint256 amount) external beforeMigration {
        sharesDeposited[msg.sender] += amount;
        totalCrabV1SharesMigrated += amount;
        crabV1.transferFrom(msg.sender, address(this), amount);
    }

    /**
     * @notice the owner batch migrates all the crab v1 shares in this contract to crab v2 and initializes
     * the v2 contract at the same collateral ratio as the v1 contract.
     */
    function batchMigrate() external onlyOwner beforeMigration {
        // 1. update isMigrated
        isMigrated = true;
        console.log("Migrate called");

        // 2. flash floan eth from euler eq to amt
        uint256 crabV1Balance = crabV1.balanceOf(address(this));
        uint256 crabV1Supply = crabV1.totalSupply();
        (address _, uint256 id, uint256 totalCollateral, uint256 totalShort) = crabV1.getVaultDetails();
        uint256 amountEthToBorrow = totalCollateral.wmul(crabV1Balance.wdiv(crabV1Supply));
        bytes memory data;
        console.log("Flash loan going to call");
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
        console.log("Flash loan called");

        // 3. record totalV2Shares
        totalCrabV2SharesReceived = crabV2.balanceOf(address(this));
    }

    function onDeferredLiquidityCheck(bytes memory _encodedData) external {
        require(msg.sender == EULER_MAINNET, "M4");

        console.log("Going to decode data");
        FlashloanCallbackData memory data = abi.decode(_encodedData, (FlashloanCallbackData));
        console.log("Decoded");

        // 1. Borrow weth
        IEulerDToken(dToken).borrow(0, data.amountToBorrow);
        weth.withdraw(data.amountToBorrow);

        console.log("Calling callback");
        // 2. Callback
        _flashCallback(data.caller, data.amountToBorrow, data.callSource, data.callData);
        console.log("Callback done");

        // 3. Repay the weth:
        weth.deposit{value: data.amountToBorrow}();
        weth.approve(EULER_MAINNET, type(uint256).max);
        IEulerDToken(dToken).repay(0, data.amountToBorrow);
    }

    function _flashCallback(
        address _initiator,
        uint256 _amount,
        uint8 _callSource,
        bytes memory _calldata
    ) internal {
        if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.BATCH_MIGRATE) {
            // deferLiquidityCheck can be called by anyone
            require(_initiator == owner, "M1");

            uint256 crabV1Balance = crabV1.balanceOf(address(this));

            // 2. mint osqth in crab v2
            uint256 wSqueethToMint = crabV1.getWsqueethFromCrabAmount(crabV1Balance);
            crabV2.initialize{value: _amount}(wSqueethToMint);

            // 3. call withdraw from crab v1
            IERC20(wPowerPerp).approve(address(crabV1), type(uint256).max);
            crabV1.approve(address(crabV1), crabV1Balance);
            crabV1.withdraw(crabV1Balance);
        } else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_MIGRATE_V1_TO_V2) {
            FlashMigrateV1toV2 memory data = abi.decode(_calldata, (FlashMigrateV1toV2));
            crabV2.deposit{value: _amount}();
            IERC20(wPowerPerp).approve(address(crabV1), type(uint256).max);
            crabV1.withdraw(data.v1oSqthToPay);
            crabV2.flashDeposit{value: address(this).balance}(data.ethToFlashDeposit);

            // Sent back the excess ETH
            if (address(this).balance > 0) {
                payable(_initiator).sendValue(address(this).balance);
            }
        } else if (FLASH_SOURCE(_callSource) == FLASH_SOURCE.FLASH_BUY_AND_MIGRATE_V1_TO_V2) {
            FlashMigrateV1toV2 memory data = abi.decode(_calldata, (FlashMigrateV1toV2));

            crabV2.flashDeposit{value: _amount}(data.ethToFlashDeposit);
            IERC20(wPowerPerp).approve(address(crabV1), type(uint256).max);
            crabV1.withdraw(data.v1oSqthToPay);
        }
    }

    /**
     * @notice allows users to claim their amount of crab v2 shares
     */
    function claimV2Shares() external afterMigration {
        uint256 amountV1Deposited = sharesDeposited[msg.sender];
        sharesDeposited[msg.sender] = 0;
        uint256 crabV2TotalShares = crabV2.balanceOf(address(this));
        uint256 amountV2ToTransfer = (amountV1Deposited * totalCrabV2SharesReceived) / totalCrabV1SharesMigrated;
        crabV2.transfer(msg.sender, amountV2ToTransfer);
    }

    /**
     * @notice allows users to claim crabV2 shares and flash withdraw from crabV2
     *
     * @param _amountToWithdraw Amount of shares to withdraw
     * @param _maxEthToPay maximum ETH to pay to buy back the owed wSqueeth debt
     */
    function claimAndWithdraw(uint256 _amountToWithdraw, uint256 _maxEthToPay) external afterMigration {
        uint256 amountV1Deposited = sharesDeposited[msg.sender];
        require(_amountToWithdraw <= amountV1Deposited, "M6");

        sharesDeposited[msg.sender] = amountV1Deposited - _amountToWithdraw;
        uint256 crabV2TotalShares = crabV2.balanceOf(address(this));
        uint256 amountV2ToWithdraw = _amountToWithdraw.wmul(totalCrabV2SharesReceived).wdiv(totalCrabV1SharesMigrated);
        crabV2.flashWithdraw(amountV2ToWithdraw, _maxEthToPay);

        // Pay user's ETH back
        if (address(this).balance > 0) {
            payable(msg.sender).sendValue(address(this).balance);
        }

        // TODO: WE may need to add an event to track this in UI
    }

    function flashMigrationDetails(address _user) external view returns(bool, uint256, uint256) {
        return _flashMigrationDetails(_user);
    }

    /**
     * @param _ethInput - This will be eth to deposit for flash deposit if isFlashOnlyMigrate is true
     * It will be eth to attach if isFlashOnlyMigrate is false
     */
    function flashMigrateFromV1toV2(uint256 _ethToFlashDeposit, uint256 _ethToBorrow) external afterMigration {
        (bool isFlashOnlyMigrate, uint256 ethNeededForV2, uint256 v1oSqthToPay, uint256 ethToGetFromV1) = _flashMigrationDetails(msg.sender);

        // CR1 > CR2, Can mint more
        if (isFlashOnlyMigrate) {
            euler.deferLiquidityCheck(
                address(this),
                abi.encode(
                    FlashloanCallbackData({
                        caller: msg.sender,
                        amountToBorrow: ethNeededForV2,
                        callSource: uint8(FLASH_SOURCE.FLASH_MIGRATE_V1_TO_V2),
                        callData: abi.encode(FlashMigrateV1toV2({ v1oSqthToPay: v1oSqthToPay, ethToFlashDeposit: _ethToFlashDeposit }))
                    })
                )
            );
        } else { // CR2 > CR1, Need more ETH than we get from crab v1, So need to flash deposit
            euler.deferLiquidityCheck(
                address(this),
                abi.encode(
                    FlashloanCallbackData({
                        caller: msg.sender,
                        amountToBorrow: _ethToBorrow,
                        callSource: uint8(FLASH_SOURCE.FLASH_BUY_AND_MIGRATE_V1_TO_V2),
                        callData: abi.encode(FlashMigrateV1toV2({ v1oSqthToPay: v1oSqthToPay, ethToFlashDeposit: _ethToFlashDeposit }))
                    })
                )
            );
        }
    }

    function _flashMigrationDetails(address _user) internal view returns(bool, uint256, uint256, uint256) {
        uint256 v1Shares = crabV1.balanceOf(_user);
        uint256 v1TotalSupply = crabV1.totalSupply();
        (, , uint256 v1TotalCollateral, uint256 v1TotalShort) = crabV1.getVaultDetails();
        (, , uint256 v2TotalCollateral, uint256 v2TotalShort) = crabV2.getVaultDetails();
        uint256 v1oSqthToPay = v1Shares.wdiv(v1TotalSupply).wmul(v1TotalShort);
        uint256 ethNeededForV2 = v2TotalCollateral.wdiv(v2TotalShort).wmul(v1oSqthToPay);
        uint256 ethToGetFromV1 = v1Shares.wdiv(v1TotalSupply).wmul(v1TotalCollateral);
        bool isFlashOnlyMigrate = v1TotalCollateral.wdiv(v1TotalShort) > v2TotalCollateral.wdiv(v2TotalShort);

        return (isFlashOnlyMigrate, ethNeededForV2, v1oSqthToPay, ethToGetFromV1);
    }

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == address(weth) || msg.sender == address(crabV1) || msg.sender == address(crabV2), "M5");
    }
}
