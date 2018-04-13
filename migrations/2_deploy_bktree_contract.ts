
import {BigNumber} from "bignumber.js";
const BKTree = artifacts.require("BKTree");

module.exports = (deployer: any, network: string, accounts: string[]) => {
    const TX_DEFAULTS = { from: accounts[0], gas: 80000000 };

    deployer.deploy(BKTree, new BigNumber("0x90988d8325694163e750b89304f01907"), new BigNumber("0x" + web3.sha3("0x90988d8325694163e750b89304f01907")), new BigNumber(42));
};
