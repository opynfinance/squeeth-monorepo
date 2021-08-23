//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

// Interfaces
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IWSqueeth} from "../interfaces/IWSqueeth.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";
import {IVaultManagerNFT} from "../interfaces/IVaultManagerNFT.sol";
import {IController} from "../interfaces/IController.sol";
// Libraries
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

contract ShortHelper {
    using Address for address payable;

    IController public immutable controller;
    ISwapRouter public immutable router;
    IWSqueeth public immutable squeeth;
    IWETH9 public immutable weth;
    IVaultManagerNFT public immutable vaultNFT;

    constructor(
        address _controllerAddr,
        address _swapRouter,
        address _wethAddr
    ) {
        IController _controller = IController(_controllerAddr);
        router = ISwapRouter(_swapRouter);

        IWSqueeth _squeeth = IWSqueeth(_controller.squeeth());
        IWETH9 _weth = IWETH9(_wethAddr);
        _squeeth.approve(_swapRouter, type(uint256).max);
        _weth.approve(_swapRouter, type(uint256).max);

        // assign immutable variables
        vaultNFT = IVaultManagerNFT(_controller.vaultNFT());
        weth = _weth;
        controller = _controller;
        squeeth = _squeeth;
    }

    /**
     * mint squeeth, trade with uniswap and send back premium in eth.
     */
    function openShort(
        uint256 _vaultId,
        uint128 _shortSqueethAmount,
        ISwapRouter.ExactInputSingleParams memory _exactInputParams
    ) external payable {
        uint256 vaultId = controller.mint{value: msg.value}(_vaultId, _shortSqueethAmount);

        uint256 amountOut = router.exactInputSingle(_exactInputParams);

        // if the recipient is this address: unwrap eth and send back to msg.sender
        if (_exactInputParams.recipient == address(this) && _exactInputParams.tokenOut == address(weth)) {
            weth.withdraw(amountOut);
            payable(msg.sender).sendValue(amountOut);
        }

        vaultNFT.transferFrom(address(this), msg.sender, vaultId);
    }

    /**
     * buy back some squeeth and close the position.
     */
    function closeShort(
        uint256 _vaultId,
        uint128 _burnSqueethAmount,
        uint128 _withdrawAmount,
        ISwapRouter.ExactOutputSingleParams memory _exactOutputParams
    ) external payable {
        vaultNFT.transferFrom(msg.sender, address(this), _vaultId);
        // wrap eth to weth
        weth.deposit{value: msg.value}();

        // pay weth and get squeeth in return.
        uint256 amountIn = router.exactOutputSingle(_exactOutputParams);

        uint256 vaultId = controller.burn(_vaultId, _burnSqueethAmount, _withdrawAmount);

        if (vaultId != 0) {
            vaultNFT.transferFrom(address(this), msg.sender, _vaultId);
        }

        // send back unused eth and withdrawn collateral
        weth.withdraw(msg.value - amountIn);
        payable(msg.sender).sendValue(address(this).balance);
    }

    /**
     * @dev only receive eth from weth contract and controller.
     */
    receive() external payable {
        require(msg.sender == address(weth) || msg.sender == address(controller), "can't receive eth");
    }
}
