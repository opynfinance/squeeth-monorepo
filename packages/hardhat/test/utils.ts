import { BigNumber, ContractTransaction } from "ethers";
import { BigNumber as BigNumberJs } from "bignumber.js";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

export const one = BigNumber.from(10).pow(18);
export const oracleScaleFactor = BigNumber.from(10).pow(4);

type Vault = [BigNumber, BigNumber, BigNumber] & {
    NftCollateralId: BigNumber;
    collateralAmount: BigNumber;
    shortAmount: BigNumber;
};

export const isEmptyVault = (vault: Vault): boolean => {
    return vault.collateralAmount.isZero() && vault.shortAmount.isZero();
};

export const isSimilar = (number1: string, number2: string, precision: number = 4) => {
    const error = 1 / 10 ** precision;
    if (number2 === number1) return true;
    return new BigNumberJs(number1).div(new BigNumberJs(number2)).minus(1).abs().lt(error);
};

export const getNow = async (provider: any) => {
    const blockNumBefore = await provider.getBlockNumber();
    const blockBefore = await provider.getBlock(blockNumBefore);
    return blockBefore.timestamp;
};

export const UNDERFLOW_ERROR =
    "reverted with panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)";

export const wmul = (x: BigNumber, y: BigNumber): BigNumber => {
    const z = x.mul(y).add(one.div(2)).div(one);
    return z;
};

export const wdiv = (x: BigNumber, y: BigNumber): BigNumber => {
    const z = x.mul(one).add(y.div(2)).div(y);
    return z;
};

export const signTypedData = async (signer: SignerWithAddress, domainData: any, type: any, data: any) => {
    const signature2 = await signer._signTypedData(domainData, type, data);
    const { r: r1, s: s1, v: v1 } = ethers.utils.splitSignature(signature2);
    return {
        ...data,
        r: r1,
        s: s1,
        v: String(v1),
    };
};

export const getGasPaid = async (tx: ContractTransaction) => {
    const receipt = await tx.wait();
    return receipt.gasUsed.mul(receipt.effectiveGasPrice)
}
