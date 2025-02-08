import {
  FungibleTokenContract,
  FungibleTokenAdminBase,
} from "./FungibleTokenContract.js";
import { FungibleTokenAdmin } from "./FungibleTokenStandardAdmin.js";
import { FungibleTokenAdvancedAdmin } from "./FungibleTokenAdvancedAdmin.js";

export { FungibleToken, AdvancedFungibleToken };

const FungibleToken = FungibleTokenContract(FungibleTokenAdmin);
const AdvancedFungibleToken = FungibleTokenContract(FungibleTokenAdvancedAdmin);
