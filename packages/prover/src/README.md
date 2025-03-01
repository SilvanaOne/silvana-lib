# zkCloudWorker library

In the fast-paced realm of ZK proving, zkCloudWorker stands out as a potential game-changer for both zkApp developers and users.

By delivering ultra-fast proving in the cloud, along with robust isolation, composability, and an excellent user experience (UX), zkCloudWorker has the potential to significantly streamline and expedite the development of MINA zkApps both on web and mobile devices.

Instead of downloading 1 GB of proving keys, compiling, and performing proofs on a web or mobile worker, a simple API call can be made to the powerful zkCloudWorker to launch a worker in the cloud. This offers ample memory, CPU power, and parallel processing capabilities for recursive proof calculations.

Privacy is maintained through the isolation of processes, encryption of all data, and the ability to process private data on the web using technologies like hashing and Merkle Tree calculations. Preprocessed data is then sent to the cloud worker.

This opens doors for a diverse range of Web2 developers to seamlessly enter the exciting world of the MINA protocol and o1js.

## Features

- Compiling the contract in the cloud.

- Calculating transactions proofs tx.prove().

- Calculating recursive proofs.

- Sending transactions to network.

- Verifying proofs.

- Providing deployers to pay the tx fee.

- API to be accessed inside the zkCloudWorker.

- API to be accessed inside the web application.

- Billing panel to show the cost of the running zkCloudWorkers to the developer.

- Web dashboard to easily deploy and access deployed zkCloudWorkers and their logs.

- Providing key-value off-chain storage for zkApps, up to 400K size for values.

- Providing file storage for zkApps, unlimited size.

- Encryption utilities for sending and storing the data in the encrypted form.

- Verifying the text of the contracts for uploading to the minascan.io explorer.

- Providing additional metadata for the transactions, including custom metadata defined by the developer and the conversion of the actions and events to the human-readable form as defined by the developer for publishing on the minascan.io explorer.

- Code templates and question-answer sets for the zkApp Umstad AI Chatbot.

- The CLI tool to deploy the code to the cloud and verify the code on the minascan.io.

- Availability of the zkCloudWorker for SmartContract, ZkProgram and general calculations, including running ProtoKit chains in case ProtoKit will support running on the serverless infrastructure, that is possible in principle.

- Custom integration of the zkApps for the cases that do not fit in the standard framework for some reason.

## Installation

```
yarn add zkcloudworker
```

## Documentation

https://docs.zkcloudworker.com

## Website

https://zkcloudworker.com

## Library on NPM

https://www.npmjs.com/package/zkcloudworker

## Faucet

https://faucet.minaprotocol.com

https://zeko.io/faucet

https://minanft.io/faucet
