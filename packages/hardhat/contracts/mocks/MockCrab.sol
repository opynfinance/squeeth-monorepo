pragma solidity =0.7.6;

// interface
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockCrab is ERC20 {
    address operator;
    uint256 vaultId;
    uint256 collateral;
    uint256 short;
    address public wPowerPerp;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol) {
        _setupDecimals(_decimals);
    }

    function mint(address _account, uint256 _amount) external {
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount) external {
        _burn(_account, _amount);
    }

    function setVaultDetails(
        uint256 _vaultId,
        uint256 _collateral,
        uint256 _short
    ) external {
        vaultId = _vaultId;
        collateral = _collateral;
        short = _short;
    }

    function getVaultDetails()
        external
        view
        returns (
            address,
            uint256,
            uint256,
            uint256
        )
    {
        return (operator, vaultId, collateral, short);
    }
}
