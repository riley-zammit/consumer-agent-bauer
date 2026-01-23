import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;

/**
 * Store a code verifier for PKCE authentication
 * @param {string} state - The state parameter used in OAuth flow
 * @param {string} verifier - The code verifier to store
 * @returns {Promise<Object>} - The saved code verifier object
 */
export async function storeCodeVerifier(state, verifier) {
  // Calculate expiration date (10 minutes from now)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  try {
    return await prisma.codeVerifier.create({
      data: {
        id: `cv_${Date.now()}`,
        state,
        verifier,
        expiresAt
      }
    });
  } catch (error) {
    console.error('Error storing code verifier:', error);
    throw error;
  }
}

/**
 * Get a code verifier by state parameter
 * @param {string} state - The state parameter used in OAuth flow
 * @returns {Promise<Object|null>} - The code verifier object or null if not found
 */
export async function getCodeVerifier(state) {
  try {
    const verifier = await prisma.codeVerifier.findFirst({
      where: {
        state,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (verifier) {
      // Delete it after retrieval to prevent reuse
      await prisma.codeVerifier.delete({
        where: {
          id: verifier.id
        }
      });
    }

    return verifier;
  } catch (error) {
    console.error('Error retrieving code verifier:', error);
    return null;
  }
}

/**
 * Store a customer access token in the database
 * @param {string} conversationId - The conversation ID to associate with the token
 * @param {string} accessToken - The access token to store
 * @param {Date} expiresAt - When the token expires
 * @returns {Promise<Object>} - The saved customer token
 */
export async function storeCustomerToken(conversationId, accessToken, expiresAt) {
  try {
    // Check if a token already exists for this conversation
    const existingToken = await prisma.customerToken.findFirst({
      where: { conversationId }
    });

    if (existingToken) {
      // Update existing token
      return await prisma.customerToken.update({
        where: { id: existingToken.id },
        data: {
          accessToken,
          expiresAt,
          updatedAt: new Date()
        }
      });
    }

    // Create a new token record
    return await prisma.customerToken.create({
      data: {
        id: `ct_${Date.now()}`,
        conversationId,
        accessToken,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error storing customer token:', error);
    throw error;
  }
}

/**
 * Get a customer access token by conversation ID
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object|null>} - The customer token or null if not found/expired
 */
export async function getCustomerToken(conversationId) {
  console.log("[getCustomerToken] Looking up token for conversationId:", conversationId);
  console.log("[getCustomerToken] Current time:", new Date().toISOString());
  
  try {
    // First, let's see ALL tokens for this conversation (including expired) for debugging
    const allTokens = await prisma.customerToken.findMany({
      where: { conversationId }
    });
    console.log("[getCustomerToken] All tokens for this conversation:", allTokens.map(t => ({
      id: t.id,
      conversationId: t.conversationId,
      tokenLength: t.accessToken?.length || 0,
      tokenPreview: t.accessToken ? t.accessToken.substring(0, 20) + "..." : "N/A",
      expiresAt: t.expiresAt,
      isExpired: new Date(t.expiresAt) < new Date(),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    })));
    
    const token = await prisma.customerToken.findFirst({
      where: {
        conversationId,
        expiresAt: {
          gt: new Date() // Only return non-expired tokens
        }
      }
    });

    console.log("[getCustomerToken] Valid (non-expired) token found:", token ? {
      id: token.id,
      conversationId: token.conversationId,
      tokenLength: token.accessToken?.length || 0,
      expiresAt: token.expiresAt,
      createdAt: token.createdAt
    } : "NONE");

    return token;
  } catch (error) {
    console.error('[getCustomerToken] Error retrieving customer token:', error);
    return null;
  }
}

/**
 * Store mock sensitive data for a customer conversation
 * @param {string} conversationId - The conversation ID
 * @param {string} data - Serialized mock sensitive data
 * @returns {Promise<Object>} - The saved record
 */
export async function storeCustomerSensitiveData(conversationId, data) {
  try {
    return await prisma.customerSensitiveData.create({
      data: {
        conversationId,
        data
      }
    });
  } catch (error) {
    console.error('Error storing customer sensitive data:', error);
    throw error;
  }
}

/**
 * Create or update a customer support ticket scoped to a conversation
 * @param {Object} params
 * @param {string} params.conversationId - Conversation identifier (required)
 * @param {string} [params.ticketId] - Existing ticket id to update
 * @param {string} [params.subject] - Ticket subject/title
 * @param {string} [params.message] - Latest message or note
 * @param {string} [params.status] - Ticket status: open|pending|resolved|closed
 * @param {any} [params.metadata] - Optional structured metadata
 * @returns {Promise<Object>} - The created or updated ticket
 */
export async function upsertCustomerSupportTicket({
  conversationId,
  ticketId,
  subject,
  message,
  status,
  metadata
}) {
  if (!conversationId) {
    throw new Error("conversationId is required to upsert a ticket");
  }

  const allowedStatuses = new Set(["open", "pending", "resolved", "closed"]);
  const normalizedStatus = status && allowedStatuses.has(status.toLowerCase())
    ? status.toLowerCase()
    : "open";

  const safeMetadata =
    metadata === undefined || metadata === null
      ? null
      : typeof metadata === "string"
        ? metadata
        : JSON.stringify(metadata);

  const baseData = {
    conversationId,
    subject: subject || "Customer support request",
    message: message || null,
    status: normalizedStatus,
    metadata: safeMetadata,
  };

  try {
    if (ticketId) {
      const existing = await prisma.customerSupportTicket.findFirst({
        where: { id: ticketId, conversationId }
      });

      if (!existing) {
        throw new Error("Ticket not found for this conversation");
      }

      return await prisma.customerSupportTicket.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          updatedAt: new Date()
        }
      });
    }

    return await prisma.customerSupportTicket.create({
      data: baseData
    });
  } catch (error) {
    console.error('Error upserting customer support ticket:', error);
    throw error;
  }
}

/**
 * Fetch the most recent ticket for a conversation
 * @param {string} conversationId - Conversation identifier
 * @returns {Promise<Object|null>} - Latest ticket or null
 */
export async function getMostRecentCustomerSupportTicket(conversationId) {
  if (!conversationId) return null;

  try {
    return await prisma.customerSupportTicket.findFirst({
      where: { conversationId },
      orderBy: { updatedAt: "desc" }
    });
  } catch (error) {
    console.error('Error retrieving most recent customer support ticket:', error);
    return null;
  }
}

/**
 * Fetch a specific ticket by id for a conversation
 * @param {string} conversationId
 * @param {string} ticketId
 * @returns {Promise<Object|null>}
 */
export async function getCustomerSupportTicketById(conversationId, ticketId) {
  if (!conversationId || !ticketId) return null;

  try {
    return await prisma.customerSupportTicket.findFirst({
      where: { id: ticketId, conversationId }
    });
  } catch (error) {
    console.error('Error retrieving customer support ticket by id:', error);
    return null;
  }
}

/**
 * Create or update a conversation in the database
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object>} - The created or updated conversation
 */
export async function createOrUpdateConversation(conversationId) {
  try {
    const existingConversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (existingConversation) {
      return await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date()
        }
      });
    }

    return await prisma.conversation.create({
      data: {
        id: conversationId
      }
    });
  } catch (error) {
    console.error('Error creating/updating conversation:', error);
    throw error;
  }
}

/**
 * Save a message to the database
 * @param {string} conversationId - The conversation ID
 * @param {string} role - The message role (user or assistant)
 * @param {string} content - The message content
 * @returns {Promise<Object>} - The saved message
 */
export async function saveMessage(conversationId, role, content) {
  try {
    // Ensure the conversation exists
    await createOrUpdateConversation(conversationId);

    // Create the message
    return await prisma.message.create({
      data: {
        conversationId,
        role,
        content
      }
    });
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
}

/**
 * Get conversation history
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Array>} - Array of messages in the conversation
 */
export async function getConversationHistory(conversationId) {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });

    return messages;
  } catch (error) {
    console.error('Error retrieving conversation history:', error);
    return [];
  }
}

/**
 * Store customer account URLs for a conversation
 * @param {string} conversationId - The conversation ID
 * @param {string} mcpApiUrl - The customer account MCP URL
 * @param {string} authorizationUrl - The customer account authorization URL
 * @param {string} tokenUrl - The customer account token URL
 * @returns {Promise<Object>} - The saved urls object
 */
export async function storeCustomerAccountUrls({conversationId, mcpApiUrl, authorizationUrl, tokenUrl}) {
  try {
    return await prisma.customerAccountUrls.upsert({
      where: { conversationId },
      create: {
        conversationId,
        mcpApiUrl,
        authorizationUrl,
        tokenUrl,
        updatedAt: new Date(),
      },
      update: {
        mcpApiUrl,
        authorizationUrl,
        tokenUrl,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error storing customer account URLs:', error);
    throw error;
  }
}

/**
 * Get customer account URLs for a conversation
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object|null>} - The customer account URLs or null if not found
 */
export async function getCustomerAccountUrls(conversationId) {
  try {
    return await prisma.customerAccountUrls.findUnique({
      where: { conversationId }
    });
  } catch (error) {
    console.error('Error retrieving customer account URLs:', error);
    return null;
  }
}
