<img src="https://s3-us-west-2.amazonaws.com/dharma-assets/logo+orange.png"  width=300/>

------------

#### Background
[Collateralized Debt Obligations](https://en.wikipedia.org/wiki/Collateralized_debt_obligation#Subprime_mortgage_boom) (also known as CDOs) have rightfully earned notoriety for the prominent role they played in the subprime mortgage crisis.  Nonetheless, their use is still extremely prevalent today, and they fill an important demand in the structured finance market.  For a lucid, short explanation of the mechanics of a CDO, see [here](https://www.khanacademy.org/economics-finance-domain/core-finance/derivative-securities/cdo-tutorial/v/collateralized-debt-obligation-overview).  One of the most damning diagnoses of the role CDOs played in the subprime mortgage crisis was the opaqueness of the underlying assets -- buyers of such credit products, to a certain extent, had to take rating agencies at their word for their assessment of the assets' solvency.  Enter Dharma Protocol -- with open standards for cryptographic debt assets, we have the ability to create 'Glass CDOs' -- tokenized CDOs where the payout mechanics are powered by a smart contract, and the assets comprising a CDO are fully auditable and transparent on chain.

#### Goal

Build a contract that packages 3 Dharma debt agreements into a two-tranched CDO -- parameters outlined below.  For purposes of this exercise, assume the tranches themselves don't have differing interest rates associated with them.

#### Structure

- **Total CDO Tokens**: 10 Non-Fungible Tokens
- **Senior Tranche**: 6 Non-Fungible Tokens
- **Mezzanine Tranche**: 4 Non-Fungible Tokens

#### Expectations

- [ ] Develop a smart contract in Solidity called `CDO.sol` that encompasses all of the business logic of a 2-tranched CDO containing 3 loans, where the senior tranche is **paid out first** until it's been made whole for 60% of the _total_ principal + interest, and the mezzanine tranche is **paid out second** with the remainder of the principal + interest. As an illustrative example, if the _total_ amount of principal + interest that is expected to flow into a CDO is `$10`, and only `$7` has been repaid, each of the 6 Senior Tranche token holders will be entitled to receive `$1` each, whereas each of the 4 Mezzanine Tranche token holders will be entitled to receive `$0.25` each.  Alternatively, if only `$3` has been repaid, the Senior Tranche token holders will be entitled to `$0.50` each, while the Mezzanine Tranche token holders will be entitled to nothing.  **Make sure you feel 100% comfortable with this concept, and don't be embarassed to ask me for clarifications**.
- [ ] Each tranche should expose the interface defined by [ERC721-compliant non-fungible tokens](https://github.com/ethereum/eips/issues/721).
- [ ] Develop a suite of tests for the above functionality

#### Evaluation Criteria

- Is the CDO functional?  Are payouts handled correctly?
- Is a reasonable degree of testing included?
- Is code readable and clean?
- Are functions properly decomposed such that concerns are separated?

#### Notes and Tips (Read this):

- If you haven't already, I'd recommend reading the [Dharma white paper](https://whitepaper.dharma.io) -- many of the concepts in there are necessary prerequisites for succeeding in this assignment.
- I've included a set of basic tests in `cdo.ts` that should illustrate how to issue debt agreements, transfer debt tokens to different addresses, and make repayments to debt agreements.  These should help you understand how to interact with the Dharma protocol contracts.
- The CDO contract doesn't have to be generic -- it can be specific to the set of loans you're packaging in it.  Feel free to hard-code things like interest rates and expected principal.
- For this specific assignment, don't worry about including metadata in `CDO.sol` relating to the tranches' interest rates and terms -- I mainly care about seeing the redemption functionality work correctly.
- For now, you can hardcode the principal + interest amount for each of the three debt agreements to `1.1 ether` -- if you so please, you can fiddle with these values, but I don't want you to have to get bogged down in the complexity of how to do this.
- Though I only want to see 3 loans packaged into this CDO, **the mechanics you've chosen for handling redemptions should theoretically be able to scale up to 1000s of loans**.  Think carefully about the design decisions you make and their implications on the block gas limit.
- We've already created a generic [non-fungible token implementation](https://github.com/dharmaprotocol/NonFungibleToken) that should prove very useful to you.
- Token holders of both tranches should be able to withdraw whatever amount they are entitled to at **any** time and at **any** order -- _i.e._ in the above example in which `$7` flowed into the CDO, it should not matter at what order senior tranche or mezzanine tranche holders withdraw their payouts (or if they wait until some point in the future in which more repayments have flowed in)
- If you have any questions or issues, don't hesitate to text me at 9492935907 -- no questions will be held against you.  I'd rather we discuss your design decisions before you dive in and go down a path that wastes your time.


### Setup
---------------
##### Dependencies

Install dependencies:
```
yarn
```

##### Testing

Start `testrpc`:
```
yarn chain
```

Run `truffle` tests:
```
yarn test
```
