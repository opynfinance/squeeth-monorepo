// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity =0.7.6;
pragma abicoder v2;
// Interfaces
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {IShortPowerPerp} from "../interfaces/IShortPowerPerp.sol";
import {IController} from "../interfaces/IController.sol";

// Libraries
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @notice contract simplifies opening a short wPowerPerp position by selling wPowerPerp on uniswap v3 and returning eth to user
 */
contract ShortHelper is IERC721Receiver, ReentrancyGuard {
    using SafeMath for uint256;
    using Address for address payable;

    IController public immutable controller;
    ISwapRouter public immutable router;
    IWETH9 public immutable weth;
    IShortPowerPerp public immutable shortPowerPerp;
    address public immutable wPowerPerp;

    /**
     * @notice constructor for short helper
     * @param _controllerAddr controller address for wPowerPerp
     * @param _swapRouter uniswap v3 swap router address
     * @param _wethAddr weth address
     */
    constructor(
        address _controllerAddr,
        address _swapRouter,
        address _wethAddr
    ) {
        require(_controllerAddr != address(0), "Invalid controller address");
        require(_swapRouter != address(0), "Invalid swap router address");
        require(_wethAddr != address(0), "Invalid weth address");
        IController _controller = IController(_controllerAddr);
        router = ISwapRouter(_swapRouter);
        wPowerPerp = _controller.wPowerPerp();
        IWPowerPerp _wPowerPerp = IWPowerPerp(_controller.wPowerPerp());
        IWETH9 _weth = IWETH9(_wethAddr);
        _wPowerPerp.approve(_swapRouter, type(uint256).max);
        _weth.approve(_swapRouter, type(uint256).max);

        // assign immutable variables
        shortPowerPerp = IShortPowerPerp(_controller.shortPowerPerp());
        weth = _weth;
        controller = _controller;
    }

    /**
     * @notice mint power perp, trade with uniswap v3 and send back premium in eth
     * @param _vaultId short wPowerPerp vault id
     * @param _powerPerpAmount amount of powerPerp to mint/sell
     * @param _uniNftId uniswap v3 position token id
     */
    function openShort(
        uint256 _vaultId,
        uint256 _powerPerpAmount,
        uint256 _uniNftId,
        ISwapRouter.ExactInputSingleParams memory _exactInputParams
    ) external payable nonReentrant {
        if (_vaultId != 0) require(shortPowerPerp.ownerOf(_vaultId) == msg.sender, "Not allowed");
        require(
            _exactInputParams.tokenOut == address(weth) && _exactInputParams.tokenIn == wPowerPerp,
            "Wrong swap tokens"
        );

        (uint256 vaultId, uint256 wPowerPerpAmount) = controller.mintPowerPerpAmount{value: msg.value}(
            _vaultId,
            _powerPerpAmount,
            _uniNftId
        );
        _exactInputParams.amountIn = wPowerPerpAmount;

        uint256 amountOut = router.exactInputSingle(_exactInputParams);

        // if the recipient is this address: unwrap eth and send back to msg.sender
        if (_exactInputParams.recipient == address(this)) {
            weth.withdraw(amountOut);
            payable(msg.sender).sendValue(amountOut);
        }

        // this is a newly open vault, transfer to the user.
        if (_vaultId == 0) shortPowerPerp.safeTransferFrom(address(this), msg.sender, vaultId);
    }

    /**
     * @notice buy back wPowerPerp with eth on uniswap v3 and close position
     * @param _vaultId short wPowerPerp vault id
     * @param _wPowerPerpAmount amount of wPowerPerp to burn
     * @param _withdrawAmount amount to withdraw
     */
    function closeShort(
        uint256 _vaultId,
        uint256 _wPowerPerpAmount,
        uint256 _withdrawAmount,
        ISwapRouter.ExactOutputSingleParams memory _exactOutputParams
    ) external payable nonReentrant {
        require(shortPowerPerp.ownerOf(_vaultId) == msg.sender, "Not allowed");
        require(
            _exactOutputParams.tokenOut == wPowerPerp && _exactOutputParams.tokenIn == address(weth),
            "Wrong swap tokens"
        );

        // wrap eth to weth
        weth.deposit{value: msg.value}();

        // pay weth and get wPowerPerp in return.
        uint256 amountIn = router.exactOutputSingle(_exactOutputParams);

        controller.burnWPowerPerpAmount(_vaultId, _wPowerPerpAmount, _withdrawAmount);

        // send back unused eth and withdrawn collateral
        weth.withdraw(msg.value.sub(amountIn));
        // no eth should be left in the contract, so we send it all back
        payable(msg.sender).sendValue(address(this).balance);
    }

    /**
     * @dev only receive eth from weth contract and controller.
     */
    receive() external payable {
        require(msg.sender == address(weth) || msg.sender == address(controller), "can't receive eth");
    }

    /**
     * @dev accept erc721 from safeTransferFrom and safeMint after callback
     * @return returns received selector
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
