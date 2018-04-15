
import {BigNumber} from "bignumber.js";
const DataRegistry = artifacts.require("DataRegistry");

module.exports = (deployer: any, network: string, accounts: string[]) => {
    const TX_DEFAULTS = { from: accounts[0], gas: 80000000 };

    deployer.deploy(DataRegistry);
};
