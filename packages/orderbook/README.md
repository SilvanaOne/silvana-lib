# @silvana-one/orderbook

TypeScript client library for the Silvana orderbook. Works in Node.js and Browser environments. Wraps 5 gRPC services via [Connect RPC](https://connectrpc.com/).

## Installation

```bash
npm install @silvana-one/orderbook
```

For Node.js:

```bash
npm install @connectrpc/connect-node
```

For Browser:

```bash
npm install @connectrpc/connect-web
```

## Usage

### Node.js

```typescript
import { createGrpcTransport } from "@connectrpc/connect-node";
import {
  OrderbookClient,
  OrderType,
  TimeInForce,
} from "@silvana-one/orderbook";

const transport = createGrpcTransport({
  baseUrl: "https://your-orderbook-server:port",
});

const client = new OrderbookClient({
  transport,
  token: "your-jwt-token",
});

// Get markets
const markets = await client.getMarkets();
console.log(markets.markets);

// Submit an order
const order = await client.submitOrder({
  marketId: "BTC-USD",
  orderType: OrderType.BID,
  price: "50000.00",
  quantity: "0.1",
  timeInForce: TimeInForce.GTC,
});
```

### Browser

```typescript
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import {
  OrderbookClient,
  OrderType,
  TimeInForce,
} from "@silvana-one/orderbook";

const transport = createGrpcWebTransport({
  baseUrl: "https://your-orderbook-server:port",
});

const client = new OrderbookClient({
  transport,
  token: "your-jwt-token",
});

// Same API as Node.js
const markets = await client.getMarkets();
```

## Clients

### OrderbookClient

Trading operations, order management, market data, and RFQ. Requires JWT authentication.

```typescript
import { OrderbookClient } from "@silvana-one/orderbook";

const client = new OrderbookClient({ transport, token });

// Trading
await client.submitOrder({ ... });
await client.cancelOrder({ orderId: 123n });
await client.getOrders({ marketId: "BTC-USD" });

// Market data
await client.getOrderbookDepth({ marketId: "BTC-USD", depth: 10 });
await client.getMarketData({ marketIds: ["BTC-USD"] });

// RFQ
const quotes = await client.requestQuotes({ marketId: "BTC-USD", direction: "buy", quantity: "0.5" });
await client.acceptQuote({ rfqId: quotes.rfqId, quoteId: quotes.quotes[0].quoteId });

// Streaming
for await (const update of client.subscribeOrderbook({ marketId: "BTC-USD" })) {
  console.log(update);
}
```

### SettlementClient

DVP settlement orchestration and RFQ handling. Requires JWT authentication.

```typescript
import { SettlementClient } from "@silvana-one/orderbook";

const client = new SettlementClient({ transport, token });

await client.getPendingProposals({ partyId: "party-1" });
await client.getSettlementStatus({ settlementId: "settlement-1" });

// Bidirectional streaming for settlement flow and RFQ
const stream = client.settlementStream(messages);
```

### LedgerClient

Two-phase transaction signing, balance/contract queries, and cloud agent onboarding. JWT authentication for most RPCs; onboarding RPCs use message-level Ed25519 signing.

```typescript
import { LedgerClient } from "@silvana-one/orderbook";

const client = new LedgerClient({ transport, token });

// Queries
await client.getBalances();
await client.getDsoRates();
await client.getServiceInfo();

// Two-phase transaction
const prepared = await client.prepareTransaction({ operation, params });
// ... sign hash locally ...
await client.executeTransaction({
  transactionId: prepared.transactionId,
  signature,
});

// Onboarding (no JWT needed)
const unauthClient = new LedgerClient({ transport });
await unauthClient.getAgentConfig();
await unauthClient.registerAgent({ publicKey, requestSignature });

// Streaming
for await (const contract of client.getActiveContracts({
  templateFilters: ["..."],
})) {
  console.log(contract);
}
```

### PricingClient

External price feeds (Binance, ByBit, CoinGecko). No authentication needed.

```typescript
import { PricingClient } from "@silvana-one/orderbook";

const client = new PricingClient({ transport });

await client.getPrice({ marketId: "BTC-USD" });
await client.getKlines({ marketId: "BTC-USD", interval: "1h", limit: 100 });

// Streaming
for await (const update of client.streamPrices({ marketIds: ["BTC-USD"] })) {
  console.log(update);
}
```

## gRPC Services

The library wraps 5 gRPC services:

| Service             | Client             | Auth                  | Streaming                                                                          |
| ------------------- | ------------------ | --------------------- | ---------------------------------------------------------------------------------- |
| OrderbookService    | `OrderbookClient`  | JWT                   | Server-streaming (`subscribeOrderbook`, `subscribeOrders`, `subscribeSettlements`) |
| SettlementService   | `SettlementClient` | JWT                   | Bidirectional (`settlementStream`)                                                 |
| DAppProviderService | `LedgerClient`     | JWT / Message signing | Server-streaming (`getActiveContracts`, `getUpdates`)                              |
| PricingService      | `PricingClient`    | None                  | Server-streaming (`streamPrices`)                                                  |

### Two-Phase Transaction Flow

All ledger-mutating operations use a two-phase signing protocol via `LedgerClient`:

1. Call `prepareTransaction` with an operation type and parameters
2. Server returns the full `prepared_transaction` bytes and a hash
3. Verify the transaction matches the requested operation (correct template, parties, amounts)
4. Sign the hash locally with Ed25519 private key
5. Call `executeTransaction` with the signature
6. Server submits the signed transaction to the Canton ledger

Operation types:

| Operation                      | Description                        |
| ------------------------------ | ---------------------------------- |
| `TRANSFER_CC`                  | Send Canton Coin                   |
| `TRANSFER_CIP56`               | Send CIP-56 token                  |
| `ACCEPT_CIP56`                 | Accept incoming CIP-56 transfer    |
| `PAY_DVP_FEE`                  | Pay DVP processing fee             |
| `PROPOSE_DVP`                  | Create DVP proposal                |
| `ACCEPT_DVP`                   | Accept DVP proposal                |
| `PAY_ALLOC_FEE`                | Pay allocation processing fee      |
| `ALLOCATE`                     | Allocate tokens to DVP             |
| `REQUEST_PREAPPROVAL`          | Request TransferPreapproval        |
| `REQUEST_RECURRING_PREPAID`    | Request prepaid subscription       |
| `REQUEST_RECURRING_PAYASYOUGO` | Request pay-as-you-go subscription |
| `REQUEST_USER_SERVICE`         | Request UserService (onboarding)   |

### Settlement Stream (Bidirectional)

`SettlementClient.settlementStream()` opens a long-lived bidirectional gRPC stream for RFQ handling and settlement lifecycle coordination.

**Client sends:** handshake, heartbeats, preconfirmation decisions, DVP lifecycle events, RFQ quotes/rejections

**Server sends:** handshake acknowledgement, heartbeats, settlement proposals, preconfirmation requests, RFQ requests

### Key Query RPCs

| Method                     | Client     | Returns                                                |
| -------------------------- | ---------- | ------------------------------------------------------ |
| `getBalances()`            | Ledger     | Token balances (total, locked, unlocked)               |
| `getActiveContracts()`     | Ledger     | Stream of active contracts by template filter          |
| `getUpdates()`             | Ledger     | Stream of ledger transactions from a given offset      |
| `getPrice()`               | Pricing    | Bid, ask, last price for a market                      |
| `getKlines()`              | Pricing    | OHLCV candlestick data (1m to 1w intervals)            |
| `getOrders()`              | Orderbook  | Orders with status and type filters                    |
| `getOrderbookDepth()`      | Orderbook  | Aggregated bid/offer price levels                      |
| `getSettlementProposals()` | Orderbook  | Settlement proposals with status filter                |
| `getSettlementStatus()`    | Settlement | Step-by-step DVP status with buyer/seller next actions |
| `getMarkets()`             | Orderbook  | Available markets and their configuration              |
| `getMarketData()`          | Orderbook  | Best bid/ask, last price, 24h volume                   |
| `requestQuotes()`          | Orderbook  | RFQ quotes from connected liquidity providers          |
| `acceptQuote()`            | Orderbook  | Accept an LP quote, creating a settlement proposal     |

### Server-Streaming Subscriptions

| Method                   | Client    | Payload                                                      |
| ------------------------ | --------- | ------------------------------------------------------------ |
| `getActiveContracts()`   | Ledger    | Active contracts matching template filter                    |
| `getUpdates()`           | Ledger    | Ledger transaction stream from a given offset                |
| `subscribeOrderbook()`   | Orderbook | Orderbook snapshots and deltas                               |
| `subscribeOrders()`      | Orderbook | Order lifecycle events (created, filled, cancelled)          |
| `subscribeSettlements()` | Orderbook | Settlement status change events                              |
| `streamPrices()`         | Pricing   | Real-time price ticks with optional orderbook and trade data |

### Authentication

- **JWT** — Self-describing Ed25519 JWT (RFC 8037) with automatic refresh. Used for Orderbook, Pricing, and Settlement RPCs. The token embeds the Ed25519 public key; the server verifies it matches the registered party.
- **Message signing** — Per-request Ed25519 signature on the canonical request payload, used for Ledger two-phase transactions. Server responses are also signed and should be verified using the ledger service public key.

## Types

All protobuf types are exported from the package:

```typescript
import {
  Order,
  OrderType,
  OrderStatus,
  TimeInForce,
  MarketType,
  SettlementStatus,
  Market,
  Instrument,
  TransactionOperation,
  TransactionStatus,
  RfqAuditEventType,
  RfqDirection,
  RfqRejectionReason,
} from "@silvana-one/orderbook";
```

## License

Apache-2.0
