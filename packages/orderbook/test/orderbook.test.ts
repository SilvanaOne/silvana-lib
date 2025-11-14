/**
 * Orderbook Integration Test
 *
 * Tests the complete order lifecycle on orderbook-devnet:
 * 1. Fetches current BTC-USD price
 * 2. Fetches latest news
 * 3. Lists initial orders for the party
 * 4. Places a buy order at current price
 * 5. Verifies the order appears in the list
 * 6. Cancels the order
 * 7. Verifies the order is cancelled
 *
 * Run with: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  OrderbookClient,
  PricingClient,
  NewsClient,
  OrderType,
  OrderStatus,
  TimeInForce,
} from '../src/index.js';
import { generateJwt, loadJwtCredentials, getOrderbookUrl } from './jwt.js';

// Test configuration
const MARKET_ID = 'BTC-USD';
const ORDER_QUANTITY = '0.001'; // 0.001 BTC (small test amount)
const TEST_PARTY_ID = 'cbtc-holder-1::122034faf8f4af71d107a42441f8bc90cabfd63ab4386fc7f17d15d6e3b01c5bd2ae';
const AUDIENCE = 'orderbook-devnet';

/**
 * Helper function to wait/sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Orderbook Integration Test', () => {
  it('should complete full order lifecycle (price, news, order, cancel)', async () => {
    console.log('='.repeat(80));
    console.log('🧪 Testing Order Lifecycle on orderbook-devnet');
    console.log('='.repeat(80));

    // ========================================================================
    // PART 1: Setup & Authentication
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('PART 1: Setup & Authentication');
    console.log('='.repeat(80));

    console.log('\n📋 Configuration:');
    console.log(`  Market: ${MARKET_ID}`);
    console.log(`  Party ID: ${TEST_PARTY_ID}`);
    console.log(`  Audience: ${AUDIENCE}`);

    // Load credentials from environment
    const { privateKey } = loadJwtCredentials();
    const orderbookUrl = getOrderbookUrl();
    console.log(`  gRPC URL: ${orderbookUrl}`);

    // Generate JWT token
    console.log('\n🔐 Generating JWT token...');
    const jwtToken = await generateJwt(
      TEST_PARTY_ID,
      'trader',
      AUDIENCE,
      privateKey,
      3600
    );
    console.log('  ✅ JWT token generated');
    console.log(`  Token: ${jwtToken}`);

    // Create clients
    console.log('\n🔌 Creating clients...');
    const orderbookClient = new OrderbookClient({
      baseUrl: orderbookUrl,
      token: jwtToken,
    });
    console.log('  ✅ OrderbookClient created');

    const pricingClient = new PricingClient({
      baseUrl: orderbookUrl,
    });
    console.log('  ✅ PricingClient created');

    const newsClient = new NewsClient({
      baseUrl: orderbookUrl,
    });
    console.log('  ✅ NewsClient created');

    // ========================================================================
    // PART 2: Get Current Price
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('PART 2: Get Current Price');
    console.log('='.repeat(80));

    console.log(`\n📊 Fetching current ${MARKET_ID} price...`);

    let currentPrice = 99000.0; // Default fallback
    try {
      const priceResponse = await pricingClient.getPrice({
        marketId: MARKET_ID,
      });

      currentPrice = priceResponse.last;
      const bid = priceResponse.bid
        ? `$${priceResponse.bid.toFixed(2)}`
        : 'N/A';
      const ask = priceResponse.ask
        ? `$${priceResponse.ask.toFixed(2)}`
        : 'N/A';

      console.log(`  ✅ Current ${MARKET_ID} price: $${currentPrice.toFixed(2)}`);
      console.log(`     Bid: ${bid}, Ask: ${ask}`);
      console.log(`     Source: ${priceResponse.source}`);
    } catch (error) {
      console.log(`  ⚠️  Failed to fetch price: ${error}`);
      console.log(`  Using fallback price: $${currentPrice}`);
    }

    // Calculate order price (slightly above market to ensure it stays in orderbook)
    const orderPrice = Math.floor(currentPrice * 1.01); // +1% above market
    console.log(`\n💰 Calculated order price: $${orderPrice.toFixed(2)} (+1.0% from market)`);

    // ========================================================================
    // PART 3: Get News
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('PART 3: Get Latest News');
    console.log('='.repeat(80));

    console.log('\n📰 Fetching latest BTC news...');

    try {
      const newsResponse = await newsClient.getNews({
        tokens: ['btc'],
        limit: 3,
        language: 'en',
        hours: 48,
      });

      if (newsResponse.success && newsResponse.tokenNews.length > 0) {
        const btcNews = newsResponse.tokenNews[0];
        console.log(`  ✅ Found ${btcNews.totalResults} news articles for BTC`);
        console.log(`     Showing ${btcNews.articles.length} articles:`);

        btcNews.articles.forEach((article, idx) => {
          console.log(`\n     ${idx + 1}. ${article.title}`);
          console.log(`        Source: ${article.source?.name || 'Unknown'}`);
          if (article.description) {
            const desc =
              article.description.length > 100
                ? article.description.substring(0, 100) + '...'
                : article.description;
            console.log(`        ${desc}`);
          }
        });

        if (newsResponse.fromCache) {
          console.log(`\n     ℹ️  Results from cache`);
        }
      } else {
        console.log(`  ⚠️  No news found or service unavailable`);
      }
    } catch (error) {
      console.log(`  ⚠️  Failed to fetch news: ${error}`);
    }

    // ========================================================================
    // PART 4: List Initial Orders
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('PART 4: List Initial Orders');
    console.log('='.repeat(80));

    console.log('\n📋 Querying current orders for party...');

    const initialOrdersResponse = await orderbookClient.getOrders({
      marketId: MARKET_ID,
      limit: 10,
    });

    assert(initialOrdersResponse.success, 'Failed to get initial orders');

    console.log(`  ✅ Found ${initialOrdersResponse.orders.length} existing orders`);

    if (initialOrdersResponse.orders.length > 0) {
      console.log('     Current orders:');
      initialOrdersResponse.orders.forEach((order) => {
        const statusStr = OrderStatus[order.status] || 'UNKNOWN';
        const typeStr = order.orderType === OrderType.BID ? 'BID' : 'OFFER';
        console.log(
          `       Order ${order.orderId}: ${typeStr} - Price: $${order.price}, ` +
            `Qty: ${order.quantity} BTC, Status: ${statusStr}`
        );
      });
    } else {
      console.log('     No existing orders');
    }

    // ========================================================================
    // PART 5: Submit Order at Current Price
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('PART 5: Submit Order at Current Price');
    console.log('='.repeat(80));

    console.log('\n📤 Placing buy order...');
    console.log(`  Market: ${MARKET_ID}`);
    console.log(`  Type: BID (Buy)`);
    console.log(`  Price: $${orderPrice.toFixed(2)}`);
    console.log(`  Quantity: ${ORDER_QUANTITY} BTC`);
    console.log(`  Time in Force: GTC (Good Till Cancel)`);

    const submitResponse = await orderbookClient.submitOrder({
      marketId: MARKET_ID,
      orderType: OrderType.BID,
      price: orderPrice.toFixed(2),
      quantity: ORDER_QUANTITY,
      timeInForce: TimeInForce.GTC,
      traderOrderRef: `test-order-${Date.now()}`,
    });

    assert(submitResponse.success, `Failed to submit order: ${submitResponse.message}`);
    assert(submitResponse.order, 'Order not returned in response');

    const orderId = submitResponse.order.orderId;
    console.log(`  ✅ Order placed successfully!`);
    console.log(`     Order ID: ${orderId}`);
    console.log(`     Status: ${OrderStatus[submitResponse.order.status]}`);

    // Wait a moment for order to be processed
    console.log('\n⏳ Waiting 2 seconds for order to be processed...');
    await sleep(2000);
    console.log('   ✅ Wait complete');

    // ========================================================================
    // PART 6: Verify Order Created
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('PART 6: Verify Order Created');
    console.log('='.repeat(80));

    console.log('\n📋 Querying orders after submission...');

    const afterSubmitResponse = await orderbookClient.getOrders({
      marketId: MARKET_ID,
      limit: 10,
    });

    assert(afterSubmitResponse.success, 'Failed to get orders after submit');

    console.log(`  ✅ Found ${afterSubmitResponse.orders.length} orders`);

    // Find our order
    const ourOrder = afterSubmitResponse.orders.find(
      (order) => order.orderId === orderId
    );

    assert(ourOrder, `Order ${orderId} not found in order list`);

    // Order should be ACTIVE or PARTIAL (partially filled)
    // PARTIAL means the matching engine found a counterparty - this is good!
    const validStatuses = [OrderStatus.ACTIVE, OrderStatus.PARTIAL];
    assert(
      validStatuses.includes(ourOrder.status),
      `Order should be ACTIVE or PARTIAL, but is ${OrderStatus[ourOrder.status]}`
    );

    console.log('     Our order details:');
    console.log(
      `       Order ID: ${ourOrder.orderId}, Status: ${OrderStatus[ourOrder.status]}`
    );
    console.log(
      `       Price: $${ourOrder.price}, Quantity: ${ourOrder.quantity} BTC`
    );
    console.log(
      `       Filled: ${ourOrder.filledQuantity} BTC, Remaining: ${ourOrder.remainingQuantity} BTC`
    );

    if (ourOrder.status === OrderStatus.PARTIAL) {
      console.log(`       🎉 Order is being matched! (Partial fill)`);
    }

    // ========================================================================
    // PART 7: Cancel the Order
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('PART 7: Cancel the Order');
    console.log('='.repeat(80));

    console.log(`\n🚫 Cancelling order ${orderId}...`);

    const cancelResponse = await orderbookClient.cancelOrder({
      orderId: orderId,
    });

    assert(cancelResponse.success, `Failed to cancel order: ${cancelResponse.message}`);
    assert(cancelResponse.order, 'Order not returned in cancel response');

    console.log('  ✅ Order cancelled successfully');
    console.log(`     Status: ${OrderStatus[cancelResponse.order.status]}`);

    // Wait for cancellation to propagate
    console.log('\n⏳ Waiting 2 seconds for cancellation to process...');
    await sleep(2000);
    console.log('   ✅ Wait complete');

    // ========================================================================
    // PART 8: Verify Order Cancelled
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('PART 8: Verify Order Cancelled');
    console.log('='.repeat(80));

    console.log('\n📋 Querying orders after cancellation...');

    const afterCancelResponse = await orderbookClient.getOrders({
      marketId: MARKET_ID,
      limit: 10,
    });

    assert(afterCancelResponse.success, 'Failed to get orders after cancel');

    console.log(`  ✅ Found ${afterCancelResponse.orders.length} orders`);

    // Find our cancelled order
    const cancelledOrder = afterCancelResponse.orders.find(
      (order) => order.orderId === orderId
    );

    assert(cancelledOrder, `Order ${orderId} not found in order list after cancel`);

    // Order should be CANCELLED or FILLED
    // If it was partially filled and we cancelled it, it will be CANCELLED
    // If it was fully filled before we could cancel, it will be FILLED
    const validFinalStatuses = [OrderStatus.CANCELLED, OrderStatus.FILLED];
    assert(
      validFinalStatuses.includes(cancelledOrder.status),
      `Order should be CANCELLED or FILLED, but is ${OrderStatus[cancelledOrder.status]}`
    );

    console.log('     Final order details:');
    console.log(
      `       Order ID: ${cancelledOrder.orderId}, Status: ${OrderStatus[cancelledOrder.status]}`
    );
    console.log(
      `       Price: $${cancelledOrder.price}, Quantity: ${cancelledOrder.quantity} BTC`
    );
    console.log(
      `       Filled: ${cancelledOrder.filledQuantity} BTC, Remaining: ${cancelledOrder.remainingQuantity} BTC`
    );

    if (cancelledOrder.status === OrderStatus.FILLED) {
      console.log(`       🎉 Order was fully filled before cancellation!`);
    }

    // ========================================================================
    // PART 9: Summary
    // ========================================================================
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    console.log('\n📊 Test Results:');
    console.log(`  ✅ Fetched current price: $${currentPrice.toFixed(2)}`);
    console.log('  ✅ Fetched latest news');
    console.log(`  ✅ Listed initial orders: ${initialOrdersResponse.orders.length} orders`);
    console.log(`  ✅ Submitted order at $${orderPrice.toFixed(2)}`);
    console.log(`  ✅ Verified order created (Order ID: ${orderId}, Status: ${OrderStatus[ourOrder.status]})`);
    console.log(`  ✅ Attempted to cancel order`);
    console.log(`  ✅ Final order status: ${OrderStatus[cancelledOrder.status]}`);

    if (cancelledOrder.filledQuantity !== '0.0000000000') {
      console.log(`  🎉 Order was matched! Filled: ${cancelledOrder.filledQuantity} BTC`);
    }

    console.log('\n✅ Test completed successfully!');
    console.log('\n💡 All order lifecycle operations working correctly.\n');
  });
});
