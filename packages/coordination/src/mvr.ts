import { Transaction } from "@mysten/sui/transactions";

export function publishToMVR(params: {
  mvrName: string; // e.g. @suins/core
  upgradeCap: string;
  packageName: string;
  safeAddress: string;
}): Transaction {
  const { upgradeCap, packageName, mvrName, safeAddress } = params;
  const transaction = new Transaction();

  const packageInfo = transaction.moveCall({
    target: `@mvr/metadata::package_info::new`,
    arguments: [transaction.object(upgradeCap)],
  });

  // We also need to create the visual representation of our "info" object.
  // You can also call `@mvr/metadata::display::new` instead,
  // that allows customizing the colors of your metadata object!
  const display = transaction.moveCall({
    target: `@mvr/metadata::display::default`,
    arguments: [transaction.pure.string(packageName)],
  });

  // Set that display object to our info object.
  transaction.moveCall({
    target: `@mvr/metadata::package_info::set_display`,
    arguments: [transaction.object(packageInfo), display],
  });

  // Set the default for the packageInfo, which enables reverse resolution for that network
  // See details in reverse resolution section
  transaction.moveCall({
    target: "@mvr/metadata::package_info::set_metadata",
    arguments: [
      transaction.object(packageInfo),
      transaction.pure.string("default"),
      transaction.pure.string(mvrName),
    ],
  });

  // Optionally unset the metadata for the packageInfo
  // transaction.moveCall({
  //     target: "@mvr/metadata::package_info::unset_metadata",
  //     arguments: [
  //         transaction.object(packageInfo),
  //         transaction.pure.string("default"),
  //     ],
  // });

  // transfer the `PackageInfo` object to a safe address.
  transaction.moveCall({
    target: `@mvr/metadata::package_info::transfer`,
    arguments: [
      transaction.object(packageInfo),
      transaction.pure.address(safeAddress),
    ],
  });

  return transaction;
}

export function publishCodeToMVR(params: {
  packageInfo: string;
  gitRepository: string; // e.g. https://github.com/mystenlabs/mvr
  gitSubdirectory: string; // e.g. packages/mvr
  gitCommitHash: string; // e.g. 636d22d6bc4195afec9a1c0a8563b61fc813acfc
  version: number;
}): Transaction {
  const {
    packageInfo,
    gitRepository,
    gitSubdirectory,
    gitCommitHash,
    version,
  } = params;

  const transaction = new Transaction();

  const git = transaction.moveCall({
    target: `@mvr/metadata::git::new`,
    arguments: [
      transaction.pure.string(gitRepository),
      transaction.pure.string(gitSubdirectory),
      transaction.pure.string(gitCommitHash),
    ],
  });

  transaction.moveCall({
    target: `@mvr/metadata::package_info::set_git_versioning`,
    arguments: [
      transaction.object(packageInfo),
      transaction.pure.u64(version),
      git,
    ],
  });

  return transaction;
}
