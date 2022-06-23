// SPDX-License-Identifier: GPL-3.0-only

pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IEulerExec, IEulerDToken} from "../interfaces/IEuler.sol";
import {WETH9} from "../external/WETH9.sol";

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
 */

/**
 * @dev CrabMigration contract
 * @notice Contract for Migrating from Crab v1 to Crab v2
 * @author Opyn team
 */
contract CrabMigration {
    using SafeERC20 for IERC20;
    using StrategyMath for uint256;

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

        // 2. flash floan eth from euler eq to amt
        bytes memory data;
        euler.deferLiquidityCheck(address(this), data);

        // 3. record totalV2Shares
        totalCrabV2SharesReceived = crabV2.balanceOf(address(this));
    }

    function onDeferredLiquidityCheck(bytes memory encodedData) external {
        require(msg.sender == EULER_MAINNET, "M4");

        // 1. Borrow weth
        uint256 crabV1Balance = crabV1.balanceOf(address(this));
        uint256 crabV1Supply = crabV1.totalSupply();
        (address _, uint256 id, uint256 totalCollateral, uint256 totalShort) = crabV1.getVaultDetails();
        uint256 amountEthToBorrow = totalCollateral.wmul(crabV1Balance.wdiv(crabV1Supply));

        IEulerDToken(dToken).borrow(0, amountEthToBorrow);
        weth.withdraw(amountEthToBorrow);

        // 2. mint osqth in crab v2
        uint256 wSqueethToMint = crabV1.getWsqueethFromCrabAmount(crabV1Balance);
        uint256 timeAtLastHedge = crabV1.timeAtLastHedge();
        uint256 priceAtLastHedge = crabV1.priceAtLastHedge();
        crabV2.initialize{value: amountEthToBorrow}(wSqueethToMint, totalCrabV1SharesMigrated, timeAtLastHedge, priceAtLastHedge);

        // 3. call withdraw from crab v1
        IERC20(wPowerPerp).approve(address(crabV1), type(uint256).max);
        crabV1.approve(address(crabV1), crabV1Balance);
        crabV1.withdraw(crabV1Balance);

        // 4. Repay the weth:
        weth.deposit{value: amountEthToBorrow}();
        weth.approve(EULER_MAINNET, type(uint256).max);
        IEulerDToken(dToken).repay(0, amountEthToBorrow);
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
     */
    function claimAndWithdraw() external afterMigration {}

    /**
     * @notice receive function to allow ETH transfer to this contract
     */
    receive() external payable {
        require(msg.sender == address(weth) || msg.sender == address(crabV1), "M5");
    }
}
