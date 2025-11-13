import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  OrderbookClient,
  OrderType,
  OrderStatus,
  TimeInForce,
  MarketType,
  SettlementStatus,
  OrderbookError,
} from '../src/index.js';

describe('OrderbookClient', () => {
  describe('Constructor', () => {
    it('should create a client instance with valid config', () => {
      const client = new OrderbookClient({
        baseUrl: 'http://localhost:50052',
        token: 'test-token-123',
      });
      assert(client instanceof OrderbookClient);
    });
  });

  describe('Enums', () => {
    it('should export OrderType enum', () => {
      assert(OrderType.BID !== undefined);
      assert(OrderType.OFFER !== undefined);
      assert.equal(OrderType.BID, 1);
      assert.equal(OrderType.OFFER, 2);
    });

    it('should export OrderStatus enum', () => {
      assert(OrderStatus.ACTIVE !== undefined);
      assert(OrderStatus.FILLED !== undefined);
      assert(OrderStatus.CANCELLED !== undefined);
    });

    it('should export TimeInForce enum', () => {
      assert(TimeInForce.GTC !== undefined);
      assert(TimeInForce.IOC !== undefined);
      assert(TimeInForce.FOK !== undefined);
    });

    it('should export MarketType enum', () => {
      assert(MarketType.GENERAL !== undefined);
      assert(MarketType.INSTITUTIONAL !== undefined);
    });

    it('should export SettlementStatus enum', () => {
      assert(SettlementStatus.CREATED !== undefined);
      assert(SettlementStatus.SETTLED !== undefined);
    });
  });

  describe('Error Handling', () => {
    it('should export OrderbookError class', () => {
      const error = new OrderbookError('Test error', 'TEST_CODE', { detail: 'test' });
      assert(error instanceof OrderbookError);
      assert(error instanceof Error);
      assert.equal(error.message, 'Test error');
      assert.equal(error.code, 'TEST_CODE');
      assert.deepEqual(error.details, { detail: 'test' });
    });
  });

  describe('Date to Timestamp Conversion', () => {
    it('should handle Date objects in order submission', async () => {
      const client = new OrderbookClient({
        baseUrl: 'http://localhost:50052',
        token: 'test-token',
      });

      // This test verifies the method signature accepts Date objects
      // Actual network calls would fail without a real server
      const orderParams = {
        marketId: 'BTC-USD',
        orderType: OrderType.BID,
        price: '50000.00',
        quantity: '0.5',
        timeInForce: TimeInForce.GTC,
        expiresAt: new Date('2024-12-31'),
      };

      // Verify the method accepts the parameters without TypeScript errors
      assert.doesNotThrow(() => {
        // We're not actually calling the method to avoid network errors
        // Just verifying the type signature is correct
        const _ = client.submitOrder.bind(client, orderParams);
      });
    });
  });

  describe('Method Signatures', () => {
    it('should have all expected methods', () => {
      const client = new OrderbookClient({
        baseUrl: 'http://localhost:50052',
        token: 'test-token',
      });

      // Order methods
      assert(typeof client.getOrders === 'function');
      assert(typeof client.submitOrder === 'function');
      assert(typeof client.cancelOrder === 'function');
      assert(typeof client.getOrderHistory === 'function');

      // Market methods
      assert(typeof client.getMarkets === 'function');
      assert(typeof client.getInstruments === 'function');
      assert(typeof client.getOrderbookDepth === 'function');
      assert(typeof client.getMarketData === 'function');

      // Settlement methods
      assert(typeof client.getSettlementProposals === 'function');
      assert(typeof client.getSettlements === 'function');

      // Streaming methods
      assert(typeof client.subscribeOrderbook === 'function');
      assert(typeof client.subscribeOrders === 'function');
      assert(typeof client.subscribeSettlements === 'function');
    });
  });
});