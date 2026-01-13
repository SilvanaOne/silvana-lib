# @silvana-one/orderbook

Silvana Orderbook Client for Node.js and Browser environments.

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
import { OrderbookClient, OrderType, TimeInForce } from "@silvana-one/orderbook";

const transport = createGrpcTransport({
  baseUrl: "https://api.silvana.one",
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
import { OrderbookClient, OrderType, TimeInForce } from "@silvana-one/orderbook";

const transport = createGrpcWebTransport({
  baseUrl: "https://api.silvana.one",
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

Main client for trading operations.

```typescript
import { OrderbookClient } from "@silvana-one/orderbook";

const client = new OrderbookClient({ transport, token });

// Trading
await client.getMarkets();
await client.getOrders({ marketId: "BTC-USD" });
await client.submitOrder({ ... });
await client.cancelOrder({ orderId: 123n });

// Market data
await client.getOrderbookDepth({ marketId: "BTC-USD", depth: 10 });
await client.getMarketData({ marketIds: ["BTC-USD"] });

// Streaming
for await (const update of client.subscribeOrderbook({ marketId: "BTC-USD" })) {
  console.log(update);
}
```

### PricingClient

Client for price data and market feeds.

```typescript
import { PricingClient } from "@silvana-one/orderbook";

const client = new PricingClient({ transport });

await client.getPrice({ marketId: "BTC-USD" });
await client.getPrices({ marketIds: ["BTC-USD", "ETH-USD"] });
await client.getKlines({ marketId: "BTC-USD", interval: "1h", limit: 100 });

// Streaming
for await (const update of client.streamPrices({ marketIds: ["BTC-USD"] })) {
  console.log(update);
}
```

### NewsClient

Client for news and market updates.

```typescript
import { NewsClient } from "@silvana-one/orderbook";

const client = new NewsClient({ transport });

await client.getNews({ tokens: ["BTC", "ETH"], limit: 10 });

// Streaming
for await (const news of client.streamNews({ tokens: ["BTC"] })) {
  console.log(news);
}
```

### SettlementClient

Client for settlement operations (Canton node integration).

```typescript
import { SettlementClient } from "@silvana-one/orderbook";

const client = new SettlementClient({ transport });

await client.getPendingProposals({ auth, partyId: "party-1" });
await client.getSettlementStatus({ auth, settlementId: "settlement-1" });
```

## API Methods

### Order Management
- `submitOrder()` - Submit a new order
- `cancelOrder()` - Cancel an existing order
- `getOrders()` - Get your orders
- `getOrderHistory()` - Get historical orders

### Market Data
- `getMarkets()` - Get available markets
- `getInstruments()` - Get tradable instruments
- `getOrderbookDepth()` - Get orderbook depth
- `getMarketData()` - Get market statistics

### Settlements
- `getSettlementProposals()` - Get settlement proposals
- `getSettlements()` - Get completed settlements

### Streaming (Real-time)
- `subscribeOrderbook()` - Stream orderbook updates
- `subscribeOrders()` - Stream order updates
- `subscribeSettlements()` - Stream settlement updates

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
} from "@silvana-one/orderbook";
```

## License

Apache-2.0
