//SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma abicoder v2;
// Interfaces
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IWPowerPerp} from "../interfaces/IWPowerPerp.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {IShortPowerPerp} from "../interfaces/IShortPowerPerp.sol";
import {IController} from "../interfaces/IController.sol";
// Libraries
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

contract ShortHelper {
    using SafeMath for uint256;
    using Address for address payable;

    IController public immutable controller;
    ISwapRouter public immutable router;
    IWETH9 public immutable weth;
    IShortPowerPerp public immutable shortPowerPerp;

    constructor(
        address _controllerAddr,
        address _swapRouter,
        address _wethAddr
    ) {
        IController _controller = IController(_controllerAddr);
        router = ISwapRouter(_swapRouter);

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
     * mint power perp, trade with uniswap and send back premium in eth.
     */
    function openShort(
        uint256 _vaultId,
        uint128 _powerPerpAmount,
        uint256 _uniNftId,
        ISwapRouter.ExactInputSingleParams memory _exactInputParams
    ) external payable {
        (uint256 vaultId, uint256 wPowerPerpAmount) = controller.mintPowerPerpAmount{value: msg.value}(
            _vaultId,
            _powerPerpAmount,
            _uniNftId
        );
        _exactInputParams.amountIn = wPowerPerpAmount;

        uint256 amountOut = router.exactInputSingle(_exactInputParams);

        // if the recipient is this address: unwrap eth and send back to msg.sender
        if (_exactInputParams.recipient == address(this) && _exactInputParams.tokenOut == address(weth)) {
            weth.withdraw(amountOut);
            payable(msg.sender).sendValue(amountOut);
        }

        // this is a newly open vault, transfer to the user.
        if (_vaultId == 0) shortPowerPerp.transferFrom(address(this), msg.sender, vaultId);
    }

    /**
     * buy back some squeeth and close the position.
     */
    function closeShort(
        uint256 _vaultId,
        uint256 _wPowerPerpAmount,
        uint128 _withdrawAmount,
        ISwapRouter.ExactOutputSingleParams memory _exactOutputParams
    ) external payable {
        // wrap eth to weth
        weth.deposit{value: msg.value}();

        // pay weth and get squeeth in return.
        uint256 amountIn = router.exactOutputSingle(_exactOutputParams);

        controller.burnWPowerPerpAmount(_vaultId, _wPowerPerpAmount, _withdrawAmount);

        // send back unused eth and withdrawn collateral
        weth.withdraw(msg.value.sub(amountIn));
        payable(msg.sender).sendValue(address(this).balance);
    }

    /**
     * @dev only receive eth from weth contract and controller.
     */
    receive() external payable {
        require(msg.sender == address(weth) || msg.sender == address(controller), "can't receive eth");
    }
}
