// SPDX-License-Identifier: GPL-3.0-only

pragma solidity =0.7.6;
pragma abicoder v2;

// interface
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

// contract
import {CrabStrategyV2} from "./CrabStrategyV2.sol";
import {CrabStrategy} from "./CrabStrategy.sol";

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
     
     modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

     modifier beforeMigration() {
        require(!isMigrated, "Migration already happened");
        _;
    }

     modifier afterMigration() {
        require(isMigrated, "Migration hasn't happened yet");
        _;
    }

    /** 
     * @notice migration constructor
     * @param _crabV1 address of crab v1
     * @param _crabV2 address of crab v2 
     */
     constructor (address payable _crabV1, address payable _crabV2) { 
         crabV1 = CrabStrategy(_crabV1);
         crabV2 = CrabStrategyV2 (_crabV2);
         owner = msg.sender;
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