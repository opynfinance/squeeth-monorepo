// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity =0.7.6;

contract OpynWETH9 {
    address owner;

    string public name = "Wrapped Opyn Ether";
    string public symbol = "OpynWETH";
    uint8 public decimals = 18;

    event Approval(address indexed src, address indexed guy, uint256 wad);
    event Transfer(address indexed src, address indexed dst, uint256 wad);
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);
    event MinterWhitelisted(address indexed account);
    event MinterBlacklisted(address indexed account);

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) internal whitelistedMinters;

    /**
     * @notice check if the sender is whitelistd
     */
    modifier onlyWhitelisted() {
        require(whitelistedMinters[msg.sender] || msg.sender == owner, "Address not a whitelisted minter");

        _;
    }

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {
        deposit();
    }

    function mint(address _to, uint256 _amount) public onlyWhitelisted {
        balanceOf[_to] += _amount;
        emit Deposit(_to, _amount);
    }

    function burn(address _from, uint256 _amount) public onlyWhitelisted {
        balanceOf[_from] -= _amount;
        emit Withdrawal(_from, _amount);
    }

    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) public {
        require(balanceOf[msg.sender] >= wad);
        balanceOf[msg.sender] -= wad;
        msg.sender.transfer(wad);
        emit Withdrawal(msg.sender, wad);
    }

    function totalSupply() public view returns (uint256) {
        return address(this).balance;
    }

    function approve(address guy, uint256 wad) public returns (bool) {
        allowance[msg.sender][guy] = wad;
        emit Approval(msg.sender, guy, wad);
        return true;
    }

    function transfer(address dst, uint256 wad) public returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    function transferFrom(
        address src,
        address dst,
        uint256 wad
    ) public returns (bool) {
        require(balanceOf[src] >= wad);

        if (src != msg.sender && allowance[src][msg.sender] != uint256(-1)) {
            require(allowance[src][msg.sender] >= wad);
            allowance[src][msg.sender] -= wad;
        }

        balanceOf[src] -= wad;
        balanceOf[dst] += wad;

        emit Transfer(src, dst, wad);

        return true;
    }

    /**
     * @notice check if a minter is whitelisted
     * @param _account address of minter
     * @return boolean, True if address is a whitelisted minter
     */
    function isWhitelistedMinter(address _account) external view returns (bool) {
        return whitelistedMinters[_account];
    }

    /**
     * @notice allows the minter to whitelist other minters
     * @param _account address of minter to be whitelisted
     */
    function whitelistMinter(address _account) external onlyWhitelisted {
        whitelistedMinters[_account] = true;

        emit MinterWhitelisted(_account);
    }

    /**
     * @notice allow the minter to blacklist other minters
     * @param _account address of minter to be blacklisted
     */
    function blacklistMinter(address _account) external onlyWhitelisted {
        whitelistedMinters[_account] = false;

        emit MinterBlacklisted(_account);
    }
}
