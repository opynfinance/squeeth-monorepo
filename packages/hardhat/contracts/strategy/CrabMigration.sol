// SPDX-License-Identifier: GPL-3.0-only

pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IEuler, IEulerDToken} from "../interfaces/IEuler.sol";

// contract
import {CrabStrategyV2} from "./CrabStrategyV2.sol";
import {CrabStrategy} from "./CrabStrategy.sol";

/** 
 * Migration Error Codes:
 * M1: Not Owner
 * M2: Migration already happened
 * M3: Migration has not yet happened
 * M4: msg.sender is not Euler
 */


/**
 * @dev CrabMigration contract
 * @notice Contract for Migrating from Crab v1 to Crab v2
 * @author Opyn team
 */
 contract CrabMigration { 

     using SafeERC20 for IERC20;

     mapping (address => uint256) public sharesDeposited; 
     bool public isMigrated;
     address public owner;
     CrabStrategy public crabV1;
     CrabStrategyV2 public crabV2; 
     IEuler public euler; 
     // TODO: figure out what is this address 
     address immutable EULER_MAINNET;
     address immutable dToken; 
     address immutable weth; 
     
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
     constructor (address payable _crabV1, address payable _crabV2, address _euler, address _weth, address _dToken) { 
         crabV1 = CrabStrategy(_crabV1);
         crabV2 = CrabStrategyV2 (_crabV2);
         euler = IEuler(_euler);
         owner = msg.sender;
         EULER_MAINNET = _euler;
         weth = _weth;
         dToken = _dToken; 
     }


    

     /** 
     * @notice allows users to deposit their crab v1 shares in the pool for migration
     */
     function depositV1Shares(uint256 amount) external beforeMigration { 
         sharesDeposited[msg.sender] = amount;
         crabV1.transferFrom(msg.sender, address(this), amount);

     }

     /**
      * @notice the owner batch migrates all the crab v1 shares in this contract to crab v2 and initializes 
      * the v2 contract at the same collateral ratio as the v1 contract. 
      */
     function batchMigrate() external onlyOwner beforeMigration { 
         // 1. flash floan eth from euler eq to amt 
        bytes memory data;

        euler.deferLiquidityCheck(address(this), data);

     }

     function onDeferredLiquidityCheck(bytes memory encodedData) external {

         require(msg.sender == address(euler), "M4");
        // Borrow 10 tokens (assuming 18 decimals):
        uint256 crabV1Balance = crabV1.balanceOf(address(this));
        uint256 crabV1Supply = crabV1.supply();
        (address _, uint256 id, uint256 totalCollateral, uint256 totalShort) = crabV1.getVaultDetails();
        uint256 amountEthToBorrow = crabV1Balance * totalCollateral / crabV1Supply;

        IEulerDToken(dToken).borrow(0, amountEthToBorrow);

        // ... do whatever you need with the borrowed tokens ...
        // 2. mint osqth in crab v2 
        // 3. call withdraw from crab v1

        // Repay the 10 tokens:

        IERC20(weth).approve(EULER_MAINNET, type(uint).max);
        IEulerDToken(dToken).repay(0, amountEthToBorrow);
    }

     /**
      * @notice allows users to claim their amount of crab v2 shares
      */
     function claimV2Shares() external afterMigration { 
         uint256 amount = sharesDeposited[msg.sender];
         sharesDeposited[msg.sender] = 0;
         crabV2.transfer(msg.sender, amount);
     }

     /**  */
     function claimAndWithdraw() external afterMigration { 

     }
 }