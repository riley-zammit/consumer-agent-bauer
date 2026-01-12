#!/usr/bin/env node
/* eslint-env node */

/**
 * Generate a Storefront Access Token for server-side Storefront API calls
 *
 * Usage:
 *   node scripts/generate-storefront-token.js [sessionId]
 *
 * If sessionId is not provided, it will generate for the first session.
 *
 * Requirements:
 * - Your app must have unauthenticated_* scopes (e.g., unauthenticated_read_product_listings)
 * - The token will be stored in the Session.storefrontToken field
 */

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

// GraphQL mutation to create a storefront access token (public)
const STOREFRONT_TOKEN_CREATE = `
  mutation storefrontAccessTokenCreate($input: StorefrontAccessTokenInput!) {
    storefrontAccessTokenCreate(input: $input) {
      storefrontAccessToken {
        accessToken
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// GraphQL mutation to create a delegate access token (private, for server-side use)
const DELEGATE_TOKEN_CREATE = `
  mutation delegateAccessTokenCreate($input: DelegateAccessTokenInput!) {
    delegateAccessTokenCreate(input: $input) {
      delegateAccessToken {
        accessToken
        accessScopes
        createdAt
      }
      shop {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// GraphQL query to check current app installation details
const APP_INSTALLATION_QUERY = `
  query {
    app {
      installation {
        accessScopes {
          handle
        }
      }
    }
  }
`;

/**
 * Make a GraphQL request to Shopify Admin API
 */
async function makeGraphQLRequest(shop, accessToken, query, variables = {}) {
  const apiVersion = '2025-01';
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
    const errorText = await response.text();
    throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
  }

  const data = await response.json();

  if (data.errors) {
    console.error('GraphQL errors:', JSON.stringify(data.errors, null, 2));
    throw new Error('GraphQL request failed with errors');
  }

  return data;
}

/**
 * Check current app scopes
 */
async function checkAppScopes(session) {
  try {
    const response = await makeGraphQLRequest(
      session.shop,
      session.accessToken,
      APP_INSTALLATION_QUERY
    );

    const scopes = response.data?.app?.installation?.accessScopes || [];
    return scopes.map(s => s.handle);
  } catch (error) {
    console.warn('⚠️  Could not check app scopes:', error.message);
    return [];
  }
}

/**
 * Generate delegate access token for a session (preferred for server-side)
 */
async function generateDelegateToken(session, availableScopes) {
  console.log(`\n🔑 Trying delegate access token for shop: ${session.shop}`);

  // Only request scopes that the app actually has
  const unauthScopes = availableScopes.filter(scope => scope.startsWith('unauthenticated_'));
  
  if (unauthScopes.length === 0) {
    throw new Error('No unauthenticated scopes available. App must be granted unauthenticated scopes.');
  }

  const response = await makeGraphQLRequest(
    session.shop,
    session.accessToken,
    DELEGATE_TOKEN_CREATE,
    {
      input: {
        // Only request scopes that are actually available
        delegateAccessScope: unauthScopes,
        // Token expires in 30 days (in seconds)
        expiresIn: 30 * 24 * 60 * 60
      }
    }
  );

  const result = response.data.delegateAccessTokenCreate;

  if (result.userErrors && result.userErrors.length > 0) {
    throw new Error(result.userErrors.map(e => e.message).join(', '));
  }

  return {
    token: result.delegateAccessToken.accessToken,
    scopes: result.delegateAccessToken.accessScopes,
    type: 'delegate'
  };
}

/**
 * Generate storefront access token for a session (public token)
 */
async function generateStorefrontToken(session) {
  console.log(`\n🔑 Trying storefront access token for shop: ${session.shop}`);

  const response = await makeGraphQLRequest(
    session.shop,
    session.accessToken,
    STOREFRONT_TOKEN_CREATE,
    {
      input: {
        title: `Consumer Agent - ${new Date().toISOString()}`
      }
    }
  );

  const result = response.data.storefrontAccessTokenCreate;

  if (result.userErrors && result.userErrors.length > 0) {
    throw new Error(result.userErrors.map(e => e.message).join(', '));
  }

  return {
    token: result.storefrontAccessToken.accessToken,
    type: 'storefront'
  };
}

/**
 * Generate token for a session - tries delegate first, then storefront
 */
async function generateTokenForSession(session) {
  console.log(`\n🔑 Generating token for shop: ${session.shop}`);

  // First, check what scopes the app has
  const availableScopes = await checkAppScopes(session);
  console.log(`\n📋 Current app scopes: ${availableScopes.join(', ') || 'None detected'}`);

  const unauthScopes = availableScopes.filter(scope => scope.startsWith('unauthenticated_'));
  
  if (unauthScopes.length === 0) {
    console.error(`\n❌ No unauthenticated scopes found!`);
    console.error(`\n   The app needs unauthenticated scopes to generate Storefront API tokens.`);
    console.error(`\n   Required steps:`);
    console.error(`   1. Update shopify.app.toml with unauthenticated_scopes`);
    console.error(`   2. Run: shopify app deploy`);
    console.error(`   3. Reinstall the app: shopify app dev`);
    console.error(`   4. Run this script again`);
    
    return {
      shop: session.shop,
      sessionId: session.id,
      success: false,
      error: 'App lacks unauthenticated scopes. See instructions above.',
      missingScopes: true
    };
  }

  let tokenResult;

  // Force regular storefront token as requested by user
  try {
    tokenResult = await generateStorefrontToken(session);
    console.log(`✅ Storefront token created: ${tokenResult.token.substring(0, 8)}...`);
  } catch (storefrontError) {
    console.log(`⚠️  Storefront token failed: ${storefrontError.message}`);
    console.log(`   Trying delegate token instead...`);

    // Fall back to delegate token
    try {
      tokenResult = await generateDelegateToken(session, availableScopes);
      console.log(`✅ Delegate token created: ${tokenResult.token.substring(0, 8)}...`);
      console.log(`   Scopes: ${tokenResult.scopes.join(', ')}`);
    } catch (delegateError) {
      console.error(`❌ Both token methods failed`);
      console.error(`   Storefront error: ${storefrontError.message}`);
      console.error(`   Delegate error: ${delegateError.message}`);
      return {
        shop: session.shop,
        sessionId: session.id,
        success: false,
        error: `Storefront: ${storefrontError.message}; Delegate: ${delegateError.message}`
      };
    }
  }

  // Update session with the token
  await prisma.session.update({
    where: { id: session.id },
    data: { storefrontToken: tokenResult.token }
  });

  console.log(`💾 Token saved to session ${session.id}`);

  return {
    shop: session.shop,
    sessionId: session.id,
    token: tokenResult.token,
    tokenType: tokenResult.type,
    scopes: tokenResult.scopes || unauthScopes,
    success: true
  };
}

/**
 * Main function
 */
async function main() {
  const sessionId = process.argv[2];

  try {
    console.log('🚀 Storefront Access Token Generator');
    console.log('=====================================\n');

    let session;

    if (sessionId) {
      session = await prisma.session.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        console.error(`❌ Session not found: ${sessionId}`);
        process.exit(1);
      }
    } else {
      // Get first session
      session = await prisma.session.findFirst();

      if (!session) {
        console.log('ℹ️  No sessions found in the database.');
        console.log('   Make sure the app is installed on at least one store.');
        process.exit(0);
      }
    }

    console.log(`📋 Session found:`);
    console.log(`   ID: ${session.id}`);
    console.log(`   Shop: ${session.shop}`);
    console.log(`   Existing token: ${session.storefrontToken ? 'Yes' : 'No'}`);

    const result = await generateTokenForSession(session);

    if (result.success) {
      console.log('\n✅ Success!');
      console.log(`\n📝 Token type: ${result.tokenType}`);
      
      if (result.scopes) {
        console.log(`   Available scopes: ${result.scopes.join(', ')}`);
      }

      if (result.tokenType === 'delegate') {
        console.log(`\n   For server-side Storefront API calls, use:`);
        console.log(`   Header: Shopify-Storefront-Private-Token: ${result.token}`);
        console.log(`\n   Also include buyer IP for traffic from customers:`);
        console.log(`   Header: Shopify-Storefront-Buyer-IP: <customer_ip>`);
        console.log(`\n   Example usage:`);
        console.log(`   const response = await fetch('https://${session.shop}/api/2025-01/graphql.json', {`);
        console.log(`     method: 'POST',`);
        console.log(`     headers: {`);
        console.log(`       'Shopify-Storefront-Private-Token': '${result.token}',`);
        console.log(`       'Shopify-Storefront-Buyer-IP': request.ip, // Customer's IP`);
        console.log(`       'Content-Type': 'application/json'`);
        console.log(`     },`);
        console.log(`     body: JSON.stringify({ query: STOREFRONT_QUERY })`);
        console.log(`   });`);
      } else {
        console.log(`\n   For Storefront API calls, use:`);
        console.log(`   Header: X-Shopify-Storefront-Access-Token: ${result.token}`);
        console.log(`\n   Example usage:`);
        console.log(`   const response = await fetch('https://${session.shop}/api/2025-01/graphql.json', {`);
        console.log(`     method: 'POST',`);
        console.log(`     headers: {`);
        console.log(`       'X-Shopify-Storefront-Access-Token': '${result.token}',`);
        console.log(`       'Content-Type': 'application/json'`);
        console.log(`     },`);
        console.log(`     body: JSON.stringify({ query: STOREFRONT_QUERY })`);
        console.log(`   });`);
      }
    } else if (result.missingScopes) {
      // Instructions already printed above
      process.exit(1);
    } else {
      console.log('\n❌ Failed to generate token');
      console.log(`   Error: ${result.error}`);
      process.exit(1);
    }

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
