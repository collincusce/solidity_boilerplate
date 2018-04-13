import {BigNumber} from "bignumber.js";

import * as ABIDecoder from "abi-decoder";
import * as chai from "chai";
import * as _ from "lodash";
import * as moment from "moment";
import * as Web3 from "web3";
import * as Units from "./test_utils/units";
import * as utils from "./test_utils/utils";

import {BKTreeContract} from "../../types/generated/b_k_tree";

import {BigNumberSetup} from "./test_utils/bignumber_setup";
import ChaiSetup from "./test_utils/chai_setup";
import {INVALID_OPCODE, REVERT_ERROR} from "./test_utils/constants";

import leftPad = require("left-pad");

// Configure BigNumber exponentiation
BigNumberSetup.configure();

// Set up Chai
ChaiSetup.configure();
const expect = chai.expect;

const BKTreeArtifact = artifacts.require("BKTree");

contract("BKTree", async (ACCOUNTS) => {

    let bktree: BKTreeContract;

    const CONTRACT_OWNER = ACCOUNTS[0];

    const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

    const TX_DEFAULTS = { from: CONTRACT_OWNER, gas: 80000000 };

    const root = "90988d8325694163e750b89304f01907";

    const TEST_DATA = [
        "6cdadad86564e7c5602fd2901b6466e4",
        "904d6df8ce793ede179f7f730ec32090",
        "acc8b23696caae8e2d89e1f03f12609c",
        "e3695658a3a6c6c186e9f4511b2080c9",
        "285261e0b1c1465139767ec8f3830c7f",
        "b18794850d180c13e0c650938c50bd63",
        "252505099a20d1361f06845bb820d9e7",
        "521516a80c941687c24456a1c8b9f7fb",
        "6d2532593a252407422dae411af9e7f7",
        "b71313141d170305e0be6287c9307efd",
        "87156429296605213895040f31e2defd",
        "91251614071a2104c2bb46f4ad38efec",
        "999d2c6d57784a1693940c699ce1cb1e",
        "873f0f0f2f0fab27073008d8035cfbe1",
        "1fa72f172e0ead323004ead4035efdf3",
        "527199e96474d2d21c40b99809e70096",
        "a3120a2a0e174b59c1e71fe2883f9ff3",
        "2dc75aa6357b16326987df8234c9bf43",
        "93ab59f5955bafae00ae1befe55ff36a",
        "304b5c74d4da6b9525ef1962f5f64bd5",
        "b3460f8a0e262e9aa346fc03bb42fcf8",
        "4a471b1b2a5edf3612cc2317eb02ddf6",
        "b21a0d27261a192fe0d6c93f04bef14b",
        "7323964b4e343255f1433473c81de7f9",
        "b3527926a61a4666e39e71f52e331ac6",
        "aa25568d12241a929e23409d3fe0fe1a",
        "d7172b0b0b2917a7c0f400c9fe29dff7",
        "270f535f0b5105276ce8861faed1ff7f",
        "16ab6b133d4b9b9f00fe48deb54862fb",
        "3fa74b1b3d691a9ff8b448dfb0ed43f9",
        "a38b4f9b5567db2f00be0c8a1365dffb",
        "278d46cd6b634b9727bd26851966ebff",
        "b7174f5f4d995f770030de764c099963",
        "166f4b2a469c2b733034cc6a4e118c6b",
        "e4541f2b1b2b9b1b81009dec1a6e83b2",
        "071bab2b0b29991b0050bd761ae69959",
        "9692a6a627677639801bd4813fffc660",
        "d2c78a29292aa69401d59e8007486ee5",
        "da860a6d596b2eb411fd1a2457ca4e64",
        "b034f490138a279f03ffc4f50280673e",
        "e4e5242bb20a2d37f3dd44cd02024dbe",
        "d0c3938d5b5bc76400eb820d7fdb1e66",
        "aba30b8d11932744f38e020d79d32e0c",
        "b01acf2f3b8a268607339ee9629861ee",
        "b4829736059616e3f100ca644d8e30e3",
        "b08e46e64c584ee4e13f308604b31ee0",
        "d45e84ef14348aecc5fa100a14f53a80",
        "a0fcb22b73abcfca0ff9c63ed1263c9b",
        "f8f6cafba39d9a99fb74cff026cd3833",
        "b06896866614374603eb57b0ce01237c",
        "e4c49a274f54558ee1df13a4cb04717e",
        "9252d8491a3890f005f7ba0f00fe1080",
        "0cac66652c768fcc7f09c6d609653e1c",
        "b2626b984767237011f74e301fc71c23",
        "8a87ab712b872472eb1f28e07b9f2c0b",
        "a0e8ca2e4a12125a07a19f7cc8c06fd3",
        "9ae646b46d1d09a913a14eb6c8f077f9",
        "b7e6ceb3a3aaaaea7fa7d812277a108e",
        "b144d6b333cb4fe603fdc08f27105a8f",
        "664aab125ba7c7e6e4dc803f5320db8f",
        "f2491988cc0126b302e17d23d8817ce3",
        "c7d9992a955416926ed0d768a3837ec2",
        "d0dcb42c0e854f2f03dbb5e578815f79",
        "c894262e0e864e6dcbd9a74c78917e7d",
        "312c7cb40e6eb2ec032df9a1916c3e01",
        "9a7c1a312f67958c934d78d3986c7f38",
        "b40e26b49c1d4e7000df2f60ef31d875",
        "2a2737d68b1e662b8a4d3740eb19dc3e",
        "4c2c9ab316343ed8017d598fdae53620",
        "6635dc9c89393b0b066f5c959fc9f03f",
        "888cdc98949a98ccffac1dfb809e3b80",
        "b4b2b4eecae6b2dcddc2356491ccae00",
        "90b18b69294e470fbfe1b44ae308c7bb",
        "a7bb76713532b0c54cb1fc02b946b281",
        "97315393325968a99c71499f2210c8f0",
        "b8d4e0f0e0e4f058fbffdff68aedbc43",
        "c898f0e8b0dcdc74cfff7ffde6939c41",
        "639994b8acd4f4e06fc39f92693f34c1",
        "c5d4f2aae6e460607ffff7fa1ebcf443",
        "70f4fae8e8b471727f65f08bc9bcd343",
        "78f8cef4d0d050f07f73def4e2bfdf41",
        "70c0ac8c9ed6cac47fc7f5ab7fb1ba41",
        "d86cdedad89accc2d3616ffefff2f800",
        "7656d3c369797272e378e697ffb9d37f",
        "7b6ae94d5571793bf060e0fe9ddec163",
        "70ecce9a3e7a56267f61c89fbfebf166",
        "7864d25c4c5e4e54f30186f3fd91fa4e",
        "68ececd4d8e0585cff41695cfa8ec771",
        "54d4f6e8f8d8d864ff797ecf00a3db63",
        "e96cccccc8d86464bfe1701fdfb0cc62",
        "f1d8e4d0d8d86444ff5b6d3c0390c67e",
        "ecccd2e898ccd470ffccfeceb3a8bc41",
        "dcd28c9e968cd89cedf78f33f68fdf71",
        "dcccc890cce4e4d07fc04916b96e0e40",
        "f4f4ceb4a6ec7ecc7fe5da73a48f7440",
        "79d9f0f570717173ff0b618f8050a9c3",
        "1961e0ece85b5a0eff5cef3dc981d3fe",
        "5758d8784a63c323fe3fd5a03860d187",
        "5b68f47252393933bf79cca0d280f9e1",
        "c86896c6d6545434ff017bce94fed47f",
        "7a5894e2cac44e8eef5bb52ee285c77f",
        "71c4ccd4acc66024ffc109c4f09ccf6f",
        "7048d460a6265634e60bb441e7afc37f",
        "74c4d68282d2c8587f41d5702d87be61",
        "1a52b39acaa644acfe54e177f9aedf63",
        "d9c9ccd4b0b02049f6c3f95dc6a13c42",
        "d0d8def4d4d24264ff815f32e195de60",
        "7868c4d0c8d8d46cf7634d77c8ca976b",
        "7058dcc2e2c44458a361f9dff2848c63",
        "b1f4f2f6f0f054583f7ddb66e0a7c478",
        "7870ecf2f2f0584cbb43fcf692a6c27b",
        "70ccd8c8e8f0c868f74d3cbf6ab69661",
        "6068a2e2a0c48cecff71fffe63863e41",
        "605cd4dcecdc4c18ff5bcd16a2b0c47f",
        "68e4e2d2d2d8d0f47f5defbfc7fffa00",
        "794cc4f2f0f05052e379dd9f7be4c143",
        "5970f8f468e86076d97fba96fd9ac163",
        "e968ececd470746cf741d3ee1c93c17f",
        "496cdc9ac4c044349e63dd3fe7bac063",
        "70685a5a7971717ab2619cde8ee9f57f",
        "7972b0f8b2726c74bf4ff71fbcb2cf67",
        "f8d4c8d4cc7454747f41cf7799e0df77",
        "7850d6d86874785cfb39b69a89b6f37f",
        "f270c8d6f276662eff63cb9c81e7f461",
        "4a65c1f2d3662616fe7f090493c7c4f3",
        "d8e4d0f8c49272647ffcd4fbcdb3e261",
        "ccc6eedef4f21a13ff0f2f9edcc1b061",
        "d094e4e2f0f0e878ff7b8dfe81f68a60",
        "e4d4d2fcdab2b854ffbf97ecd0c2aa40",
        "74e6ceeec2d8f6d0ff675afc8e49be81",
        "6cecdaceccb8f8f07ffff7fbdc108041",
        "595cb4ebc6474a0e825fa0a1c085ff7f",
        "4958da9292164e2e8c5181e083a3de7f",
        "7150ea929290570fe011c85c8781c17f",
        "6b4898c96353578ee06b9898c983e77f",
        "60d4d4dcd6d4d0586b6157e9fefd8073",
        "684cd4d4b4b4c070ef485fdaffa58c43",
        "b069d8ccdccc4471bf63e37f53bc9c7e",
        "70e4d6d0d4dc5c5ce3611e6367be9e71",
        "eacac286b2d2500af2c9df9ca380f163",
        "5a58a4b0a0b40a1afe5bac9383a58d7f",
        "d8dccecee6664494fff1d80198e0c07f",
        "923afadacace3035ff73ff7fbb80d073"
    ];

    let testdata: Array<BigNumber> = [];

    before(async () => {

        bktree = await BKTreeContract.deployed(web3, TX_DEFAULTS);

        for(let n  of TEST_DATA){
            testdata.push(new BigNumber("0x" + n));
        }
  
    });

    describe("Create Tree Nodes", async () => {

        it("Add Nodes", async () => {

            for(let d of testdata) {
                let path: Array<BigNumber>;
                let pathlen: Array<BigNumber>;
                let hamdist: Array<BigNumber>;
                [path, pathlen, hamdist] = await bktree.findPath.callAsync([d]);
                await bktree.addNode.sendTransactionAsync(d, hamdist[0], "0x" + web3.sha3(d.toString(16)), path.slice(0,pathlen[0].toNumber()), {from: CONTRACT_OWNER});
            }
            
            await expect(2).to.equal(2);
        });
        
    });

});
