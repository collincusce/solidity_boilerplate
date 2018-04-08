import {BigNumber} from "bignumber.js";

import * as ABIDecoder from "abi-decoder";
import * as chai from "chai";
import * as _ from "lodash";
import * as moment from "moment";
import * as Web3 from "web3";
import * as Units from "./test_utils/units";
import * as utils from "./test_utils/utils";

import {DebtKernelContract} from "../../types/generated/debt_kernel";
import {DebtRegistryContract} from "../../types/generated/debt_registry";
import {DebtTokenContract} from "../../types/generated/debt_token";
import {DummyTokenContract} from "../../types/generated/dummy_token";
import {DummyTokenRegistryContract} from "../../types/generated/dummy_token_registry";
import {RepaymentRouterContract} from "../../types/generated/repayment_router";
import {SimpleInterestTermsContractContract} from "../../types/generated/simple_interest_terms_contract";
import {TokenTransferProxyContract} from "../../types/generated/token_transfer_proxy";

import {CDOContract} from "../../types/generated/cdo";
import {TrancheContract} from "../../types/generated/tranche";

import {DebtKernelErrorCodes} from "../../types/errors";
import {DebtOrder, SignedDebtOrder} from "../../types/kernel/debt_order";

import {BigNumberSetup} from "./test_utils/bignumber_setup";
import ChaiSetup from "./test_utils/chai_setup";
import {INVALID_OPCODE, REVERT_ERROR} from "./test_utils/constants";

import {DebtOrderFactory} from "./factories/debt_order_factory";

import {TxDataPayable} from "../../types/common";

import leftPad = require("left-pad");

// Configure BigNumber exponentiation
BigNumberSetup.configure();

// Set up Chai
ChaiSetup.configure();
const expect = chai.expect;

const simpleInterestTermsContract = artifacts.require("SimpleInterestTermsContract");

const CDOArtifact = artifacts.require("CDO");
const TrancheArtifact = artifacts.require("Tranche");

contract("Collateralized Debt Obligation", async (ACCOUNTS) => {

/**
 * The RepaymentRouter routes allowers payers to make repayments on any
 * given debt agreement in any given token by routing the payments to
 * the debt agreement's beneficiary.  Additionally, the router acts
 * as a trusted oracle to the debt agreement's terms contract, informing
 * it of exactly what payments have been made in what quantity and in what token.
 */
    let repaymentRouter: RepaymentRouterContract;

/**
 * The DebtKernel is the hub of all business logic governing how and when
 * debt orders can be filled and cancelled.  All logic that determines
 * whether a debt order is valid & consensual is contained herein,
 * as well as the mechanisms that transfer fees to keepers and
 * principal payments to debtors.
 */
    let kernel: DebtKernelContract;

/**
 * The DebtToken contract governs all business logic for making a debt agreement
 * transferable as an ERC721 non-fungible token.  Additionally, the contract
 * allows authorized contracts to trigger the minting of a debt agreement token
 * and, in turn, the insertion of a debt issuance into the DebtRegsitry.
 */
    let debtToken: DebtTokenContract;

//Zepplin ERC20 MintableToken
    let principalToken: DummyTokenContract;

//This controls interest and repayment terms. Seems to ignore block number but adheres to the interface so requests it.
    let termsContract: SimpleInterestTermsContractContract;
    let tokenTransferProxy: TokenTransferProxyContract;

    let debtRegistry: DebtRegistryContract;

    let orderFactory: DebtOrderFactory;

    const CONTRACT_OWNER = ACCOUNTS[0];

    const DEBTOR_1 = ACCOUNTS[1];
    const DEBTOR_2 = ACCOUNTS[2];
    const DEBTOR_3 = ACCOUNTS[3];
    const DEBTORS = [
        DEBTOR_1,
        DEBTOR_2,
        DEBTOR_3,
    ];

    const CREDITOR_1 = ACCOUNTS[4];
    const CREDITOR_2 = ACCOUNTS[5];
    const CREDITOR_3 = ACCOUNTS[6];
    const CREDITORS = [
        CREDITOR_1,
        CREDITOR_2,
        CREDITOR_3,
    ];

    const PAYER_1 = ACCOUNTS[7];
    const PAYER_2 = ACCOUNTS[8];
    const PAYER_3 = ACCOUNTS[9];
    const PAYER_4 = ACCOUNTS[10];
    const PAYER_5 = ACCOUNTS[11];
    const PAYER_6 = ACCOUNTS[12];
    const PAYER_7 = ACCOUNTS[13];
    const PAYER_8 = ACCOUNTS[14];
    const PAYER_9 = ACCOUNTS[15];
    const PAYER_10 = ACCOUNTS[16];

    const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

    const TX_DEFAULTS = { from: CONTRACT_OWNER, gas: 4000000 };

    interface SignedDebtOrderObject{
        signedDebtOrder: SignedDebtOrder;
        receipt: Web3.TransactionReceipt;
    }
    interface AgreementIdMap {
        [key: string]: SignedDebtOrderObject;
    }
    //create a mapping of debtors to creditors for the sake of this example
    interface debtorsToCreditorsMap {
        [key:string]: string;
    }

    let createDebtOrders = async (debtorsToCreditors:debtorsToCreditorsMap, orderFactory:DebtOrderFactory, debtToken:DebtTokenContract, valueToken:DummyTokenContract, interest:number) => {
        let signedDebtOrders: AgreementIdMap ={};

        for(let debtor in debtorsToCreditors){
            let creditor:string = debtorsToCreditors[debtor];
            let signedDebtOrder:SignedDebtOrder = await orderFactory.generateDebtOrder({
                creditor: creditor,
                debtor: debtor,
                orderSignatories: { debtor: debtor, creditor: creditor},
            });

            // The unique id we use to refer to the debt agreement is the hash of its associated issuance commitment.
            let agreementId:string = signedDebtOrder.getIssuanceCommitment().getHash();

            // Creditor fills the signed debt order, creating a debt agreement with a unique associated debt token
            const txHash = await kernel.fillDebtOrder.sendTransactionAsync(
                signedDebtOrder.getCreditor(),
                signedDebtOrder.getOrderAddresses(),
                signedDebtOrder.getOrderValues(),
                signedDebtOrder.getOrderBytes32(),
                signedDebtOrder.getSignaturesV(),
                signedDebtOrder.getSignaturesR(),
                signedDebtOrder.getSignaturesS(),
            );

            let receipt:Web3.TransactionReceipt = await web3.eth.getTransactionReceipt(txHash);

            signedDebtOrders[agreementId] = {signedDebtOrder: signedDebtOrder, receipt: receipt};

            let debtorBalance = await valueToken.balanceOf.callAsync(debtor);

            await valueToken.setBalance.sendTransactionAsync(debtor, debtorBalance.add(Units.ether(interest)));
        }
        return signedDebtOrders;
    };

    let transferDebtOrders = async (signedDebtOrders:AgreementIdMap, transferAddress:string, debtToken:DebtTokenContract) => {
        for(let agreementId in signedDebtOrders){
            let signedDebtOrder = signedDebtOrders[agreementId].signedDebtOrder;
            await debtToken.transfer.sendTransactionAsync(
                transferAddress, // to
                new BigNumber(agreementId), // tokenId
                { from: signedDebtOrder.getCreditor() },
            );
        }
        return true;
    };

    let repayment = async (agreementId:string, repayAmount:number, principalToken:DummyTokenContract, signedDebtOrder:SignedDebtOrder) => {

        let creditor = signedDebtOrder.getCreditor();
        let debtor = signedDebtOrder.getDebtor();
        const creditorBalanceBefore = await principalToken.balanceOf.callAsync(creditor);

        let debtorBalance = await principalToken.balanceOf.callAsync(debtor);
        //console.log("debtor balance: ", debtorBalance.toString());

        let txHash = await repaymentRouter.repay.sendTransactionAsync(
            agreementId,
            Units.ether(repayAmount), // amount
            principalToken.address, // token type
            { from: debtor },
        );
        let receipt = await web3.eth.getTransactionReceipt(txHash);
        
    }

    let createCDO = async (tokenContractAddress:string, seniorTranche:string, mezzanineTranche:string) => {
        const CDOContractTruffle = await CDOArtifact.new(
            tokenContractAddress,
            seniorTranche,
            mezzanineTranche
        );

        // The typings we use ingest vanilla Web3 contracts, so we convert the
        // contract instance deployed by truffle into a Web3 contract instance
        const CDOContractWeb3Contract =
            web3.eth.contract(CDOArtifact.abi).at(CDOContractTruffle.address);

        return new CDOContract(CDOContractWeb3Contract, TX_DEFAULTS);
    };

    let createTranche = async (trancheLimit:number, trancheValue:number) => {
        let trancheValueNormalized = Units.ether(trancheValue);
        const TrancheContractTruffle = await TrancheArtifact.new(
            trancheLimit,
            trancheValueNormalized
        );

        // The typings we use ingest vanilla Web3 contracts, so we convert the
        // contract instance deployed by truffle into a Web3 contract instance
        const TrancheContractWeb3Contract =
            web3.eth.contract(TrancheArtifact.abi).at(TrancheContractTruffle.address);

        return new TrancheContract(TrancheContractWeb3Contract, TX_DEFAULTS);
    };

    let createTranchePayers = async (CDO:CDOContract, tranche:TrancheContract, payers:Array<string>) => {
        let results:Array<BigNumber> = [];
        for(let i = 0; i < payers.length; i++){
            //cheating, Nadav's all "hardcode it", so I am. The generic approach threw a strange issue.
            await tranche.transfer.sendTransactionAsync(payers[i], new BigNumber(i));
            results.push(new BigNumber(i));
        }
        return results;
    };

    let payout = async (CDO:CDOContract, payers:Array<string>) => {
        for(let i = 0; i < payers.length; i++){
            await CDO.payout.sendTransactionAsync({from: payers[i]});
        } 
    }

    before(async () => {
        const dummyTokenRegistryContract = await DummyTokenRegistryContract.deployed(web3, TX_DEFAULTS);
        const dummyREPTokenAddress = await dummyTokenRegistryContract.getTokenAddress.callAsync("REP");

        principalToken = await DummyTokenContract.at(dummyREPTokenAddress, web3, TX_DEFAULTS);

        kernel = await DebtKernelContract.deployed(web3, TX_DEFAULTS);
        debtToken = await DebtTokenContract.deployed(web3, TX_DEFAULTS);
        tokenTransferProxy = await TokenTransferProxyContract.deployed(web3, TX_DEFAULTS);

        await principalToken.setBalance.sendTransactionAsync(CREDITOR_1, Units.ether(100));
        await principalToken.setBalance.sendTransactionAsync(CREDITOR_2, Units.ether(100));
        await principalToken.setBalance.sendTransactionAsync(CREDITOR_3, Units.ether(100));

        await principalToken.approve.sendTransactionAsync(tokenTransferProxy.address,
            Units.ether(100), { from: DEBTOR_1 });
        await principalToken.approve.sendTransactionAsync(tokenTransferProxy.address,
            Units.ether(100), { from: DEBTOR_2 });
        await principalToken.approve.sendTransactionAsync(tokenTransferProxy.address,
            Units.ether(100), { from: DEBTOR_3 });

        await principalToken.approve.sendTransactionAsync(tokenTransferProxy.address,
            Units.ether(100), { from: CREDITOR_1 });
        await principalToken.approve.sendTransactionAsync(tokenTransferProxy.address,
            Units.ether(100), { from: CREDITOR_2 });
        await principalToken.approve.sendTransactionAsync(tokenTransferProxy.address,
            Units.ether(100), { from: CREDITOR_3 });

        debtRegistry = await DebtRegistryContract.deployed(web3, TX_DEFAULTS);

        repaymentRouter = await RepaymentRouterContract.deployed(web3, TX_DEFAULTS);


        const termsContractTruffle = await simpleInterestTermsContract.new(
            debtRegistry.address,
            principalToken.address,
            repaymentRouter.address,
        );

        // The typings we use ingest vanilla Web3 contracts, so we convert the
        // contract instance deployed by truffle into a Web3 contract instance
        const termsContractWeb3Contract =
            web3.eth.contract(simpleInterestTermsContract.abi).at(termsContractTruffle.address);

        termsContract = new SimpleInterestTermsContractContract(termsContractWeb3Contract, TX_DEFAULTS);


        await tokenTransferProxy.addAuthorizedTransferAgent.sendTransactionAsync(repaymentRouter.address);

        const termLengthInBlocks = 43200;
        const principalPlusInterest = Units.ether(1.1);

        const uint16PrincipalPlusInterest = leftPad(web3.toHex(principalPlusInterest).substr(2), 32, "0");
        const uint16TermLength = leftPad(web3.toHex(termLengthInBlocks).substr(2), 32, "0");

        const termsContractParameters = "0x" + uint16PrincipalPlusInterest + uint16TermLength;

        const defaultOrderParams = {
            creditorFee: Units.ether(0),
            debtKernelContract: kernel.address,
            debtOrderVersion: kernel.address,
            debtTokenContract: debtToken.address,
            debtor: DEBTOR_1,
            debtorFee: Units.ether(0),
            expirationTimestampInSec: new BigNumber(moment().add(1, "days").unix()),
            issuanceVersion: repaymentRouter.address,
            orderSignatories: { debtor: DEBTOR_1, creditor: CREDITOR_1 },
            principalAmount: Units.ether(1),
            principalTokenAddress: principalToken.address,
            relayer: NULL_ADDRESS,
            relayerFee: Units.ether(0),
            termsContract: termsContract.address,
            termsContractParameters,
            underwriter: NULL_ADDRESS,
            underwriterFee: Units.ether(0),
            underwriterRiskRating: Units.percent(0),
        };

        orderFactory = new DebtOrderFactory(defaultOrderParams);

        ABIDecoder.addABI(repaymentRouter.abi);
  
    });

    after(() => {
        ABIDecoder.removeABI(repaymentRouter.abi);
    });

    describe("Create Three Debt Agreements, Transfer to CDO, Add Payers", async () => {
        let signedDebtOrders:AgreementIdMap;
        let CDO:CDOContract;
        let seniorTranche:TrancheContract;
        let mezzanineTranche:TrancheContract;
        //We want to control what these addresses are... just doing this for testing.
        //There's no reason why 1 payer might not own multiple tranch tokens.
        //60% of 3.3 is 1.98 for the Senior tranche
        //40% of 3.3 is 1.32 for the Mezzanine tranche
        //each person is entitled to 0.33, but the Senior gets it first
        let SENIORS:Array<string> = [
                PAYER_1,
                PAYER_2,
                PAYER_3,
                PAYER_4,
                PAYER_5,
                PAYER_6
            ];
        let MEZZANINES:Array<string> = [
                PAYER_7,
                PAYER_8,
                PAYER_9,
                PAYER_10
            ];
        let debtorsToCreditors:debtorsToCreditorsMap = {}; 
        debtorsToCreditors[DEBTOR_1] = CREDITOR_1;
        debtorsToCreditors[DEBTOR_2] = CREDITOR_2;
        debtorsToCreditors[DEBTOR_3] = CREDITOR_3;
        it("seniorTranche created", async () => {
            seniorTranche = await createTranche(SENIORS.length, 0.33);
            await expect(seniorTranche.expectedPayoutTotal.callAsync())
                .to.eventually.bignumber.equal(Units.ether(0.33).mul(SENIORS.length));
        });
        
        it("MezzanineTranche created", async () => {
            mezzanineTranche = await createTranche(MEZZANINES.length, 0.33);
            await expect(mezzanineTranche.expectedPayoutTotal.callAsync())
                .to.eventually.bignumber.equal(Units.ether(0.33).mul(MEZZANINES.length));
        });
        
        it("CDO created", async () => {
            CDO = await createCDO(principalToken.address, seniorTranche.address, mezzanineTranche.address);
            expect(CDO.address).to.be.a('string');
        });
        
        //give control of the tranche to the contract
        it("Senior Tranche transfered", async () => {
            await seniorTranche.transferOwnership.sendTransactionAsync(CDO.address, {from: CONTRACT_OWNER});
            let owner = await seniorTranche.owner.callAsync();
            await expect(owner).to.equal(CDO.address);
        });
        
        it("Mezzanine Tranche transfered", async () => {
            await mezzanineTranche.transferOwnership.sendTransactionAsync(CDO.address, {from: CONTRACT_OWNER});
            let owner = await mezzanineTranche.owner.callAsync();
            await expect(owner).to.equal(CDO.address);
        });

        //CDO contract now has control of tranche and can add payers
        it("Senior Tranche payers created", async () => {
            let results = await createTranchePayers(CDO, seniorTranche, SENIORS);
            let tokenOwner = await seniorTranche.ownerOf.callAsync(new BigNumber(results[0]));
            await expect(tokenOwner).to.equal(SENIORS[0]);
        });
        it("Mezzanine Tranche payers created", async () => {
            let results = await createTranchePayers(CDO, mezzanineTranche, MEZZANINES);
            let tokenOwner = await mezzanineTranche.ownerOf.callAsync(new BigNumber(results[0]));
            await expect(tokenOwner).to.equal(MEZZANINES[0]);
        });

        it("Create 3 debt orders", async () => {
            signedDebtOrders = await createDebtOrders(debtorsToCreditors, orderFactory, debtToken, principalToken, 0.1);
            await expect(Object.keys(signedDebtOrders).length).to.equal(3);
        });

        it("Transfered debt ownership to the CDO", async () => {
            await transferDebtOrders(signedDebtOrders, CDO.address, debtToken);
            await expect(debtToken.ownerOf.callAsync(new BigNumber(Object.keys(signedDebtOrders)[0])))
                .to.eventually.equal(CDO.address);
        });


        it("Repayment for agreements by 0.33", async () => {
            let oldBalance = 0;
            let repayAmount = 0.33; // This amount should be half of the 60% Senior tranche
            for(let agreementId in signedDebtOrders){
                let signedDebtOrder = signedDebtOrders[agreementId].signedDebtOrder;
                await repayment(agreementId, repayAmount, principalToken, signedDebtOrder);
            }
            let newBalance = Units.ether(oldBalance + repayAmount).mul(Object.keys(signedDebtOrders).length);
            await expect(principalToken.balanceOf.callAsync(CDO.address))
                .to.eventually.bignumber.equal(newBalance);
        });
        
        //Make sure Senior can withdraw 
        it("Senior should have 0.165", async () => {
            await payout(CDO, SENIORS);
            await expect(principalToken.balanceOf.callAsync(PAYER_3))
               .to.eventually.bignumber.equal(Units.ether(0.165));
        });
        //Make sure Mezzanine cannot withdraw
        it("Mezzanine should have 0", async () => {
            await payout(CDO, MEZZANINES);
            await expect(principalToken.balanceOf.callAsync(PAYER_8))
                .to.eventually.bignumber.equal(Units.ether(0));
        });

        it("Repayment for agreements by 0.33", async () => {
            let oldBalance = await principalToken.balanceOf.callAsync(CDO.address);
            let repayAmount = 0.33; // This amount should pay off the half of the 60% Senior tranche
            for(let agreementId in signedDebtOrders){
                let signedDebtOrder = signedDebtOrders[agreementId].signedDebtOrder;
                await repayment(agreementId, repayAmount, principalToken, signedDebtOrder);
            }
            let newBalance = oldBalance.add(Units.ether(repayAmount).mul(Object.keys(signedDebtOrders).length));
            await expect(principalToken.balanceOf.callAsync(CDO.address))
                .to.eventually.bignumber.equal(newBalance);
        });

        //Make sure Senior can withdraw 
        it("Senior should have 0.33", async () => {
            await payout(CDO, SENIORS);
            await expect(CDO.getPayoutBalance.callAsync(PAYER_3))
                .to.eventually.bignumber.equal(Units.ether(0.33));
        });

        //Make sure Mezzanine cannot withdraw
        it("Mezzanine should have 0 still", async () => {
            await payout(CDO, MEZZANINES);
            await expect(CDO.getPayoutBalance.callAsync(PAYER_8))
                .to.eventually.bignumber.equal(Units.ether(0));
        });

        it("Repayment for agreements by 0.20",async () => {
            let oldBalance = await principalToken.balanceOf.callAsync(CDO.address);
            let repayAmount = 0.20; // This amount should pay off less than half of the 40% Mezzanine tranche... 
            // unlike half which is 0.22, there's no floating precision errors with this number when divided by 4
            //Nadav said he doesn't care to worry about that stuff, so I'm building it this way. 
            for(let agreementId in signedDebtOrders){
                let signedDebtOrder = signedDebtOrders[agreementId].signedDebtOrder;
                await repayment(agreementId, repayAmount, principalToken, signedDebtOrder);
            }
            let newBalance = oldBalance.add(Units.ether(repayAmount).mul(Object.keys(signedDebtOrders).length));
            await expect(principalToken.balanceOf.callAsync(CDO.address))
                .to.eventually.bignumber.equal(newBalance);
        });

        //Make sure Senior can withdraw 
        it("Senior should have 0.33 still", async () => {
            await payout(CDO, SENIORS);
            await expect(principalToken.balanceOf.callAsync(PAYER_3))
                .to.eventually.bignumber.equal(Units.ether(0.33));
        });

        //Make sure Mezzanine cannot withdraw
        it("Mezzanine should have 0.15", async () => {
            await payout(CDO, MEZZANINES);
            await expect(principalToken.balanceOf.callAsync(PAYER_8))
                .to.eventually.bignumber.equal(Units.ether(0.15));
        });

        it("Repayment for agreements by 0.24", async () => {
            let oldBalance = await principalToken.balanceOf.callAsync(CDO.address);
            //console.log("oldBalance: ", oldBalance.toString());
            let repayAmount = 0.24;
            //console.log("repayment: ", Units.ether(repayAmount).toString());
            for(let agreementId in signedDebtOrders){
                let signedDebtOrder = signedDebtOrders[agreementId].signedDebtOrder;
                await repayment(agreementId, repayAmount, principalToken, signedDebtOrder);
            }
            let newBalance = oldBalance.add(Units.ether(repayAmount).mul(Object.keys(signedDebtOrders).length));
            //console.log("newBalance: ", newBalance.toString());
            await expect(principalToken.balanceOf.callAsync(CDO.address))
                .to.eventually.bignumber.equal(newBalance);
        });

        //Make sure Senior can withdraw 
        it("Senior should have 0.33 still", async () => {
            await payout(CDO, SENIORS);
            await expect(CDO.getPayoutBalance.callAsync(PAYER_3))
                .to.eventually.bignumber.equal(Units.ether(0.33));
        });

        //Make sure Mezzanine cannot withdraw
        it("Mezzanine should have 0.33", async () => {
            await payout(CDO, MEZZANINES);
            let pb8 = await principalToken.balanceOf.callAsync(PAYER_8);
            //console.log("pb8", pb8.toString());
            await expect(CDO.getPayoutBalance.callAsync(PAYER_8))
                .to.eventually.bignumber.equal(Units.ether(0.33));
        });
    });
/*
    describe("Example Tests", () => {
        let signedDebtOrder: SignedDebtOrder;
        let agreementId: string;
        let receipt: Web3.TransactionReceipt;

        before(async () => {
            // NOTE: For purposes of this assignment, we hard code a default principal + interest amount of 1.1 ether
            // If you're interested in how to vary this amount, poke around in the setup code above :)
            signedDebtOrder = await orderFactory.generateDebtOrder({
                creditor: CREDITOR_2,
                debtor: DEBTOR_2,
                orderSignatories: { debtor: DEBTOR_2, creditor: CREDITOR_2 },
            });

            // The unique id we use to refer to the debt agreement is the hash of its associated issuance commitment.
            agreementId = signedDebtOrder.getIssuanceCommitment().getHash();

            // Creditor fills the signed debt order, creating a debt agreement with a unique associated debt token
            const txHash = await kernel.fillDebtOrder.sendTransactionAsync(
                signedDebtOrder.getCreditor(),
                signedDebtOrder.getOrderAddresses(),
                signedDebtOrder.getOrderValues(),
                signedDebtOrder.getOrderBytes32(),
                signedDebtOrder.getSignaturesV(),
                signedDebtOrder.getSignaturesR(),
                signedDebtOrder.getSignaturesS(),
            );

            receipt = await web3.eth.getTransactionReceipt(txHash);
        });

        it("should issue creditor a unique debt token", async () => {
            await expect(debtToken.ownerOf.callAsync(new BigNumber(agreementId)))
                .to.eventually.equal(CREDITOR_2);
        });

        it("should allow debtor to make repayment", async () => {
            const creditorBalanceBefore = await principalToken.balanceOf.callAsync(CREDITOR_2);

            await repaymentRouter.repay.sendTransactionAsync(
                agreementId,
                Units.ether(1), // amount
                principalToken.address, // token type
                { from: DEBTOR_2 },
            );

            await expect(principalToken.balanceOf.callAsync(CREDITOR_2))
                .to.eventually.bignumber.equal(creditorBalanceBefore.plus(Units.ether(1)));
        });

        it("should allow creditor to transfer debt token to different address", async () => {
            await debtToken.transfer.sendTransactionAsync(
                CREDITOR_1, // to
                new BigNumber(agreementId), // tokenId
                { from: CREDITOR_2 },
            );

            await expect(debtToken.ownerOf.callAsync(new BigNumber(agreementId)))
                .to.eventually.equal(CREDITOR_1);
        });
    });
*/
});
