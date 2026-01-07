#!/usr/bin/env node
/* eslint-env node */

/**
 * Utility script to sync all collections from a Shopify store to the local database
 *
 * Usage:
 *   node scripts/sync-collections.js [sessionId]
 *
 * If sessionId is not provided, it will sync for all sessions in the database.
 *
 * The script:
 * 1. Reads session credentials from the SQLite database
 * 2. Makes direct GraphQL requests to Shopify Admin API
 * 3. Stores collections in the database associated with the session
 * 4. Creates product-collection relationships for products already in the database
 */

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

// GraphQL query to fetch collections with their products
const COLLECTIONS_QUERY = `
  query getCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      edges {
        node {
          id
          legacyResourceId
          handle
          title
          description
          descriptionHtml
          sortOrder
          image {
            url
          }
          productsCount {
            count
          }
          ruleSet {
            appliedDisjunctively
            rules {
              column
              condition
              relation
            }
          }
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// GraphQL query to fetch products in a collection
const COLLECTION_PRODUCTS_QUERY = `
  query getCollectionProducts($collectionId: ID!, $first: Int!, $after: String) {
    collection(id: $collectionId) {
      products(first: $first, after: $after) {
        edges {
          node {
            id
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
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
 * Fetch all products in a collection
 */
async function fetchCollectionProducts(shop, accessToken, collectionId) {
  const productIds = [];
  let hasNextPage = true;
  let cursor = null;
  const batchSize = 250;

  while (hasNextPage) {
    const response = await makeGraphQLRequest(
      shop,
      accessToken,
      COLLECTION_PRODUCTS_QUERY,
      {
        collectionId,
        first: batchSize,
        after: cursor
      }
    );

    const products = response.data.collection?.products;
    if (!products) break;

    hasNextPage = products.pageInfo.hasNextPage;
    cursor = products.pageInfo.endCursor;

    for (const edge of products.edges) {
      productIds.push(edge.node.id);
    }
  }

  return productIds;
}

/**
 * Sync collections for a specific session
 */
async function syncCollectionsForSession(session) {
  console.log(`\n🔄 Starting collection sync for shop: ${session.shop} (Session: ${session.id})`);

  let hasNextPage = true;
  let cursor = null;
  let totalCollectionsSynced = 0;
  let totalProductRelationsSynced = 0;
  const batchSize = 50;

  try {
    // Clear existing collections and product-collection relationships for this session
    console.log('  Clearing existing collections...');

    // First delete product-collection relationships for collections in this session
    const existingCollections = await prisma.collection.findMany({
      where: { sessionId: session.id },
      select: { id: true }
    });

    if (existingCollections.length > 0) {
      await prisma.productCollection.deleteMany({
        where: {
          collectionId: {
            in: existingCollections.map(c => c.id)
          }
        }
      });
    }

    await prisma.collection.deleteMany({
      where: { sessionId: session.id }
    });

    console.log('  Fetching collections from Shopify...');

    while (hasNextPage) {
      // Fetch collections from Shopify
      const response = await makeGraphQLRequest(
        session.shop,
        session.accessToken,
        COLLECTIONS_QUERY,
        {
          first: batchSize,
          after: cursor
        }
      );

      const collections = response.data.collections;
      hasNextPage = collections.pageInfo.hasNextPage;
      cursor = collections.pageInfo.endCursor;

      // Process each collection
      for (const edge of collections.edges) {
        const collection = edge.node;

        try {
          // Determine collection type based on presence of ruleSet
          const collectionType = collection.ruleSet ? 'smart' : 'manual';

          // Create collection record
          await prisma.collection.create({
            data: {
              id: collection.id,
              sessionId: session.id,
              legacyResourceId: collection.legacyResourceId.toString(),
              handle: collection.handle,
              title: collection.title,
              description: collection.description || '',
              descriptionHtml: collection.descriptionHtml,
              collectionType,
              sortOrder: collection.sortOrder,
              imageUrl: collection.image?.url || null,
              productsCount: collection.productsCount?.count || 0,
              ruleSet: collection.ruleSet ? JSON.stringify(collection.ruleSet.rules) : null,
              disjunctive: collection.ruleSet?.appliedDisjunctively || false,
              syncedAt: new Date()
            }
          });

          totalCollectionsSynced++;

          // Fetch and sync product relationships
          console.log(`  📦 Fetching products for collection: ${collection.title}...`);
          const productIds = await fetchCollectionProducts(session.shop, session.accessToken, collection.id);

          // Create product-collection relationships for products that exist in our database
          if (productIds.length > 0) {
            // Find which products exist in our database
            const existingProducts = await prisma.product.findMany({
              where: {
                id: { in: productIds },
                sessionId: session.id
              },
              select: { id: true }
            });

            const existingProductIds = new Set(existingProducts.map(p => p.id));

            // Create relationships with position (one at a time for SQLite compatibility)
            const matchingProductIds = productIds.filter(productId => existingProductIds.has(productId));

            for (let i = 0; i < matchingProductIds.length; i++) {
              try {
                await prisma.productCollection.create({
                  data: {
                    productId: matchingProductIds[i],
                    collectionId: collection.id,
                    position: i + 1
                  }
                });
                totalProductRelationsSynced++;
              } catch (e) {
                // Skip duplicates silently (unique constraint violation)
                if (!e.message.includes('Unique constraint')) {
                  console.error(`    Warning: Failed to link product ${matchingProductIds[i]}: ${e.message}`);
                }
              }
            }
          }
        } catch (collectionError) {
          console.error(`  ❌ Error syncing collection ${collection.title}:`, collectionError.message);
        }
      }

      console.log(`  ✓ Synced batch: ${totalCollectionsSynced} collections, ${totalProductRelationsSynced} product relations so far...`);
    }

    console.log(`✅ Successfully synced ${totalCollectionsSynced} collections with ${totalProductRelationsSynced} product relations for ${session.shop}`);

    return {
      shop: session.shop,
      sessionId: session.id,
      collectionsCount: totalCollectionsSynced,
      productRelationsCount: totalProductRelationsSynced,
      success: true
    };

  } catch (error) {
    console.error(`❌ Failed to sync collections for ${session.shop}:`, error.message);
    return {
      shop: session.shop,
      sessionId: session.id,
      collectionsCount: 0,
      productRelationsCount: 0,
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
    console.log('🚀 Shopify Collection Sync Utility');
    console.log('===================================\n');

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
      const result = await syncCollectionsForSession(session);
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
        console.log(`   - ${r.shop}: ${r.collectionsCount} collections, ${r.productRelationsCount} product relations`);
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed syncs:');
      failed.forEach(r => {
        console.log(`   - ${r.shop}: ${r.error}`);
      });
    }

    const totalCollections = successful.reduce((acc, r) => acc + r.collectionsCount, 0);
    const totalRelations = successful.reduce((acc, r) => acc + r.productRelationsCount, 0);

    console.log('\n📈 Total synced:');
    console.log(`   Collections: ${totalCollections}`);
    console.log(`   Product Relations: ${totalRelations}`);

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
