import {
  AccountUpdate,
  Bool,
  DeployArgs,
  method,
  Permissions,
  PublicKey,
  SmartContract,
  State,
  state,
  VerificationKey,
  UInt64,
  Field,
  Struct,
  Provable,
  TokenId,
} from "o1js";
import {
  FungibleTokenAdminBase,
  FungibleTokenContract,
} from "@silvana-one/token";
import { NFTOwnerBase, TransferExtendedParams } from "../interfaces/index.js";
import { Auction, AuctionFactory } from "./auction.js";
import { mulDiv } from "../util/index.js";

export interface NFTSharesAdminDeployProps
  extends Exclude<DeployArgs, undefined> {
  admin: PublicKey;
  owner: PublicKey; // The owner of the NFT
}

export interface NFTSharesOwnerDeployProps
  extends Exclude<DeployArgs, undefined> {
  admin: PublicKey;
  owner: PublicKey;
  collection: PublicKey;
  nft: PublicKey;
  auction: PublicKey;
  maxBuyPrice: UInt64;
  minSellPrice: UInt64;
  uri: string;
}

export class NFTSharesDataPacked extends Struct({
  adminX: Field,
  ownerX: Field,
  collectionX: Field,
  nftX: Field,
  auctionX: Field,
  data: Field,
}) {}

export class NFTSharesData extends Struct({
  admin: PublicKey,
  owner: PublicKey,
  collection: PublicKey,
  nft: PublicKey,
  auction: PublicKey,
  maxBuyPrice: UInt64,
  minSellPrice: UInt64,
}) {
  pack(): NFTSharesDataPacked {
    const data = Field.fromBits([
      ...this.maxBuyPrice.value.toBits(64),
      ...this.minSellPrice.value.toBits(64),
      this.admin.isOdd,
      this.owner.isOdd,
      this.collection.isOdd,
      this.nft.isOdd,
      this.auction.isOdd,
    ]);
    return new NFTSharesDataPacked({
      adminX: this.admin.x,
      ownerX: this.owner.x,
      collectionX: this.collection.x,
      nftX: this.nft.x,
      auctionX: this.auction.x,
      data,
    });
  }
  static unpack(packed: NFTSharesDataPacked): NFTSharesData {
    const bits = packed.data.toBits(64 + 64 + 5);
    const adminIsOdd = bits[64 + 64];
    const ownerIsOdd = bits[64 + 64 + 1];
    const collectionIsOdd = bits[64 + 64 + 2];
    const nftIsOdd = bits[64 + 64 + 3];
    const auctionIsOdd = bits[64 + 64 + 4];
    const adminX = packed.adminX;
    const ownerX = packed.ownerX;
    const collectionX = packed.collectionX;
    const nftX = packed.nftX;
    const auctionX = packed.auctionX;
    const admin = PublicKey.from({ x: adminX, isOdd: adminIsOdd });
    const owner = PublicKey.from({ x: ownerX, isOdd: ownerIsOdd });
    const collection = PublicKey.from({
      x: collectionX,
      isOdd: collectionIsOdd,
    });
    const nft = PublicKey.from({ x: nftX, isOdd: nftIsOdd });
    const auction = PublicKey.from({ x: auctionX, isOdd: auctionIsOdd });
    const maxBuyPrice = UInt64.Unsafe.fromField(
      Field.fromBits(bits.slice(0, 64))
    );
    const minSellPrice = UInt64.Unsafe.fromField(
      Field.fromBits(bits.slice(64, 64 + 64))
    );
    return new NFTSharesData({
      admin,
      owner,
      collection,
      nft,
      auction,
      maxBuyPrice,
      minSellPrice,
    });
  }
}

export type DefineNFTSharesFactory = (params: {
  auctionContract: () => ReturnType<typeof AuctionFactory>;
}) => ReturnType<typeof NFTSharesFactory>;

export function NFTSharesFactory(params: {
  auctionContract: () => ReturnType<typeof AuctionFactory>;
}) {
  const { auctionContract } = params;

  class NFTSharesAdmin extends SmartContract implements FungibleTokenAdminBase {
    @state(PublicKey) admin = State<PublicKey>();
    @state(PublicKey) owner = State<PublicKey>();

    async deploy(props: NFTSharesAdminDeployProps) {
      await super.deploy(props);
      this.admin.set(props.admin);
      this.owner.set(props.owner);
      this.account.permissions.set({
        ...Permissions.default(),
        setVerificationKey:
          Permissions.VerificationKey.proofDuringCurrentVersion(),
        setPermissions: Permissions.impossible(),
      });
    }

    @method
    async updateVerificationKey(vk: VerificationKey) {
      this.ensureAdminSignature();
      this.account.verificationKey.set(vk);
    }

    ensureAdminSignature(): AccountUpdate {
      const admin = this.admin.getAndRequireEquals();
      return AccountUpdate.createSigned(admin);
    }

    getOwner(): NFTSharesOwner {
      return new NFTSharesOwner(this.owner.getAndRequireEquals());
    }

    @method.returns(Bool)
    public async canMint(_accountUpdate: AccountUpdate) {
      const owner = this.getOwner();
      return await owner.canMint(_accountUpdate);
    }

    @method.returns(Bool)
    public async canChangeAdmin(_admin: PublicKey) {
      this.ensureAdminSignature();
      return Bool(true);
    }

    @method.returns(Bool)
    public async canPause(): Promise<Bool> {
      this.ensureAdminSignature();
      return Bool(true);
    }

    @method.returns(Bool)
    public async canResume(): Promise<Bool> {
      this.ensureAdminSignature();
      return Bool(true);
    }

    @method.returns(Bool)
    public async canChangeVerificationKey(_vk: VerificationKey): Promise<Bool> {
      this.ensureAdminSignature();
      return Bool(true);
    }
  }

  const FungibleToken = FungibleTokenContract(NFTSharesAdmin);

  class NFTSharesOwner extends SmartContract implements NFTOwnerBase {
    /**
     * The public key of the contract's administrator.
     * This account has the authority to perform administrative actions such as pausing the contract or upgrading the verification key.
     */
    @state(NFTSharesDataPacked) data = State<NFTSharesDataPacked>(); // FungibleTokenAdmin
    @state(Bool) subscriptionOpen = State<Bool>(Bool(true));
    @state(UInt64) sharesOutstanding = State<UInt64>(UInt64.zero);

    /**
     * Deploys the contract with initial settings.
     * @param props - Deployment properties including admin, upgradeAuthority, uri, canPause, and isPaused.
     */
    async deploy(props: NFTSharesOwnerDeployProps) {
      await super.deploy(props);
      this.data.set(
        new NFTSharesData({
          admin: props.admin,
          owner: props.owner,
          collection: props.collection,
          nft: props.nft,
          auction: props.auction,
          maxBuyPrice: props.maxBuyPrice,
          minSellPrice: props.minSellPrice,
        }).pack()
      );
      this.account.zkappUri.set(props.uri);
      this.subscriptionOpen.set(Bool(true));
      this.sharesOutstanding.set(UInt64.zero);
      this.account.permissions.set({
        ...Permissions.default(),
        // Allow the upgrade authority to set the verification key even without a protocol upgrade,
        // enabling upgrades in case of o1js breaking changes.
        setVerificationKey:
          Permissions.VerificationKey.proofDuringCurrentVersion(),
        setPermissions: Permissions.impossible(),
      });
    }

    /**
     * Ensures that the transaction is authorized by the contract owner.
     * @returns A signed `AccountUpdate` from the admin.
     */
    ensureOwnerSignature(): NFTSharesData {
      const data = NFTSharesData.unpack(this.data.getAndRequireEquals());
      const adminUpdate = AccountUpdate.createSigned(data.admin);
      adminUpdate.body.useFullCommitment = Bool(true); // Prevent memo and fee change
      return data;
    }

    getAuction(auction: PublicKey) {
      return new (auctionContract())(auction);
    }
    /**
     * Allows the owner to mint shares.
     * This method should NOT called directly, but through the FungibleToken.mint()
     *
     * @param _accountUpdate - The account update containing the sender's information.
     * @returns A boolean indicating if the minting is allowed.
     */
    @method.returns(Bool)
    async canMint(_accountUpdate: AccountUpdate): Promise<Bool> {
      const subscriptionOpen = this.subscriptionOpen.getAndRequireEquals();
      subscriptionOpen.assertEquals(Bool(true), "Subscription is closed");
      const address = _accountUpdate.publicKey;
      const amount = _accountUpdate.balanceChange.magnitude;
      const senderUpdate = AccountUpdate.createSigned(address);
      // 1 share = 1 MINA
      senderUpdate.balance.subInPlace(amount);
      this.balance.addInPlace(amount);
      const sharesOutstanding = this.sharesOutstanding.getAndRequireEquals();
      this.sharesOutstanding.set(sharesOutstanding.add(amount));
      return Bool(true);
    }

    @method
    async withdraw(shares: UInt64) {
      const subscriptionOpen = this.subscriptionOpen.getAndRequireEquals();
      subscriptionOpen.assertEquals(
        Bool(false),
        "Subscription is not closed, cannot withdraw"
      );
      const sharesOutstanding = this.sharesOutstanding.getAndRequireEquals();
      const balance = this.account.balance.getAndRequireEquals();
      balance
        .equals(UInt64.zero)
        .assertFalse("Balance is zero, nothing to withdraw");
      const amountInMina = mulDiv({
        value: shares,
        multiplier: balance,
        denominator: sharesOutstanding,
      }).result;

      const sender = this.sender.getUnconstrained();
      const senderUpdate = AccountUpdate.createSigned(sender);
      senderUpdate.balance.addInPlace(amountInMina);
      this.balance.subInPlace(amountInMina);
      senderUpdate.body.useFullCommitment = Bool(true);
      this.sharesOutstanding.set(sharesOutstanding.sub(shares));
      const data = NFTSharesData.unpack(this.data.getAndRequireEquals());
      const token = new FungibleToken(data.owner);
      await token.burn(sender, shares);
    }

    @method
    async closeSubscription() {
      const data = this.ensureOwnerSignature();
      const maxBuyPrice = data.maxBuyPrice;
      this.account.balance.requireBetween(maxBuyPrice, UInt64.MAXINT());
      this.subscriptionOpen.set(Bool(false));
    }

    @method
    async bid(price: UInt64) {
      const data = NFTSharesData.unpack(this.data.getAndRequireEquals());
      const maxBuyPrice = data.maxBuyPrice;
      price.assertLessThanOrEqual(maxBuyPrice, "Price is too high");
      this.account.balance.requireBetween(price, UInt64.MAXINT());
      this.subscriptionOpen.set(Bool(false));
      const sharesOutstanding = this.sharesOutstanding.getAndRequireEquals();
      const auction = this.getAuction(data.auction);
      const sender = this.sender.getUnconstrained();
      const senderUpdate = AccountUpdate.createSigned(sender);
      const tokenId = TokenId.derive(data.owner);
      const tokenUpdate = AccountUpdate.create(sender, tokenId);
      const tokenBalance = tokenUpdate.account.balance.getAndRequireEquals();
      const token = new FungibleToken(data.owner);
      await token.approveAccountUpdate(tokenUpdate);

      tokenBalance
        .mul(4)
        .assertGreaterThanOrEqual(
          sharesOutstanding,
          "Not enough shares to bid, minimum is 25% of the shares outstanding"
        );

      senderUpdate.balance.addInPlace(price);
      this.balance.subInPlace(price);
      senderUpdate.body.useFullCommitment = Bool(true);
      await auction.bid(price, this.address);
    }

    @method.returns(Bool)
    async canTransfer(params: TransferExtendedParams): Promise<Bool> {
      const data = NFTSharesData.unpack(this.data.getAndRequireEquals());
      params.collection.assertEquals(data.collection);
      params.nft.assertEquals(data.nft);
      const amount = params.price.assertSome();
      amount.assertGreaterThanOrEqual(data.minSellPrice, "Price is too low");
      const sender = this.sender.getUnconstrained();
      const senderUpdate = AccountUpdate.createSigned(sender);
      senderUpdate.balance.subInPlace(amount);
      senderUpdate.body.useFullCommitment = Bool(true);
      this.balance.addInPlace(amount);
      return Bool(true);
    }

    @method.returns(Bool)
    async canPause(collection: PublicKey, nft: PublicKey): Promise<Bool> {
      this.ensureOwnerSignature();
      return Bool(true);
    }

    @method.returns(Bool)
    async canResume(collection: PublicKey, nft: PublicKey): Promise<Bool> {
      this.ensureOwnerSignature();
      return Bool(true);
    }

    @method.returns(Bool)
    async canChangeVerificationKey(
      collection: PublicKey,
      nft: PublicKey,
      vk: VerificationKey
    ): Promise<Bool> {
      this.ensureOwnerSignature();
      return Bool(true);
    }

    @method.returns(Bool)
    async canApproveAddress(
      collection: PublicKey,
      nft: PublicKey,
      approved: PublicKey
    ): Promise<Bool> {
      this.ensureOwnerSignature();
      return Bool(true);
    }
  }

  return {
    NFTSharesAdmin,
    NFTSharesOwner,
    FungibleToken,
  };
}
