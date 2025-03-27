/**
 * The NFT Collection Contract is responsible for managing a collection of NFTs.
 * It handles minting new NFTs, transferring ownership, buying, selling,
 * and interfacing with Admin Contracts for additional functionalities.
 *
 * @module CollectionContract
 */

import {
  Field,
  PublicKey,
  AccountUpdate,
  Bool,
  method,
  state,
  State,
  DeployArgs,
  Permissions,
  TokenContract,
  AccountUpdateForest,
  VerificationKey,
  UInt32,
  UInt64,
  Mina,
  Provable,
} from "o1js";
import { NFT } from "./nft.js";
import {
  MintParams,
  MintRequest,
  TransferBySignatureParams,
  TransferByProofParams,
  CollectionData,
  NFTUpdateProof,
  NFTStateStruct,
  MintEvent,
  NFTUpdateEvent,
  TransferEvent,
  ApproveEvent,
  UpgradeVerificationKeyEvent,
  LimitMintingEvent,
  PauseNFTEvent,
  NFTAdminBase,
  NFTAdminContractConstructor,
  PausableContract,
  PauseEvent,
  SetNameEvent,
  SetBaseURLEvent,
  SetRoyaltyFeeEvent,
  SetTransferFeeEvent,
  SetAdminEvent,
  OwnableContract,
  OwnershipChangeEvent,
  NFTOwnerBase,
  NFTOwnerContractConstructor,
  UInt64Option,
  NFTCollectionBase,
  UpgradeVerificationKeyData,
  NFTApprovalContractConstructor,
  NFTApprovalBase,
  NFTUpdateContractConstructor,
  NFTUpdateBase,
  MAX_ROYALTY_FEE,
  TransferExtendedParams,
} from "../interfaces/index.js";
import { mulDiv } from "../util/index.js";
import { nftVerificationKeys } from "../vk.js";
export { CollectionDeployProps, CollectionFactory, CollectionErrors };

const CollectionErrors = {
  wrongMasterNFTaddress:
    "Master NFT address should be the same as the collection address",
  transferNotAllowed:
    "Transfers of tokens are not allowed, change the owner instead",
  collectionPaused: "Collection is currently paused",
  cannotMintMasterNFT: "Only the creator can mint the Master NFT",
  cannotMint: "Admin contract did not provide permission to mint",
  noPermissionToPause: "Not allowed to pause collection",
  noPermissionToResume: "Not allowed to resume collection",
  collectionNotPaused: "Collection is not paused",
  transferApprovalRequired: "Transfer approval is required",
  noPermissionToChangeName: "Not allowed to change collection name",
  noPermissionToChangeBaseUri: "Not allowed to change collection base URI",
  noPermissionToChangeCreator: "Not allowed to change collection creator",
  noPermissionToChangeRoyalty: "Not allowed to change royalty fee",
  noPermissionToChangeTransferFee: "Not allowed to change transfer fee",
  noPermissionToSetAdmin: "Not allowed to set admin contract",
  cannotUpgradeVerificationKey: "Cannot upgrade verification key",
  upgradeContractAddressNotSet: "Upgrade contract address is not set",
  adminContractAddressNotSet: "Admin contract address is not set",
  onlyOwnerCanUpgradeVerificationKey: "Only owner can upgrade verification key",
  invalidRoyaltyFee: "Royalty fee is too high, cannot be more than 100%",
  invalidOracleAddress: "Oracle address is invalid",
};

interface CollectionDeployProps extends Exclude<DeployArgs, undefined> {
  collectionName: Field;
  creator: PublicKey;
  admin: PublicKey;
  baseURL: Field;
  symbol: string;
  url: string;
}

/**
 * Creates a new NFT Collection Contract class.
 *
 * @param params - Constructor parameters including admin and upgrade contracts, and network ID.
 * @returns The Collection class extending TokenContract and implementing required interfaces.
 */
function CollectionFactory(params: {
  adminContract: () => NFTAdminContractConstructor;
  ownerContract: () => NFTOwnerContractConstructor;
  approvalContract: () => NFTApprovalContractConstructor;
  updateContract: () => NFTUpdateContractConstructor;
}) {
  const { adminContract, ownerContract, approvalContract, updateContract } =
    params;

  /**
   * The NFT Collection Contract manages a collection of NFTs.
   * It handles minting, transferring, buying, selling, and integrates with Admin Contracts.
   */
  class Collection
    extends TokenContract
    implements OwnableContract, PausableContract, NFTCollectionBase
  {
    /** The name of the NFT collection. */
    @state(Field) collectionName = State<Field>();
    /** The public key of the creator of the collection. */
    @state(PublicKey) creator = State<PublicKey>();
    /** The public key of the Admin Contract. */
    @state(PublicKey) admin = State<PublicKey>();
    /** The base URL for the metadata of the NFTs in the collection. */
    @state(Field) baseURL = State<Field>();
    /**
     * A packed data field containing additional collection parameters,
     * such as flags and fee configurations.
     */
    @state(Field) packedData = State<Field>();

    /**
     * Deploys the NFT Collection Contract with the initial settings.
     *
     * @param props - Deployment properties including collection name, creator, admin, baseURL, symbol, and URL.
     */
    async deploy(props: CollectionDeployProps): Promise<void> {
      await super.deploy(props);
      this.collectionName.set(props.collectionName);
      this.creator.set(props.creator);
      this.admin.set(props.admin);
      this.baseURL.set(props.baseURL);
      // Set the collection to be paused by default
      this.packedData.set(
        CollectionData.new({
          isPaused: true,
        }).pack()
      );
      this.account.zkappUri.set(props.url);
      this.account.tokenSymbol.set(props.symbol);
      this.account.permissions.set({
        ...Permissions.default(),
        setVerificationKey:
          Permissions.VerificationKey.proofDuringCurrentVersion(),
        setPermissions: Permissions.impossible(),
        access: Permissions.proof(),
        send: Permissions.proof(),
        setZkappUri: Permissions.proof(),
        setTokenSymbol: Permissions.proof(),
      });
    }

    /**
     * Initializes the collection with a master NFT and initial data.
     *
     * @param masterNFT - The master NFT parameters.
     * @param collectionData - Initial collection data including flags and configurations.
     */
    @method
    async initialize(masterNFT: MintParams, collectionData: CollectionData) {
      this.account.provedState.requireEquals(Bool(false));
      collectionData.royaltyFee.assertLessThanOrEqual(
        UInt32.from(MAX_ROYALTY_FEE),
        CollectionErrors.invalidRoyaltyFee
      );
      this.packedData.set(collectionData.pack());
      masterNFT.address
        .equals(this.address)
        .assertTrue(CollectionErrors.wrongMasterNFTaddress);
      await this._mint(masterNFT);
    }

    /**
     * Defines the events emitted by the contract.
     */
    events = {
      mint: MintEvent,
      update: NFTUpdateEvent,
      transfer: TransferEvent,
      approve: ApproveEvent,
      upgradeNFTVerificationKey: UpgradeVerificationKeyEvent,
      upgradeVerificationKey: UpgradeVerificationKeyEvent,
      limitMinting: LimitMintingEvent,
      pause: PauseEvent,
      resume: PauseEvent,
      pauseNFT: PauseNFTEvent,
      resumeNFT: PauseNFTEvent,
      ownershipChange: OwnershipChangeEvent,
      setName: SetNameEvent,
      setBaseURL: SetBaseURLEvent,
      setRoyaltyFee: SetRoyaltyFeeEvent,
      setTransferFee: SetTransferFeeEvent,
      setAdmin: SetAdminEvent,
    };

    /**
     * Overrides the approveBase method to prevent transfers of tokens.
     *
     * @param forest - The account update forest.
     */
    async approveBase(forest: AccountUpdateForest) {
      throw Error(CollectionErrors.transferNotAllowed);
    }

    /**
     * Retrieves the Admin Contract instance.
     *
     * @returns The Admin Contract instance implementing NFTAdminBase.
     */
    getAdminContract(): NFTAdminBase {
      const admin = this.admin.getAndRequireEquals();
      const AdminContract = adminContract();
      return new AdminContract(admin);
    }

    /**
     * Retrieves the NFT Owner Contract instance.
     *
     * @returns The Owner Contract instance implementing NFTOwnerBase.
     */
    getOwnerContract(address: PublicKey): NFTOwnerBase {
      const OwnerContract = ownerContract();
      return new OwnerContract(address);
    }

    /**
     * Retrieves the NFT Approval Contract instance.
     *
     * @returns The Approval Contract instance implementing NFTApprovalBase.
     */
    getApprovalContract(address: PublicKey): NFTApprovalBase {
      const ApprovalContract = approvalContract();
      return new ApprovalContract(address);
    }

    /**
     * Retrieves the NFT Update Contract instance.
     *
     * @returns The Update Contract instance implementing NFTUpdateBase.
     */
    getUpdateContract(address: PublicKey): NFTUpdateBase {
      const UpdateContract = updateContract();
      return new UpdateContract(address);
    }

    /**
     * Ensures that the transaction is authorized by the creator.
     *
     * @returns The AccountUpdate of the creator.
     */
    async ensureCreatorSignature(): Promise<AccountUpdate> {
      const creator = this.creator.getAndRequireEquals();
      const creatorUpdate = AccountUpdate.createSigned(creator);
      creatorUpdate.body.useFullCommitment = Bool(true); // Prevent memo and fee change
      return creatorUpdate;
    }

    /**
     * Ensures that the transaction is authorized by the NFT owner
     *
     * @returns The AccountUpdate of the NFT owner.
     */
    async ensureOwnerSignature(owner: PublicKey): Promise<AccountUpdate> {
      const ownerUpdate = AccountUpdate.createSigned(owner);
      ownerUpdate.body.useFullCommitment = Bool(true); // Prevent memo and fee change
      return ownerUpdate;
    }

    /**
     * Ensures that the collection is not paused.
     *
     * @returns The packed data of the collection.
     */
    async ensureNotPaused(): Promise<CollectionData> {
      const collectionData = CollectionData.unpack(
        this.packedData.getAndRequireEquals()
      );
      collectionData.isPaused.assertFalse(CollectionErrors.collectionPaused);
      return collectionData;
    }

    /**
     * Mints a new NFT directly by the creator.
     *
     * This method allows the creator of the collection to mint an NFT without requiring approval
     * from the admin contract. It ensures that the collection is not paused and that the caller
     * is the creator of the collection. A fee of 1 MINA is deducted from the creator's balance
     * to cover the cost of creating a new account.
     *
     * We do not constrain here the address of the NFT to allow for the Master NFT to be minted.
     * The Master NFT is the NFT with the same address as the Collection contract and it holds
     * the metadata for the collection. It can be minted only by the creator of the collection.
     *
     * @param params - The mint parameters containing details of the NFT to be minted.
     */

    @method async mintByCreator(params: MintParams): Promise<void> {
      const collectionData = await this.ensureNotPaused();
      collectionData.mintingIsLimited.assertFalse(CollectionErrors.cannotMint);
      const creatorUpdate = await this.ensureCreatorSignature();
      // Pay 1 MINA fee for a new account
      creatorUpdate.balance.subInPlace(1_000_000_000);
      await this._mint(params);
    }

    /**
     * Mints a new NFT with approval.
     *
     * @param mintRequest - The minting request containing parameters and proofs.
     */
    @method async mint(mintRequest: MintRequest): Promise<void> {
      const collectionData = await this.ensureNotPaused();
      collectionData.mintingIsLimited.assertFalse(CollectionErrors.cannotMint);
      const adminContract = this.getAdminContract();
      // The admin contract checks that the sender is allowed to mint
      const mintParams = (await adminContract.canMint(mintRequest)).assertSome(
        CollectionErrors.cannotMint
      );
      mintParams.address.assertEquals(mintRequest.address);
      mintParams.data.owner.assertEquals(mintRequest.owner);

      // Prevent minting the Master NFT using this method
      mintParams.address
        .equals(this.address)
        .assertFalse(CollectionErrors.cannotMintMasterNFT);
      await this._mint(mintParams);
    }

    /**
     * Internal method to mint an NFT.
     *
     * @param params - The mint parameters.
     * @param collectionData - The current collection data.
     * @returns The MintEvent emitted.
     */
    async _mint(params: MintParams): Promise<MintEvent> {
      const {
        name,
        address,
        data,
        metadata,
        storage,
        metadataVerificationKeyHash,
        expiry,
        fee,
        tokenId,
      } = params;

      this.network.globalSlotSinceGenesis.requireBetween(UInt32.zero, expiry);
      data.version.assertEquals(UInt64.zero);
      data.isPaused
        .equals(Bool(false))
        .or(data.canPause.equals(Bool(true)))
        .assertTrue(CollectionErrors.cannotMint);
      const packedData = data.pack();
      const collectionTokenId = this.deriveTokenId();
      collectionTokenId.assertEquals(tokenId);

      const update = AccountUpdate.createSigned(address, tokenId);
      update.body.useFullCommitment = Bool(true); // Prevent memo and fee change
      update.account.isNew.getAndRequireEquals().assertTrue();

      // Mint 1 NFT
      this.internal.mint({ address: update, amount: 1_000_000_000 });

      const verificationKey: VerificationKey = Provable.witness(
        VerificationKey,
        () => {
          // This code does NOT create a constraint on the verification key
          // as this witness can be replaced during runtime
          // We use devnet to get future compatibility https://github.com/o1-labs/o1js/pull/1938
          // As of writing this, 'testnet' is used in the o1js codebase
          const networkId =
            Mina.getNetworkId() === "mainnet" ? "mainnet" : "devnet";
          const verificationKey = new VerificationKey({
            data: nftVerificationKeys[networkId].vk.NFT.data,
            hash: Field(nftVerificationKeys[networkId].vk.NFT.hash),
          });
          const vkHash = NFT._verificationKey?.hash;
          if (
            !verificationKey ||
            !verificationKey.hash ||
            !verificationKey.data
          )
            throw Error("NFT verification key is incorrect");
          if (
            vkHash &&
            vkHash.equals(verificationKey.hash).toBoolean() === false
          )
            throw Error(
              "NFT verification key does not match the compiled verification key"
            );
          return verificationKey;
        }
      );

      const mainnetVerificationKeyHash = Field(
        nftVerificationKeys.mainnet.vk.NFT.hash
      );
      const devnetVerificationKeyHash = Field(
        nftVerificationKeys.devnet.vk.NFT.hash
      );
      // We check that the verification key hash is the same as the one
      // that was compiled at the time of the collection deployment
      if (Mina.getNetworkId() === "mainnet") {
        verificationKey.hash.assertEquals(mainnetVerificationKeyHash);
      } else {
        verificationKey.hash.assertEquals(devnetVerificationKeyHash);
      }
      update.body.update.verificationKey = {
        isSome: Bool(true),
        value: verificationKey,
      };
      update.body.update.permissions = {
        isSome: Bool(true),
        value: {
          ...Permissions.default(),
          // NFT cannot be sent to other accounts, only owner can be changed
          send: Permissions.impossible(),
          // Allow the upgrade authority to set the verification key
          // even when there is no protocol upgrade
          setVerificationKey:
            Permissions.VerificationKey.proofDuringCurrentVersion(),
          setPermissions: Permissions.impossible(),
          access: Permissions.proof(),
          setZkappUri: Permissions.impossible(),
          setTokenSymbol: Permissions.impossible(),
        },
      };
      const initialState = new NFTStateStruct({
        name,
        metadata,
        storage,
        packedData,
        metadataVerificationKeyHash,
      });

      update.body.update.appState = NFTStateStruct.toFields(initialState).map(
        (field) => ({
          isSome: Bool(true),
          value: field,
        })
      );
      const event = new MintEvent({
        initialState,
        address,
        tokenId,
        fee,
      });
      this.emitEvent("mint", event);
      return event;
    }

    /**
     * Updates the NFT with admin approval.
     *
     * @param proof - The proof of the NFT update.
     * @param vk - The verification key.
     */
    @method async update(
      proof: NFTUpdateProof,
      vk: VerificationKey
    ): Promise<void> {
      // The oracle address is optional and can be empty, NFT ZkProgram can verify the address
      // as it can be different for different NFTs. It should be empty for the update() call
      const oracleAddress = proof.publicInput.oracleAddress;
      oracleAddress
        .equals(PublicKey.empty())
        .assertTrue(CollectionErrors.invalidOracleAddress);
      await this._update(proof, vk);
    }

    /**
     * Updates the NFT with admin approval and oracle approval.
     *
     * @param proof - The proof of the NFT update.
     * @param vk - The verification key.
     */
    @method async updateWithOracle(
      proof: NFTUpdateProof,
      vk: VerificationKey
    ): Promise<void> {
      // The oracle address is optional and can be empty, NFT ZkProgram can verify the address
      // as it can be different for different NFTs. It should be non-empty for the updateWithOracle() call
      const oracleAddress = proof.publicInput.oracleAddress;
      oracleAddress
        .equals(PublicKey.empty())
        .assertFalse(CollectionErrors.invalidOracleAddress);
      const oracle = this.getUpdateContract(oracleAddress);
      const canUpdate = await oracle.canUpdate(
        this.address,
        proof.publicInput.immutableState.address,
        proof.publicInput,
        proof.publicOutput
      );
      canUpdate.assertTrue();
      await this._update(proof, vk);
    }

    /**
     * Updates the NFT with admin approval - internal method.
     *
     * @param proof - The proof of the NFT update.
     * @param vk - The verification key.
     */
    async _update(proof: NFTUpdateProof, vk: VerificationKey): Promise<void> {
      await this.ensureNotPaused();

      const adminContract = this.getAdminContract();
      const canUpdate = await adminContract.canUpdate(
        proof.publicInput,
        proof.publicOutput
      );
      canUpdate.assertTrue();

      const creator = this.creator.getAndRequireEquals();
      creator.assertEquals(proof.publicInput.creator);
      const tokenId = this.deriveTokenId();
      tokenId.assertEquals(proof.publicInput.immutableState.tokenId);

      const nft = new NFT(proof.publicInput.immutableState.address, tokenId);
      const metadataVerificationKeyHash = await nft.update(
        proof.publicInput,
        proof.publicOutput,
        creator
      );

      // Verify the metadata update proof
      metadataVerificationKeyHash.assertEquals(vk.hash);
      proof.verify(vk);
      this.emitEvent(
        "update",
        new NFTUpdateEvent({
          address: proof.publicInput.immutableState.address,
        })
      );
    }

    /**
     * Approves an address to transfer an NFT.
     *
     * @param nftAddress - The address of the NFT.
     * @param approved - The approved public key.
     */
    @method async approveAddress(
      nftAddress: PublicKey,
      approved: PublicKey
    ): Promise<void> {
      await this.ensureNotPaused();
      const tokenId = this.deriveTokenId();
      const nft = new NFT(nftAddress, tokenId);
      const owner = await nft.approveAddress(approved);
      await this.ensureOwnerSignature(owner);
      this.emitEvent("approve", new ApproveEvent({ nftAddress, approved }));
    }

    /**
     * Transfers ownership of an NFT without admin approval.
     *
     * @param nftAddress - The address of the NFT.
     * @param approved - The approved public key.
     */
    @method async approveAddressByProof(
      nftAddress: PublicKey,
      approved: PublicKey
    ): Promise<void> {
      await this.ensureNotPaused();
      const tokenId = this.deriveTokenId();
      const nft = new NFT(nftAddress, tokenId);
      const owner = await nft.approveAddress(approved);
      const ownerContract = this.getOwnerContract(owner);
      const canApprove = await ownerContract.canApproveAddress(
        this.address,
        nftAddress,
        approved
      );
      canApprove.assertTrue();
      this.emitEvent("approve", new ApproveEvent({ nftAddress, approved }));
    }

    /**
     * Transfers ownership of an NFT without admin approval.
     * This method should be used by wallets for collections that do not require transfer approval
     * and the owners of the NFTs which approve the transfer by signature
     *
     * @param address - The address of the NFT.
     * @param to - The recipient's public key.
     * @param price - The price of the NFT (optional).
     */
    @method async transferBySignature(
      params: TransferBySignatureParams
    ): Promise<void> {
      const { address, to, price, context } = params;
      const collectionData = await this.ensureNotPaused();
      collectionData.requireTransferApproval.assertFalse(
        CollectionErrors.transferApprovalRequired
      );

      const transferEventDraft = new TransferExtendedParams({
        from: PublicKey.empty(), // will be added later
        to,
        collection: this.address,
        nft: address,
        fee: UInt64Option.none(), // will be added later
        price,
        transferByOwner: Bool(false), // will be added later
        approved: PublicKey.empty(), // will be added later
        context,
      });
      await this._transfer({
        transferEventDraft,
        transferFee: collectionData.transferFee,
        royaltyFee: collectionData.royaltyFee,
      });
    }

    /**
     * Transfers ownership of an NFT using a proof in case the owner is a contract
     * Can be called by the owner or approved that should be a contracts
     * supporting NFTApprovalBase interface
     *
     * @param params - The transfer parameters.
     */
    @method async transferByProof(
      params: TransferByProofParams
    ): Promise<void> {
      const { address, from, to, price, context } = params;
      const collectionData = await this.ensureNotPaused();
      collectionData.requireTransferApproval.assertFalse(
        CollectionErrors.transferApprovalRequired
      );

      const transferEventDraft = new TransferExtendedParams({
        from,
        to,
        collection: this.address,
        nft: address,
        fee: UInt64Option.none(), // will be added later
        price,
        transferByOwner: Bool(false), // will be added later
        approved: PublicKey.empty(), // will be added later
        context,
      });
      const transferEvent = await this._transfer({
        transferEventDraft,
        transferFee: collectionData.transferFee,
        royaltyFee: collectionData.royaltyFee,
      });
      const approvalContract = this.getApprovalContract(from);
      // This operation is not atomic and the owner or approval contract cannot rely on the fact
      // that it is being called by the Collection contract
      // It is the responsibility of the owner contract to maintain the state
      // that allow for escrow-like agreement between the buyer and the seller
      // in case of the selling and buying of the NFT and return 'true' only if the
      // payment is made or guaranteed by the deposit of the funds in the owner contract
      // or the owner contract is able to verify that it is being called by the Collection contract
      // by setting the flag in its state as in the Offer contract example
      const canTransfer = await approvalContract.canTransfer(transferEvent);
      canTransfer.assertTrue();
    }

    /**
     * Transfers ownership of an NFT using a proof in case the owner is a contract
     * Can be called by the owner or approved that should be a contracts
     * supporting NFTApprovalBase interface
     *
     * @param params - The transfer parameters.
     */
    @method async adminApprovedTransferByProof(
      params: TransferByProofParams
    ): Promise<void> {
      const { address, from, to, price, context } = params;
      const collectionData = await this.ensureNotPaused();

      const transferEventDraft = new TransferExtendedParams({
        from,
        to,
        collection: this.address,
        nft: address,
        fee: UInt64Option.none(), // will be added later
        price,
        transferByOwner: Bool(false), // will be added later
        approved: PublicKey.empty(), // will be added later
        context,
      });
      const transferEvent = await this._transfer({
        transferEventDraft,
        transferFee: collectionData.transferFee,
        royaltyFee: collectionData.royaltyFee,
      });

      const adminContract = this.getAdminContract();
      const adminApprovedTransfer = await adminContract.canTransfer(
        transferEvent
      );
      adminApprovedTransfer.assertTrue();

      const approvalContract = this.getApprovalContract(from);
      // This operation is not atomic and the owner or approval contract cannot rely on the fact
      // that it is being called by the Collection contract
      // It is the responsibility of the owner contract to maintain the state
      // that allow for escrow-like agreement between the buyer and the seller
      // in case of the selling and buying of the NFT and return 'true' only if the
      // payment is made or guaranteed by the deposit of the funds in the owner contract
      // or the owner contract is able to verify that it is being called by the Collection contract
      // by setting the flag in its state as in the Offer contract example
      const canTransfer = await approvalContract.canTransfer(transferEvent);
      canTransfer.assertTrue();
    }

    /**
     * Transfers ownership of an NFT with admin approval.
     *
     * @param address - The address of the NFT.
     * @param to - The recipient's public key.
     * @param price - The price of the NFT (optional).
     */
    @method async adminApprovedTransferBySignature(
      params: TransferBySignatureParams
    ): Promise<void> {
      const { address, to, price, context } = params;
      const collectionData = await this.ensureNotPaused();

      const transferEventDraft = new TransferExtendedParams({
        from: PublicKey.empty(), // will be added later
        to,
        collection: this.address,
        nft: address,
        fee: UInt64Option.none(), // will be added later
        price,
        transferByOwner: Bool(false), // will be added later
        approved: PublicKey.empty(), // will be added later
        context,
      });
      const transferEvent = await this._transfer({
        transferEventDraft,
        transferFee: collectionData.transferFee,
        royaltyFee: collectionData.royaltyFee,
      });
      const adminContract = this.getAdminContract();
      const canTransfer = await adminContract.canTransfer(transferEvent);
      canTransfer.assertTrue();
    }

    /**
     * Internal method to transfer an NFT.
     *
     * This method handles the transfer logic and fee calculation. The fee is determined as follows:
     * - If a price is provided, the fee is calculated as (price * royaltyFee / MAX_ROYALTY_FEE)
     * - If no price is provided, the fixed transferFee is used to handle two cases:
     *  when NFT is being sold and the price is not provided to the contract
     *  when NFT is being transferred by the owner (without price)
     * - If the sender is the creator, no fee is charged
     * - The minimum fee is always the transferFee (unless sender is creator)
     *
     * @param transferEventDraft - The transfer event draft, containing the information about the transfer
     * @param transferFee - The transfer fee amount.
     * @param royaltyFee - The royalty fee amount.
     * @returns The TransferEvent emitted.
     */
    async _transfer(params: {
      transferEventDraft: TransferExtendedParams;
      transferFee: UInt64;
      royaltyFee: UInt32;
    }): Promise<TransferExtendedParams> {
      const { transferEventDraft, transferFee, royaltyFee } = params;
      const sender = this.sender.getUnconstrained();
      // If the from is empty, we set the sender as the from and require signature from the sender
      const isFromEmpty = transferEventDraft.from.equals(PublicKey.empty());
      transferEventDraft.from = Provable.if(
        isFromEmpty,
        sender,
        transferEventDraft.from
      );

      const tokenId = this.deriveTokenId();
      const nft = new NFT(transferEventDraft.nft, tokenId);
      const transferEvent = await nft.transfer(transferEventDraft);
      const creator = this.creator.getAndRequireEquals();
      let fee = Provable.if(
        transferEventDraft.price.isSome,
        // We cannot check the price here, so we just rely on owner contract
        // Malicious owner contracts can be blocked by the admin contract
        // or by setting the transfer fee to a higher value reflecting the market price
        mulDiv({
          value: transferEventDraft.price.value,
          multiplier: UInt64.from(royaltyFee),
          denominator: UInt64.from(MAX_ROYALTY_FEE),
        }).result,
        transferFee
      );

      const isOwnedByCreator = transferEvent.from.equals(creator);
      fee = Provable.if(
        isOwnedByCreator,
        UInt64.zero,
        // The minimum fee is the transfer fee
        Provable.if(fee.lessThanOrEqual(transferFee), transferFee, fee)
      );
      const senderUpdate = AccountUpdate.createIf(
        fee.equals(UInt64.zero).not().or(isFromEmpty),
        sender
      );
      senderUpdate.requireSignature();
      senderUpdate.body.useFullCommitment = Bool(true); // Prevent memo and fee change
      senderUpdate.account.balance.requireBetween(fee, UInt64.MAXINT());

      senderUpdate.send({
        to: this.creator.getAndRequireEquals(),
        amount: fee,
      });

      transferEvent.fee = UInt64Option.fromValue({
        value: fee,
        isSome: fee.equals(UInt64.zero).not(),
      });
      this.emitEvent(
        "transfer",
        new TransferEvent({
          ...transferEvent,
        })
      );
      return transferEvent;
    }

    /**
     * Upgrades the verification key of a specific NFT.
     *
     * @param address - The address of the NFT.
     * @param vk - The new verification key.
     */
    @method
    async upgradeNFTVerificationKeyBySignature(
      address: PublicKey,
      vk: VerificationKey
    ): Promise<void> {
      await this.ensureNotPaused();
      const sender = this.sender.getAndRequireSignature();
      const data = await this._upgrade(address, vk);
      data.owner
        .equals(sender)
        .or(data.isOwnerApprovalRequired.not())
        .assertTrue(CollectionErrors.onlyOwnerCanUpgradeVerificationKey);
    }

    /**
     * Upgrades the verification key of a specific NFT by Proof.
     *
     * @param address - The address of the NFT.
     * @param vk - The new verification key.
     */
    @method
    async upgradeNFTVerificationKeyByProof(
      address: PublicKey,
      vk: VerificationKey
    ): Promise<void> {
      await this.ensureNotPaused();
      const data = await this._upgrade(address, vk);
      const ownerContract = this.getOwnerContract(data.owner);
      const canUpgrade = await ownerContract.canChangeVerificationKey(
        this.address,
        address,
        vk
      );
      canUpgrade.assertTrue();
    }

    async _upgrade(
      address: PublicKey,
      vk: VerificationKey
    ): Promise<UpgradeVerificationKeyData> {
      const tokenId = this.deriveTokenId();
      const nft = new NFT(address, tokenId);
      const adminContract = this.getAdminContract();
      const canUpgrade = await adminContract.canChangeVerificationKey(
        vk,
        address,
        tokenId
      );
      canUpgrade.assertTrue(CollectionErrors.cannotUpgradeVerificationKey);

      const data = await nft.upgradeVerificationKey(vk);

      const event = new UpgradeVerificationKeyEvent({
        address,
        tokenId,
        verificationKeyHash: vk.hash,
      });
      this.emitEvent("upgradeNFTVerificationKey", event);
      return data;
    }

    /**
     * Upgrades the verification key of the collection contract.
     *
     * @param vk - The new verification key.
     */
    @method
    async upgradeVerificationKey(vk: VerificationKey): Promise<void> {
      await this.ensureNotPaused();
      const adminContract = this.getAdminContract();
      const canUpgrade = await adminContract.canChangeVerificationKey(
        vk,
        this.address,
        this.tokenId
      );
      canUpgrade.assertTrue(CollectionErrors.cannotUpgradeVerificationKey);
      this.account.verificationKey.set(vk);

      this.emitEvent(
        "upgradeVerificationKey",
        new UpgradeVerificationKeyEvent({
          address: this.address,
          tokenId: this.tokenId,
          verificationKeyHash: vk.hash,
        })
      );
    }

    /**
     * Limits further minting of NFTs in the collection.
     */
    @method
    async limitMinting(): Promise<void> {
      await this.ensureCreatorSignature();
      const collectionData = await this.ensureNotPaused();
      collectionData.mintingIsLimited = Bool(true);
      this.packedData.set(collectionData.pack());
      this.emitEvent(
        "limitMinting",
        new LimitMintingEvent({ mintingLimited: Bool(true) })
      );
    }

    /**
     * Pauses the collection, disabling certain actions.
     */
    @method
    async pause(): Promise<void> {
      const collectionData = await this.ensureNotPaused();
      const adminContract = this.getAdminContract();
      const canPause = await adminContract.canPause();
      canPause.assertTrue(CollectionErrors.noPermissionToPause);
      collectionData.isPaused = Bool(true);
      this.packedData.set(collectionData.pack());
      this.emitEvent("pause", new PauseEvent({ isPaused: Bool(true) }));
    }

    /**
     * Resumes the collection, re-enabling actions.
     */
    @method
    async resume(): Promise<void> {
      const collectionData = CollectionData.unpack(
        this.packedData.getAndRequireEquals()
      );
      collectionData.isPaused.assertTrue(CollectionErrors.collectionNotPaused);
      const adminContract = this.getAdminContract();
      const canResume = await adminContract.canResume();
      canResume.assertTrue(CollectionErrors.noPermissionToResume);
      collectionData.isPaused = Bool(false);
      this.packedData.set(collectionData.pack());
      this.emitEvent("resume", new PauseEvent({ isPaused: Bool(false) }));
    }

    /**
     * Pauses a specific NFT, disabling its actions.
     *
     * @param address - The address of the NFT to pause.
     */
    @method
    async pauseNFTBySignature(address: PublicKey): Promise<void> {
      await this.ensureNotPaused();
      const tokenId = this.deriveTokenId();
      const nft = new NFT(address, tokenId);
      const owner = await nft.pause();
      await this.ensureOwnerSignature(owner);
      this.emitEvent(
        "pauseNFT",
        new PauseNFTEvent({ isPaused: Bool(true), address })
      );
    }

    /**
     * Pauses a specific NFT, disabling its actions.
     *
     * @param address - The address of the NFT to pause.
     */
    @method
    async pauseNFTByProof(address: PublicKey): Promise<void> {
      await this.ensureNotPaused();
      const tokenId = this.deriveTokenId();
      const nft = new NFT(address, tokenId);
      const owner = await nft.pause();
      const ownerContract = this.getOwnerContract(owner);
      const canPause = await ownerContract.canPause(this.address, address);
      canPause.assertTrue();
      this.emitEvent(
        "pauseNFT",
        new PauseNFTEvent({ isPaused: Bool(true), address })
      );
    }

    /**
     * Resumes a specific NFT, re-enabling its actions.
     *
     * @param address - The address of the NFT to resume.
     */
    @method
    async resumeNFT(address: PublicKey): Promise<void> {
      await this.ensureNotPaused();
      const tokenId = this.deriveTokenId();
      const nft = new NFT(address, tokenId);
      const owner = await nft.resume();
      await this.ensureOwnerSignature(owner);
      this.emitEvent(
        "resumeNFT",
        new PauseNFTEvent({ isPaused: Bool(false), address })
      );
    }

    /**
     * Resumes a specific NFT, re-enabling its actions.
     *
     * @param address - The address of the NFT to resume.
     */
    @method
    async resumeNFTByProof(address: PublicKey): Promise<void> {
      await this.ensureNotPaused();
      const tokenId = this.deriveTokenId();
      const nft = new NFT(address, tokenId);
      const owner = await nft.resume();
      const ownerContract = this.getOwnerContract(owner);
      const canResume = await ownerContract.canResume(this.address, address);
      canResume.assertTrue();
      this.emitEvent(
        "resumeNFT",
        new PauseNFTEvent({ isPaused: Bool(false), address })
      );
    }

    /**
     * Sets a new name for the collection.
     * Requires owner signature and collection to not be paused.
     * Emits a 'setName' event with the new name.
     *
     * @param name - The new name for the collection as a Field value
     * @throws {Error} If caller lacks permission to change name
     */
    @method
    async setName(name: Field): Promise<void> {
      await this.ensureNotPaused();
      const adminContract = this.getAdminContract();
      const canChangeName = await adminContract.canChangeName(name);
      canChangeName.assertTrue(CollectionErrors.noPermissionToChangeName);
      this.collectionName.set(name);
      this.emitEvent("setName", new SetNameEvent({ name }));
    }

    /**
     * Updates the base URL for the collection's metadata.
     * Requires owner signature and collection to not be paused.
     * Emits a 'setBaseURL' event with the new URL.
     *
     * @param baseURL - The new base URL as a Field value
     * @throws {Error} If caller lacks permission to change base URI
     */
    @method
    async setBaseURL(baseURL: Field): Promise<void> {
      await this.ensureNotPaused();
      const adminContract = this.getAdminContract();
      const canChangeBaseUri = await adminContract.canChangeBaseUri(baseURL);
      canChangeBaseUri.assertTrue(CollectionErrors.noPermissionToChangeBaseUri);
      this.baseURL.set(baseURL);
      this.emitEvent("setBaseURL", new SetBaseURLEvent({ baseURL }));
    }

    /**
     * Sets a new admin address for the collection.
     * Requires owner signature and collection to not be paused.
     * Emits a 'setAdmin' event with the new admin address.
     *
     * @param admin - The public key of the new admin
     * @throws {Error} If caller lacks permission to set admin
     */
    @method
    async setAdmin(admin: PublicKey): Promise<void> {
      await this.ensureNotPaused();
      const adminContract = this.getAdminContract();
      const canSetAdmin = await adminContract.canSetAdmin(admin);
      canSetAdmin.assertTrue(CollectionErrors.noPermissionToSetAdmin);
      this.admin.set(admin);
      this.emitEvent("setAdmin", new SetAdminEvent({ admin }));
    }

    /**
     * Updates the royalty fee for the collection.
     * Requires owner signature and collection to not be paused.
     * Emits a 'setRoyaltyFee' event with the new fee.
     *
     * @param royaltyFee - The new royalty fee as a UInt32 value
     * @throws {Error} If caller lacks permission to change royalty fee
     */
    @method
    async setRoyaltyFee(royaltyFee: UInt32): Promise<void> {
      const collectionData = await this.ensureNotPaused();
      royaltyFee.assertLessThanOrEqual(
        UInt32.from(MAX_ROYALTY_FEE),
        CollectionErrors.invalidRoyaltyFee
      );
      const adminContract = this.getAdminContract();
      const canChangeRoyalty = await adminContract.canChangeRoyalty(royaltyFee);
      canChangeRoyalty.assertTrue(CollectionErrors.noPermissionToChangeRoyalty);
      collectionData.royaltyFee = royaltyFee;
      this.packedData.set(collectionData.pack());
      this.emitEvent("setRoyaltyFee", new SetRoyaltyFeeEvent({ royaltyFee }));
    }

    /**
     * Updates the transfer fee for the collection.
     * Requires owner signature and collection to not be paused.
     * Emits a 'setTransferFee' event with the new fee.
     *
     * @param transferFee - The new transfer fee as a UInt64 value
     * @throws {Error} If caller lacks permission to change transfer fee
     */
    @method
    async setTransferFee(transferFee: UInt64): Promise<void> {
      const collectionData = await this.ensureNotPaused();
      const adminContract = this.getAdminContract();
      const canChangeTransferFee = await adminContract.canChangeTransferFee(
        transferFee
      );
      canChangeTransferFee.assertTrue(
        CollectionErrors.noPermissionToChangeTransferFee
      );
      collectionData.transferFee = transferFee;
      this.packedData.set(collectionData.pack());
      this.emitEvent(
        "setTransferFee",
        new SetTransferFeeEvent({ transferFee })
      );
    }

    /**
     * Transfers ownership of the collection to a new creator.
     * This method is called transferOwnership as the Collection is implementing OwnableContract interface
     * For the Collection, the creator is the owner of the collection
     *
     * @param to - The public key of the new creator.
     * @returns The public key of the old creator.
     */
    @method.returns(PublicKey)
    async transferOwnership(to: PublicKey): Promise<PublicKey> {
      await this.ensureCreatorSignature();
      await this.ensureNotPaused();
      const adminContract = this.getAdminContract();
      const canChangeCreator = await adminContract.canChangeCreator(to);
      canChangeCreator.assertTrue(CollectionErrors.noPermissionToChangeCreator);
      const from = this.creator.getAndRequireEquals();
      this.creator.set(to);
      this.emitEvent(
        "ownershipChange",
        new OwnershipChangeEvent({
          from,
          to,
        })
      );
      return from;
    }

    @method.returns(NFTStateStruct)
    async getNFTState(address: PublicKey): Promise<NFTStateStruct> {
      const tokenId = this.deriveTokenId();
      const nft = new NFT(address, tokenId);
      const state = await nft.getState();
      return state;
    }
  }
  return Collection;
}
