import { CollectionFactory, NFTAdmin } from "./contracts/index.js";
import { NFTAdvancedAdminContract } from "./admin/index.js";
import { VerificationKeyUpgradeAuthority } from "@silvana-one/upgradable";
import { OfferFactory } from "./marketplace/offer.js";
import {
  NFTOwnerContractConstructor,
  NFTAdminContractConstructor,
  NFTApprovalContractConstructor,
  NFTStandardOwner,
  DefineApprovalFactory,
  DefineOwnerFactory,
  DefineUpdateFactory,
  NFTStandardUpdate,
  NFTUpdateContractConstructor,
} from "./interfaces/index.js";

export const NFTAdvancedAdmin = NFTAdvancedAdminContract({
  upgradeContract: VerificationKeyUpgradeAuthority,
});

export type NonFungibleTokenContracts = {
  Collection: ReturnType<typeof CollectionFactory>;
  Approval: NFTApprovalContractConstructor;
  Owner: NFTOwnerContractConstructor;
  Admin: NFTAdminContractConstructor;
  Update: NFTUpdateContractConstructor;
};

export function NonFungibleTokenContractsFactory(params: {
  adminContract?: NFTAdminContractConstructor;
  approvalFactory?: DefineApprovalFactory;
  ownerFactory?: DefineOwnerFactory;
  updateFactory?: DefineUpdateFactory;
}): NonFungibleTokenContracts {
  const {
    adminContract = NFTAdmin,
    approvalFactory = OfferFactory,
    ownerFactory = ({ collectionContract }) => NFTStandardOwner,
    updateFactory = ({ collectionContract }) => NFTStandardUpdate,
  } = params;

  let Collection: ReturnType<typeof CollectionFactory>;
  let Approval: NFTApprovalContractConstructor;
  let Owner: NFTOwnerContractConstructor;
  let Admin: NFTAdminContractConstructor = adminContract;
  let Update: NFTUpdateContractConstructor;

  function getCollection() {
    if (!Collection) {
      throw new Error("Collection constructor not set up yet!");
    }
    return Collection;
  }
  function getApproval() {
    if (!Approval) {
      throw new Error("Approval constructor not set up yet!");
    }
    return Approval;
  }

  function getUpdate() {
    if (!Update) {
      throw new Error("Update constructor not set up yet!");
    }
    return Update;
  }

  function getOwner() {
    if (!Owner) {
      throw new Error("Owner constructor not set up yet!");
    }
    return Owner;
  }

  Approval = approvalFactory({
    collectionContract: getCollection,
  });

  Update = updateFactory({
    collectionContract: getCollection,
  });

  Collection = CollectionFactory({
    adminContract: () => adminContract,
    ownerContract: getOwner,
    approvalContract: getApproval,
    updateContract: getUpdate,
  });

  Owner = ownerFactory({
    collectionContract: getCollection,
  });

  return { Collection, Approval, Owner, Admin, Update };
}

export const { Collection, Approval, Owner, Admin, Update } =
  NonFungibleTokenContractsFactory({});
export const Offer = Approval as unknown as ReturnType<typeof OfferFactory>;

export const {
  Collection: AdvancedCollection,
  Approval: AdvancedApproval,
  Owner: AdvancedOwner,
  Admin: AdvancedAdmin,
} = NonFungibleTokenContractsFactory({
  adminContract: NFTAdvancedAdmin,
});

export const AdvancedOffer = AdvancedApproval as unknown as ReturnType<
  typeof OfferFactory
>;
