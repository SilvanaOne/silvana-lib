# Rebuilding Verification Keys metadata

## Rebuild the repo

It will clean prover keys cache, node modules, reinstall deps and build monorepo

```sh
npm run rebuild
```

## Run compilation TWO times

Run

```sh
npm run compile:devnet
```

It will silently hang out after few minutes due to WASM OOM error, press Ctrl-C and run second time

```sh
npm run compile:devnet
```

### In case vk are the same

You will see the message in green

```
Verification keys are up to date
```

### In case vk are changed

You will see the message

```

```

## Check new verification keys

The verification keys will be written to the automatically generated file `packages/abi/src/vk/devnet.ts`
In case verification keys are not updated, the file will NOT be changed, and o1js version written in file can be different from the version you have used (i.e. previous one)

## Compile for mainnet

The procedure is the same,

```sh
npm run rebuild
npm run compile:mainnet
npm run compile:mainnet
```

the file with verification keys will be in `packages/abi/src/vk/mainnet.ts`
