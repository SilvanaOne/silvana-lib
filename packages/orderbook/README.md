# @silvana-one/orderbook

Silvana Orderbook Client - A TypeScript/JavaScript client library for interacting with the Silvana Orderbook Service via gRPC.

## Installation

```bash
npm install @silvana-one/orderbook
```

## Usage

### Basic Setup

```typescript
import { OrderbookClient, OrderType, OrderStatus, TimeInForce } from '@silvana-one/orderbook';

// Initialize the client
const client = new OrderbookClient({
  baseUrl: 'http://localhost:50052',
  token: 'your-jwt-token-here'
});
```

### Submitting Orders

```typescript
// Submit a buy order
const response = await client.submitOrder({
  marketId: 'BTC-USD',
  orderType: OrderType.BID,
  price: '50000.00',
  quantity: '0.5',
  timeInForce: TimeInForce.GTC,
  expiresAt: new Date('2024-12-31'),
  traderOrderRef: 'my-order-123'
});

if (response.success) {
  console.log('Order submitted:', response.order);
}
```

### Querying Orders

```typescript
// Get your active orders
const orders = await client.getOrders({
  marketId: 'BTC-USD',
  status: OrderStatus.ACTIVE,
  limit: 50
});

// Get order history
const history = await client.getOrderHistory({
  marketId: 'BTC-USD',
  fromTime: new Date('2024-01-01'),
  toTime: new Date(),
  limit: 100
});
```

### Market Data

```typescript
// Get orderbook depth
const depth = await client.getOrderbookDepth({
  marketId: 'BTC-USD',
  depth: 20
});

console.log('Bids:', depth.orderbook?.bids);
console.log('Offers:', depth.orderbook?.offers);

// Get market data for multiple markets
const marketData = await client.getMarketData({
  marketIds: ['BTC-USD', 'ETH-USD']
});
```

### Streaming Real-time Updates

```typescript
// Subscribe to orderbook updates
const orderbookStream = client.subscribeOrderbook({
  marketId: 'BTC-USD',
  depth: 10
});

for await (const update of orderbookStream) {
  console.log('Orderbook update:', update);
}

// Subscribe to your order updates
const orderStream = client.subscribeOrders({
  marketId: 'BTC-USD'
});

for await (const update of orderStream) {
  console.log('Order update:', update.eventType, update.order);
}
```

### Canceling Orders

```typescript
const cancelResponse = await client.cancelOrder({
  orderId: BigInt(12345)
});

if (cancelResponse.success) {
  console.log('Order cancelled');
}
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

## Types and Enums

The package exports all necessary types and enums:

```typescript
import {
  OrderType,
  OrderStatus,
  TimeInForce,
  MarketType,
  SettlementStatus,
  type Order,
  type Market,
  type Instrument,
  type Settlement,
  type OrderbookDepth
} from '@silvana-one/orderbook';
```

## JWT Authentication

All methods require JWT authentication. The token should be signed with an Ed25519 private key and include the necessary claims for accessing the orderbook service.

```typescript
const token = generateJWT({
  sub: 'trader-id',
  exp: Date.now() + 3600000,
  // ... other required claims
});

const client = new OrderbookClient({
  baseUrl: 'http://orderbook-service:50052',
  token
});
```

## Error Handling

All async methods may throw errors. It's recommended to wrap calls in try-catch blocks:

```typescript
try {
  const response = await client.submitOrder({
    // ... order parameters
  });
} catch (error) {
  console.error('Failed to submit order:', error);
}
```

## License

Apache-2.0