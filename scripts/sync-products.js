#!/usr/bin/env node
/* eslint-env node */

/**
 * Utility script to sync all products from a Shopify store to the local database
 * 
 * Usage:
 *   node scripts/sync-products.js [sessionId]
 * 
 * If sessionId is not provided, it will sync for all sessions in the database.
 * 
 * The script:
 * 1. Reads session credentials from the SQLite database
 * 2. Makes direct GraphQL requests to Shopify Admin API
 * 3. Stores products in the database associated with the session
 */

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

// GraphQL query to fetch products with the top 15 most relevant fields
const PRODUCTS_QUERY = `
  query getProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          legacyResourceId
          handle
          title
          description
          descriptionHtml
          vendor
          productType
          status
          tags
          featuredMedia {
            ... on MediaImage {
              image {
                url
              }
            }
          }
          hasOnlyDefaultVariant
          isGiftCard
          requiresSellingPlan
          createdAt
          updatedAt
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                barcode
                position
                price
                compareAtPrice
                inventoryQuantity
                inventoryPolicy
                availableForSale
                taxable
                image {
                  url
                }
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * Make a GraphQL request to Shopify Admin API
 */
async function makeGraphQLRequest(shop, accessToken, query, variables = {}) {
  const apiVersion = '2025-01'; // Use latest API version
  const url = `https://${shop}/admin/api/${apiVersion}/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.errors) {
    console.error('GraphQL errors:', JSON.stringify(data.errors, null, 2));
    throw new Error('GraphQL request failed with errors');
  }

  return data;
}

/**
 * Sync products for a specific session
 */
async function syncProductsForSession(session) {
  console.log(`\n🔄 Starting sync for shop: ${session.shop} (Session: ${session.id})`);
  
  let hasNextPage = true;
  let cursor = null;
  let totalProductsSynced = 0;
  let totalVariantsSynced = 0;
  const batchSize = 50;

  try {
    // Clear existing products for this session
    console.log('  Clearing existing products...');
    await prisma.productVariant.deleteMany({
      where: {
        product: {
          sessionId: session.id
        }
      }
    });
    
    await prisma.product.deleteMany({
      where: { sessionId: session.id }
    });

    console.log('  Fetching products from Shopify...');
    
    while (hasNextPage) {
      // Fetch products from Shopify
      const response = await makeGraphQLRequest(
        session.shop,
        session.accessToken,
        PRODUCTS_QUERY,
        {
          first: batchSize,
          after: cursor
        }
      );

      const products = response.data.products;
      hasNextPage = products.pageInfo.hasNextPage;
      cursor = products.pageInfo.endCursor;

      // Process each product
      for (const edge of products.edges) {
        const product = edge.node;
        
        try {
          // Create product record
          await prisma.product.create({
            data: {
              id: product.id,
              sessionId: session.id,
              legacyResourceId: product.legacyResourceId.toString(),
              handle: product.handle,
              title: product.title,
              description: product.description || '',
              descriptionHtml: product.descriptionHtml,
              vendor: product.vendor,
              productType: product.productType,
              status: product.status,
              tags: product.tags ? product.tags.join(', ') : null,
              featuredImageUrl: product.featuredMedia?.image?.url || null,
              hasOnlyDefaultVariant: product.hasOnlyDefaultVariant,
              isGiftCard: product.isGiftCard,
              requiresSellingPlan: product.requiresSellingPlan,
              syncedAt: new Date()
            }
          });

          totalProductsSynced++;

          // Process variants
          if (product.variants?.edges) {
            const variantData = product.variants.edges.map(variantEdge => {
              const variant = variantEdge.node;
              totalVariantsSynced++;
              
              return {
                id: variant.id,
                productId: product.id,
                title: variant.title,
                sku: variant.sku,
                barcode: variant.barcode,
                position: variant.position,
                price: variant.price,
                compareAtPrice: variant.compareAtPrice,
                inventoryQuantity: variant.inventoryQuantity,
                inventoryPolicy: variant.inventoryPolicy || 'DENY',
                availableForSale: variant.availableForSale,
                taxable: variant.taxable,
                imageUrl: variant.image?.url || null,
                selectedOptions: variant.selectedOptions ? JSON.stringify(variant.selectedOptions) : null
              };
            });

            // Bulk create variants
            await prisma.productVariant.createMany({
              data: variantData
            });
          }
        } catch (productError) {
          console.error(`  ❌ Error syncing product ${product.title}:`, productError.message);
        }
      }

      console.log(`  ✓ Synced batch: ${totalProductsSynced} products, ${totalVariantsSynced} variants so far...`);
    }

    console.log(`✅ Successfully synced ${totalProductsSynced} products with ${totalVariantsSynced} variants for ${session.shop}`);
    
    return {
      shop: session.shop,
      sessionId: session.id,
      productsCount: totalProductsSynced,
      variantsCount: totalVariantsSynced,
      success: true
    };

  } catch (error) {
    console.error(`❌ Failed to sync products for ${session.shop}:`, error.message);
    return {
      shop: session.shop,
      sessionId: session.id,
      productsCount: 0,
      variantsCount: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Main function
 */
async function main() {
  const sessionId = process.argv[2];
  
  try {
    console.log('🚀 Shopify Product Sync Utility');
    console.log('================================\n');

    let sessions = [];

    if (sessionId) {
      // Sync specific session
      const session = await prisma.session.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        console.error(`❌ Session not found: ${sessionId}`);
        process.exit(1);
      }

      sessions = [session];
    } else {
      // Sync all sessions - get all sessions that have an accessToken
      sessions = await prisma.session.findMany();

      if (sessions.length === 0) {
        console.log('ℹ️  No sessions found in the database.');
        console.log('   Make sure the app is installed on at least one store.');
        process.exit(0);
      }

      console.log(`Found ${sessions.length} session(s) to sync\n`);
    }

    // Sync each session
    const results = [];
    for (const session of sessions) {
      const result = await syncProductsForSession(session);
      results.push(result);
    }

    // Summary
    console.log('\n📊 Sync Summary');
    console.log('================');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (successful.length > 0) {
      console.log('\n✅ Successful syncs:');
      successful.forEach(r => {
        console.log(`   - ${r.shop}: ${r.productsCount} products, ${r.variantsCount} variants`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\n❌ Failed syncs:');
      failed.forEach(r => {
        console.log(`   - ${r.shop}: ${r.error}`);
      });
    }

    const totalProducts = successful.reduce((acc, r) => acc + r.productsCount, 0);
    const totalVariants = successful.reduce((acc, r) => acc + r.variantsCount, 0);
    
    console.log('\n📈 Total synced:');
    console.log(`   Products: ${totalProducts}`);
    console.log(`   Variants: ${totalVariants}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
