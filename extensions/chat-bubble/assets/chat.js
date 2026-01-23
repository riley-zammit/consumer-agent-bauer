/**
 * Shop AI Chat - Client-side implementation
 *
 * This module handles the chat interface for the Shopify AI Chat application.
 * It manages the UI interactions, API communication, and message rendering.
 */
(function () {
    'use strict';

    /**
     * Application namespace to prevent global scope pollution
     */
    const ShopAIChat = {
        /**
         * Local cart ID tracking for detecting new cart creation (agent-first flow)
         */
        localCartId: null,

        /**
         * Cart cookie utilities for shared cart functionality
         */
        CartCookie: {
            /**
             * Check if a cart value looks like a GID (raw or URL-encoded)
             * @param {string|null} value - Cart value to inspect
             * @returns {boolean} True if value appears to be a GID
             */
            isGidLike: function (value) {
                if (!value || typeof value !== 'string') return false;
                return value.includes('gid://shopify/Cart/') || value.includes('gid%3A%2F%2Fshopify%2FCart%2F');
            },
            /**
             * Read the cart ID from the browser's cart cookie
             * @returns {string|null} The cart token/key value or null if no cart cookie exists
             */
            getCartIdFromCookie: function () {
                const match = document.cookie.match(/(?:^|; )cart=([^;]*)/);
                return match ? decodeURIComponent(match[1]) : null;
            },

            /**
             * Build the cart cookie value from cart data
             * Shopify's cart cookie uses the cart token and optional key, not a GID
             * @param {Object|string} cartOrId - Cart object (preferred) or cart ID string
             * @returns {string|null} Cart cookie value or null if unavailable
             */
            getCartCookieValue: function (cartOrId) {
                if (!cartOrId) return null;

                const cart = typeof cartOrId === 'object' ? cartOrId : null;
                let cartId = typeof cartOrId === 'string' ? cartOrId : cart?.id;
                const checkoutUrl = cart?.checkoutUrl;

                if (checkoutUrl) {
                    try {
                        const url = new URL(checkoutUrl, window.location.origin);
                        const key = url.searchParams.get('key');
                        const match = url.pathname.match(/\/cart\/c\/([^/]+)/) || url.pathname.match(/\/cart\/([^/]+)/);
                        const token = match ? match[1] : null;
                        if (token) {
                            return key ? `${token}?key=${key}` : token;
                        }
                    } catch {
                        // ignore invalid URL, fall through to cartId parsing
                    }
                }

                if (!cartId) return null;

                // Decode URL-encoded cart IDs if needed (e.g. gid%3A%2F%2Fshopify%2FCart%2F...)
                if (typeof cartId === 'string' && cartId.includes('%')) {
                    try {
                        cartId = decodeURIComponent(cartId);
                    } catch {
                        // ignore decode errors, keep original value
                    }
                }

                // If cartId is already a GID, strip the prefix to get the token
                if (cartId.startsWith('gid://shopify/Cart/')) {
                    return cartId.replace('gid://shopify/Cart/', '');
                }

                // Try to decode base64 IDs to extract the cart token
                const decoded = this.decodeCartId(cartId);
                if (decoded && decoded.startsWith('gid://shopify/Cart/')) {
                    return decoded.split('/').pop();
                }

                return cartId;
            },

            /**
             * Decode a Storefront API cart ID (base64) to its GID string
             * @param {string} cartId - Base64 cart ID
             * @returns {string|null} Decoded GID or null if invalid
             */
            decodeCartId: function (cartId) {
                if (!cartId || typeof cartId !== 'string') return null;
                try {
                    const normalized = cartId.replace(/-/g, '+').replace(/_/g, '/');
                    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
                    return atob(padded);
                } catch {
                    return null;
                }
            },

            /**
             * Set the cart cookie (used as fallback for SSE streams where Set-Cookie headers may not work)
             * Only call this when the agent creates a NEW cart (agent-first flow)
             * @param {Object|string} cartOrId - Cart object (preferred) or cart ID string
             */
            setCartCookie: function (cartOrId) {
                const cookieValue = this.getCartCookieValue(cartOrId);
                if (cookieValue) {
                    document.cookie = `cart=${encodeURIComponent(cookieValue)}; path=/; max-age=31536000; SameSite=Lax`;
                }
            },

            /**
             * Refresh the theme's cart count display after agent add-to-cart
             * This ensures the theme UI reflects items added via the agent
             * Uses Section Rendering API to update cart sections, with text fallback
             */
            refreshCartCount: async function () {
                try {
                    // Step 1: Fetch cart data
                    const response = await fetch('/cart.js');
                    if (!response.ok) return;
                    const cart = await response.json();

                    // Step 2: Try to refresh cart sections via Section Rendering API
                    await this.refreshCartSections();

                    // Step 3: Fallback - update text content for themes without sections
                    this.updateCartCountText(cart.item_count);

                    // Step 4: Dispatch custom event for themes that listen
                    document.dispatchEvent(new CustomEvent('cart:updated', {
                        detail: { itemCount: cart.item_count, cart: cart }
                    }));
                } catch (error) {
                    console.warn('Failed to refresh cart:', error);
                }
            },

            /**
             * Refresh cart-related sections using Section Rendering API
             * Gracefully handles themes without these sections
             */
            refreshCartSections: async function () {
                // Common cart section IDs across Shopify themes
                const sectionIds = [
                    'cart-icon-bubble',      // Dawn and many themes
                    'cart-drawer',           // Cart drawer
                    'cart-notification'      // Add-to-cart notification
                ].join(',');

                try {
                    const root = window.Shopify?.routes?.root || '/';
                    const response = await fetch(`${root}?sections=${sectionIds}`);
                    if (!response.ok) return;

                    const sections = await response.json();
                    this.updateCartSections(sections);
                } catch (error) {
                    // Section rendering failed - fall back to text update
                    console.warn('Section rendering unavailable:', error);
                }
            },

            /**
             * Replace section HTML in the DOM
             * @param {Object} sections - Object mapping section IDs to their HTML content
             */
            updateCartSections: function (sections) {
                Object.entries(sections).forEach(([sectionId, html]) => {
                    if (!html) return; // Section doesn't exist in theme

                    const selector = `#shopify-section-${sectionId}`;
                    const existingSection = document.querySelector(selector);

                    if (existingSection) {
                        // Create temp container to parse HTML
                        const temp = document.createElement('div');
                        temp.innerHTML = html;
                        const newSection = temp.firstElementChild;

                        if (newSection) {
                            // Replace existing section with new HTML
                            existingSection.replaceWith(newSection);
                        }
                    }
                });
            },

            /**
             * Fallback: Update cart count text elements
             * Used for themes without standard section structures
             * @param {number} itemCount - The number of items in the cart
             */
            updateCartCountText: function (itemCount) {
                const selectors = [
                    '.cart-count',
                    '.cart-count-bubble',
                    '[data-cart-count]',
                    '.header-cart-count',
                    '.cart-item-count',
                    '#CartCount',
                    '.js-cart-count',
                    '.cart-notification-count'
                ];

                selectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => {
                        el.textContent = itemCount;
                        if (itemCount > 0) {
                            el.style.display = '';
                        }
                    });
                });
            }
        },

        /**
         * UI-related elements and functionality
         */
        UI: {
            elements: {},
            isMobile: false,
            isMaximized: false,

            /**
             * Initialize UI elements and event listeners
             * @param {HTMLElement} container - The main container element
             */
            init: function (container) {
                if (!container) return;

                // Cache DOM elements
                this.elements = {
                    container: container,
                    chatBubble: container.querySelector('.shop-ai-chat-bubble'),
                    chatWindow: container.querySelector('.shop-ai-chat-window'),
                    closeButton: container.querySelector('.shop-ai-chat-close'),
                    chatInput: container.querySelector('.shop-ai-chat-input input'),
                    sendButton: container.querySelector('.shop-ai-chat-send'),
                    messagesContainer: container.querySelector('.shop-ai-chat-messages')
                };

                // Create and insert maximize button next to close button
                this.createMaximizeButton();

                // Detect mobile device
                this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

                // Set up event listeners
                this.setupEventListeners();

                // Fix for iOS Safari viewport height issues
                if (this.isMobile) {
                    this.setupMobileViewport();
                }
            },

            /**
             * Set up all event listeners for UI interactions
             */
            setupEventListeners: function () {
                const { chatBubble, closeButton, chatInput, sendButton, messagesContainer } = this.elements;

                // Toggle chat window visibility
                chatBubble.addEventListener('click', () => this.toggleChatWindow());

                // Close chat window
                closeButton.addEventListener('click', () => this.closeChatWindow());

                // Send message when pressing Enter in input
                chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
                        ShopAIChat.Message.send(chatInput, messagesContainer);

                        // On mobile, handle keyboard
                        if (this.isMobile) {
                            chatInput.blur();
                            setTimeout(() => chatInput.focus(), 300);
                        }
                    }
                });

                // Send message when clicking send button
                sendButton.addEventListener('click', () => {
                    if (chatInput.value.trim() !== '') {
                        ShopAIChat.Message.send(chatInput, messagesContainer);

                        // On mobile, focus input after sending
                        if (this.isMobile) {
                            setTimeout(() => chatInput.focus(), 300);
                        }
                    }
                });

                // Handle window resize to adjust scrolling
                window.addEventListener('resize', () => this.scrollToBottom());

                // Add global click handler for auth links
                document.addEventListener('click', function (event) {
                    if (event.target && event.target.classList.contains('shop-auth-trigger')) {
                        event.preventDefault();
                        if (window.shopAuthUrl) {
                            ShopAIChat.Auth.openAuthPopup(window.shopAuthUrl);
                        }
                    }
                    // Handle checkout button clicks
                    if (event.target && event.target.classList.contains('shop-ai-checkout-trigger')) {
                        event.preventDefault();
                        ShopAIChat.Checkout.openEmbeddedCheckout(event.target);
                    }
                });
            },

            /**
             * Setup mobile-specific viewport adjustments
             */
            setupMobileViewport: function () {
                const setViewportHeight = () => {
                    document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
                };
                window.addEventListener('resize', setViewportHeight);
                setViewportHeight();
            },

            /**
             * Toggle chat window visibility
             */
            toggleChatWindow: function () {
                const { chatWindow, chatInput } = this.elements;

                chatWindow.classList.toggle('active');

                if (chatWindow.classList.contains('active')) {
                    // On mobile, prevent body scrolling and delay focus
                    if (this.isMobile) {
                        document.body.classList.add('shop-ai-chat-open');
                        setTimeout(() => chatInput.focus(), 500);
                    } else {
                        chatInput.focus();
                    }
                    // Always scroll messages to bottom when opening
                    this.scrollToBottom();
                } else {
                    // Remove body class when closing
                    document.body.classList.remove('shop-ai-chat-open');
                }
            },

            /**
             * Close chat window
             */
            closeChatWindow: function () {
                const { chatWindow, chatInput } = this.elements;

                chatWindow.classList.remove('active');

                // On mobile, blur input to hide keyboard and enable body scrolling
                if (this.isMobile) {
                    chatInput.blur();
                    document.body.classList.remove('shop-ai-chat-open');
                }

                // Also exit maximized mode when closing
                if (this.isMaximized) {
                    this.toggleMaximize();
                }
            },

            /**
             * Create and insert the maximize button
             */
            createMaximizeButton: function () {
                const { closeButton } = this.elements;
                if (!closeButton) return;

                // Create maximize button
                const maximizeButton = document.createElement('button');
                maximizeButton.classList.add('shop-ai-chat-maximize');
                maximizeButton.setAttribute('aria-label', 'Maximize chat window');
                maximizeButton.innerHTML = `
                    <svg class="maximize-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 5V2H5M14 5V2H11M2 11V14H5M14 11V14H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <svg class="minimize-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: none;">
                        <path d="M5 2V5H2M11 2V5H14M5 14V11H2M11 14V11H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;

                // Insert before close button
                closeButton.parentNode.insertBefore(maximizeButton, closeButton);

                // Store reference
                this.elements.maximizeButton = maximizeButton;

                // Add click listener
                maximizeButton.addEventListener('click', () => this.toggleMaximize());
            },

            /**
             * Toggle maximized state of chat window
             */
            toggleMaximize: function () {
                const { chatWindow, maximizeButton } = this.elements;
                if (!chatWindow || !maximizeButton) return;

                this.isMaximized = !this.isMaximized;

                if (this.isMaximized) {
                    chatWindow.classList.add('maximized');
                    maximizeButton.setAttribute('aria-label', 'Restore chat window');
                    maximizeButton.querySelector('.maximize-icon').style.display = 'none';
                    maximizeButton.querySelector('.minimize-icon').style.display = 'block';
                    document.body.classList.add('shop-ai-chat-maximized');
                } else {
                    chatWindow.classList.remove('maximized');
                    maximizeButton.setAttribute('aria-label', 'Maximize chat window');
                    maximizeButton.querySelector('.maximize-icon').style.display = 'block';
                    maximizeButton.querySelector('.minimize-icon').style.display = 'none';
                    document.body.classList.remove('shop-ai-chat-maximized');
                }

                // Scroll to bottom after resize
                this.scrollToBottom();
            },

            /**
             * Scroll messages container to bottom
             */
            scrollToBottom: function () {
                const { messagesContainer } = this.elements;
                setTimeout(() => {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }, 100);
            },

            /**
             * Show typing indicator in the chat
             */
            showTypingIndicator: function () {
                const { messagesContainer } = this.elements;

                const typingIndicator = document.createElement('div');
                typingIndicator.classList.add('shop-ai-typing-indicator');
                typingIndicator.innerHTML = '<span></span><span></span><span></span>';
                messagesContainer.appendChild(typingIndicator);
                this.scrollToBottom();
            },

            /**
             * Remove typing indicator from the chat
             */
            removeTypingIndicator: function () {
                const { messagesContainer } = this.elements;

                const typingIndicator = messagesContainer.querySelector('.shop-ai-typing-indicator');
                if (typingIndicator) {
                    typingIndicator.remove();
                }
            },

            /**
             * Display product results in the chat
             * @param {Array} products - Array of product data objects
             */
            displayProductResults: function (products) {
                const { messagesContainer } = this.elements;

                // Create a wrapper for the product section
                const productSection = document.createElement('div');
                productSection.classList.add('shop-ai-product-section');
                messagesContainer.appendChild(productSection);

                // Add a header for the product results
                const header = document.createElement('div');
                header.classList.add('shop-ai-product-header');
                header.innerHTML = '<h4>Top Matching Products</h4>';
                productSection.appendChild(header);

                // Create the product grid container
                const productsContainer = document.createElement('div');
                productsContainer.classList.add('shop-ai-product-grid');
                productSection.appendChild(productsContainer);

                if (!products || !Array.isArray(products) || products.length === 0) {
                    const noProductsMessage = document.createElement('p');
                    noProductsMessage.textContent = "No products found";
                    noProductsMessage.style.padding = "10px";
                    productsContainer.appendChild(noProductsMessage);
                } else {
                    products.forEach(product => {
                        const productCard = ShopAIChat.Product.createCard(product);
                        productsContainer.appendChild(productCard);
                    });
                }

                this.scrollToBottom();
            }
        },

        /**
         * Message handling and display functionality
         */
        Message: {
            /**
             * Send a message to the API
             * @param {HTMLInputElement} chatInput - The input element
             * @param {HTMLElement} messagesContainer - The messages container
             */
            send: async function (chatInput, messagesContainer) {
                const userMessage = chatInput.value.trim();
                const conversationId = sessionStorage.getItem('shopAiConversationId');

                // Add user message to chat
                this.add(userMessage, 'user', messagesContainer);

                // Clear input
                chatInput.value = '';

                // Show typing indicator
                ShopAIChat.UI.showTypingIndicator();

                try {
                    ShopAIChat.API.streamResponse(userMessage, conversationId, messagesContainer);
                } catch (error) {
                    console.error('Error communicating with Claude API:', error);
                    ShopAIChat.UI.removeTypingIndicator();
                    this.add("Sorry, I couldn't process your request at the moment. Please try again later.", 'assistant', messagesContainer);
                }
            },

            /**
             * Add a message to the chat
             * @param {string} text - Message content
             * @param {string} sender - Message sender ('user' or 'assistant')
             * @param {HTMLElement} messagesContainer - The messages container
             * @returns {HTMLElement} The created message element
             */
            add: function (text, sender, messagesContainer) {
                const messageElement = document.createElement('div');
                messageElement.classList.add('shop-ai-message', sender);

                if (sender === 'assistant') {
                    messageElement.dataset.rawText = text;
                    ShopAIChat.Formatting.formatMessageContent(messageElement);
                } else {
                    messageElement.textContent = text;
                }

                messagesContainer.appendChild(messageElement);
                ShopAIChat.UI.scrollToBottom();

                return messageElement;
            },

            /**
             * Add a tool use message to the chat with expandable arguments
             * @param {string} toolMessage - Tool use message content
             * @param {HTMLElement} messagesContainer - The messages container
             */
            addToolUse: function (toolMessage, messagesContainer) {
                // Parse the tool message to extract tool name and arguments
                const match = toolMessage.match(/Calling tool: (\w+) with arguments: (.+)/);
                if (!match) {
                    // Fallback for unexpected format
                    const toolUseElement = document.createElement('div');
                    toolUseElement.classList.add('shop-ai-message', 'tool-use');
                    toolUseElement.textContent = toolMessage;
                    messagesContainer.appendChild(toolUseElement);
                    ShopAIChat.UI.scrollToBottom();
                    return;
                }

                const toolName = match[1];
                const argsString = match[2];

                // Create the main tool use element
                const toolUseElement = document.createElement('div');
                toolUseElement.classList.add('shop-ai-message', 'tool-use');

                // Create the header (always visible)
                const headerElement = document.createElement('div');
                headerElement.classList.add('shop-ai-tool-header');

                const toolText = document.createElement('span');
                toolText.classList.add('shop-ai-tool-text');
                toolText.textContent = `Calling tool: ${toolName}`;

                const toggleElement = document.createElement('span');
                toggleElement.classList.add('shop-ai-tool-toggle');
                toggleElement.textContent = '[+]';

                headerElement.appendChild(toolText);
                headerElement.appendChild(toggleElement);

                // Create the arguments section (initially hidden)
                const argsElement = document.createElement('div');
                argsElement.classList.add('shop-ai-tool-args');

                try {
                    // Try to format JSON arguments nicely
                    const parsedArgs = JSON.parse(argsString);
                    argsElement.textContent = JSON.stringify(parsedArgs, null, 2);
                } catch (e) {
                    // If not valid JSON, just show as-is
                    argsElement.textContent = argsString;
                }

                // Add click handler to toggle arguments visibility
                headerElement.addEventListener('click', function () {
                    const isExpanded = argsElement.classList.contains('expanded');
                    if (isExpanded) {
                        argsElement.classList.remove('expanded');
                        toggleElement.textContent = '[+]';
                    } else {
                        argsElement.classList.add('expanded');
                        toggleElement.textContent = '[-]';
                    }
                });

                // Assemble the complete element
                toolUseElement.appendChild(headerElement);
                toolUseElement.appendChild(argsElement);

                messagesContainer.appendChild(toolUseElement);
                ShopAIChat.UI.scrollToBottom();
            }
        },

        /**
         * Text formatting and markdown handling
         */
        Formatting: {
            /**
             * Format message content with markdown and links
             * @param {HTMLElement} element - The element to format
             */
            formatMessageContent: function (element) {
                if (!element || !element.dataset.rawText) return;

                const rawText = element.dataset.rawText;

                // Process the text with various Markdown features
                let processedText = rawText;

                // Process Markdown links
                const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                processedText = processedText.replace(markdownLinkRegex, (match, text, url) => {
                    // Check if it's an auth URL
                    if (url.includes('shopify.com/authentication') &&
                        (url.includes('oauth/authorize') || url.includes('authentication'))) {
                        // Store the auth URL in a global variable for later use - this avoids issues with onclick handlers
                        window.shopAuthUrl = url;
                        // Just return normal link that will be handled by the document click handler
                        return '<a href="#auth" class="shop-auth-trigger">' + text + '</a>';
                    }
                    // If it's a checkout link, use embedded checkout component
                    else if (url.includes('/cart') || url.includes('checkout')) {
                        // Store checkout URL for the component
                        const checkoutId = 'checkout-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                        return '<button class="shop-ai-checkout-trigger" data-checkout-url="' + url + '" data-checkout-id="' + checkoutId + '">Proceed to Checkout</button>';
                    } else {
                        // For normal links, preserve the original text
                        return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + text + '</a>';
                    }
                });

                // Convert text to HTML with proper list handling
                processedText = this.convertMarkdownToHtml(processedText);

                // Apply the formatted HTML
                element.innerHTML = processedText;
            },

            /**
             * Convert Markdown text to HTML with list support
             * @param {string} text - Markdown text to convert
             * @returns {string} HTML content
             */
            convertMarkdownToHtml: function (text) {
                text = text.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');
                const lines = text.split('\n');
                let currentList = null;
                let listItems = [];
                let htmlContent = '';
                let startNumber = 1;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const unorderedMatch = line.match(/^\s*([-*])\s+(.*)/);
                    const orderedMatch = line.match(/^\s*(\d+)[.)]\s+(.*)/);

                    if (unorderedMatch) {
                        if (currentList !== 'ul') {
                            if (currentList === 'ol') {
                                htmlContent += `<ol start="${startNumber}">` + listItems.join('') + '</ol>';
                                listItems = [];
                            }
                            currentList = 'ul';
                        }
                        listItems.push('<li>' + unorderedMatch[2] + '</li>');
                    } else if (orderedMatch) {
                        if (currentList !== 'ol') {
                            if (currentList === 'ul') {
                                htmlContent += '<ul>' + listItems.join('') + '</ul>';
                                listItems = [];
                            }
                            currentList = 'ol';
                            startNumber = parseInt(orderedMatch[1], 10);
                        }
                        listItems.push('<li>' + orderedMatch[2] + '</li>');
                    } else {
                        if (currentList) {
                            htmlContent += currentList === 'ul'
                                ? '<ul>' + listItems.join('') + '</ul>'
                                : `<ol start="${startNumber}">` + listItems.join('') + '</ol>';
                            listItems = [];
                            currentList = null;
                        }

                        if (line.trim() === '') {
                            htmlContent += '<br>';
                        } else {
                            htmlContent += '<p>' + line + '</p>';
                        }
                    }
                }

                if (currentList) {
                    htmlContent += currentList === 'ul'
                        ? '<ul>' + listItems.join('') + '</ul>'
                        : '<ol start="' + startNumber + '">' + listItems.join('') + '</ol>';
                }

                htmlContent = htmlContent.replace(/<\/p><p>/g, '</p>\n<p>');
                return htmlContent;
            }
        },

        /**
         * API communication and data handling
         */
        API: {
            /**
             * Stream a response from the API
             * @param {string} userMessage - User's message text
             * @param {string} conversationId - Conversation ID for context
             * @param {HTMLElement} messagesContainer - The messages container
             */
            streamResponse: async function (userMessage, conversationId, messagesContainer) {
                let currentMessageElement = null;

                try {
                    const promptType = window.shopChatConfig?.promptType || "standardAssistant";
                    // Read cart ID from cookie and pass to server for shared cart functionality
                    const cartId = ShopAIChat.CartCookie.getCartIdFromCookie();
                    const requestBody = JSON.stringify({
                        message: userMessage,
                        conversation_id: conversationId,
                        prompt_type: promptType,
                        cart_id: cartId  // null is valid - server will create new cart if needed
                    });

                    const streamUrl = 'https://localhost:3458/chat';
                    const shopId = window.shopId;

                    const response = await fetch(streamUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'text/event-stream',
                            'X-Shopify-Shop-Id': shopId
                        },
                        body: requestBody
                    });

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';

                    // Create initial message element
                    let messageElement = document.createElement('div');
                    messageElement.classList.add('shop-ai-message', 'assistant');
                    messageElement.textContent = '';
                    messageElement.dataset.rawText = '';
                    messagesContainer.appendChild(messageElement);
                    currentMessageElement = messageElement;

                    // Process the stream
                    // eslint-disable-next-line no-constant-condition
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    this.handleStreamEvent(data, currentMessageElement, messagesContainer, userMessage,
                                        (newElement) => { currentMessageElement = newElement; });
                                } catch (e) {
                                    console.error('Error parsing event data:', e, line);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error in streaming:', error);
                    ShopAIChat.UI.removeTypingIndicator();
                    ShopAIChat.Message.add("Sorry, I couldn't process your request. Please try again later.",
                        'assistant', messagesContainer);
                }
            },

            /**
             * Handle stream events from the API
             * @param {Object} data - Event data
             * @param {HTMLElement} currentMessageElement - Current message element being updated
             * @param {HTMLElement} messagesContainer - The messages container
             * @param {string} userMessage - The original user message
             * @param {Function} updateCurrentElement - Callback to update the current element reference
             */
            handleStreamEvent: function (data, currentMessageElement, messagesContainer, userMessage, updateCurrentElement) {
                switch (data.type) {
                    case 'id':
                        if (data.conversation_id) {
                            sessionStorage.setItem('shopAiConversationId', data.conversation_id);
                        }
                        break;

                    case 'chunk':
                        ShopAIChat.UI.removeTypingIndicator();
                        currentMessageElement.dataset.rawText += data.chunk;
                        currentMessageElement.textContent = currentMessageElement.dataset.rawText;
                        ShopAIChat.UI.scrollToBottom();
                        break;

                    case 'message_complete':
                        ShopAIChat.UI.removeTypingIndicator();
                        ShopAIChat.Formatting.formatMessageContent(currentMessageElement);
                        ShopAIChat.UI.scrollToBottom();
                        break;

                    case 'end_turn':
                        ShopAIChat.UI.removeTypingIndicator();
                        break;

                    case 'error':
                        console.error('Stream error:', data.error);
                        ShopAIChat.UI.removeTypingIndicator();
                        currentMessageElement.textContent = "Sorry, I couldn't process your request. Please try again later.";
                        break;

                    case 'rate_limit_exceeded':
                        console.error('Rate limit exceeded:', data.error);
                        ShopAIChat.UI.removeTypingIndicator();
                        currentMessageElement.textContent = "Sorry, our servers are currently busy. Please try again later.";
                        break;

                    case 'auth_required':
                        // Save the last user message for resuming after authentication
                        sessionStorage.setItem('shopAiLastMessage', userMessage || '');
                        break;

                    case 'product_results':
                        ShopAIChat.UI.displayProductResults(data.products);
                        break;

                    case 'tool_use':
                        if (data.tool_use_message) {
                            ShopAIChat.Message.addToolUse(data.tool_use_message, messagesContainer);
                        }
                        break;

                    case 'new_message': {
                        ShopAIChat.Formatting.formatMessageContent(currentMessageElement);
                        ShopAIChat.UI.showTypingIndicator();

                        // Create new message element for the next response
                        const newMessageElement = document.createElement('div');
                        newMessageElement.classList.add('shop-ai-message', 'assistant');
                        newMessageElement.textContent = '';
                        newMessageElement.dataset.rawText = '';
                        messagesContainer.appendChild(newMessageElement);

                        // Update the current element reference
                        updateCurrentElement(newMessageElement);
                        break;
                    }

                    case 'content_block_complete':
                        ShopAIChat.UI.showTypingIndicator();
                        break;

                    case 'cart_updated':
                        // Handle cart updates from agent add-to-cart operations
                        // Only set cookie if we didn't have a cart before (agent-first flow)
                        if (data.cart && (!ShopAIChat.localCartId || ShopAIChat.CartCookie.isGidLike(ShopAIChat.localCartId))) {
                            const cookieValue = ShopAIChat.CartCookie.getCartCookieValue(data.cart);
                            if (cookieValue) {
                                ShopAIChat.CartCookie.setCartCookie(cookieValue);
                                ShopAIChat.localCartId = cookieValue;
                            }
                        }
                        // Always refresh theme cart count after agent adds to cart
                        ShopAIChat.CartCookie.refreshCartCount();
                        break;
                }
            },

            /**
             * Fetch chat history from the server
             * @param {string} conversationId - Conversation ID
             * @param {HTMLElement} messagesContainer - The messages container
             */
            fetchChatHistory: async function (conversationId, messagesContainer) {
                try {
                    // Show a loading message
                    const loadingMessage = document.createElement('div');
                    loadingMessage.classList.add('shop-ai-message', 'assistant');
                    loadingMessage.textContent = "Loading conversation history...";
                    messagesContainer.appendChild(loadingMessage);

                    // Fetch history from the server
                    const historyUrl = `https://localhost:3458/chat?history=true&conversation_id=${encodeURIComponent(conversationId)}`;
                    console.log('Fetching history from:', historyUrl);

                    const response = await fetch(historyUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        mode: 'cors'
                    });

                    if (!response.ok) {
                        console.error('History fetch failed:', response.status, response.statusText);
                        throw new Error('Failed to fetch chat history: ' + response.status);
                    }

                    const data = await response.json();

                    // Remove loading message
                    messagesContainer.removeChild(loadingMessage);

                    // No messages, show welcome message
                    if (!data.messages || data.messages.length === 0) {
                        const welcomeMessage = window.shopChatConfig?.welcomeMessage || "👋 Hi there! How can I help you today?";
                        ShopAIChat.Message.add(welcomeMessage, 'assistant', messagesContainer);
                        return;
                    }

                    // Add messages to the UI - filter out tool results
                    data.messages.forEach(message => {
                        try {
                            const messageContents = JSON.parse(message.content);
                            for (const contentBlock of messageContents) {
                                if (contentBlock.type === 'text') {
                                    ShopAIChat.Message.add(contentBlock.text, message.role, messagesContainer);
                                }
                            }
                        } catch (e) {
                            ShopAIChat.Message.add(message.content, message.role, messagesContainer);
                        }
                    });

                    // Scroll to bottom
                    ShopAIChat.UI.scrollToBottom();

                } catch (error) {
                    console.error('Error fetching chat history:', error);

                    // Remove loading message if it exists
                    const loadingMessage = messagesContainer.querySelector('.shop-ai-message.assistant');
                    if (loadingMessage && loadingMessage.textContent === "Loading conversation history...") {
                        messagesContainer.removeChild(loadingMessage);
                    }

                    // Show error and welcome message
                    const welcomeMessage = window.shopChatConfig?.welcomeMessage || "👋 Hi there! How can I help you today?";
                    ShopAIChat.Message.add(welcomeMessage, 'assistant', messagesContainer);

                    // Clear the conversation ID since we couldn't fetch this conversation
                    sessionStorage.removeItem('shopAiConversationId');
                }
            }
        },

        /**
         * Authentication-related functionality
         */
        Auth: {
            /**
             * Opens an authentication popup window
             * @param {string|HTMLElement} authUrlOrElement - The auth URL or link element that was clicked
             */
            openAuthPopup: function (authUrlOrElement) {
                let authUrl;
                if (typeof authUrlOrElement === 'string') {
                    // If a string URL was passed directly
                    authUrl = authUrlOrElement;
                } else {
                    // If an element was passed
                    authUrl = authUrlOrElement.getAttribute('data-auth-url');
                    if (!authUrl) {
                        console.error('No auth URL found in element');
                        return;
                    }
                }

                // Open the popup window centered in the screen
                const width = 600;
                const height = 700;
                const left = (window.innerWidth - width) / 2 + window.screenX;
                const top = (window.innerHeight - height) / 2 + window.screenY;

                const popup = window.open(
                    authUrl,
                    'ShopifyAuth',
                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                );

                // Focus the popup window
                if (popup) {
                    popup.focus();
                } else {
                    // If popup was blocked, show a message
                    alert('Please allow popups for this site to authenticate with Shopify.');
                }

                // Start polling for token availability
                const conversationId = sessionStorage.getItem('shopAiConversationId');
                if (conversationId) {
                    const messagesContainer = document.querySelector('.shop-ai-chat-messages');

                    // Add a message to indicate authentication is in progress
                    ShopAIChat.Message.add("Authentication in progress. Please complete the process in the popup window.",
                        'assistant', messagesContainer);

                    this.startTokenPolling(conversationId, messagesContainer);
                }
            },

            /**
             * Start polling for token availability
             * @param {string} conversationId - Conversation ID
             * @param {HTMLElement} messagesContainer - The messages container
             */
            startTokenPolling: function (conversationId, messagesContainer) {
                if (!conversationId) return;

                console.log('Starting token polling for conversation:', conversationId);
                const pollingId = 'polling_' + Date.now();
                sessionStorage.setItem('shopAiTokenPollingId', pollingId);

                let attemptCount = 0;
                const maxAttempts = 30;

                const poll = async () => {
                    if (sessionStorage.getItem('shopAiTokenPollingId') !== pollingId) {
                        console.log('Another polling session has started, stopping this one');
                        return;
                    }

                    if (attemptCount >= maxAttempts) {
                        console.log('Max polling attempts reached, stopping');
                        return;
                    }

                    attemptCount++;

                    try {
                        const tokenUrl = 'https://localhost:3458/auth/token-status?conversation_id=' +
                            encodeURIComponent(conversationId);
                        const response = await fetch(tokenUrl);

                        if (!response.ok) {
                            throw new Error('Token status check failed: ' + response.status);
                        }

                        const data = await response.json();

                        if (data.status === 'authorized') {
                            console.log('Token available, resuming conversation');
                            const message = sessionStorage.getItem('shopAiLastMessage');

                            if (message) {
                                sessionStorage.removeItem('shopAiLastMessage');
                                setTimeout(() => {
                                    ShopAIChat.Message.add("Authorization successful! I'm now continuing with your request.",
                                        'assistant', messagesContainer);
                                    ShopAIChat.API.streamResponse(message, conversationId, messagesContainer);
                                    ShopAIChat.UI.showTypingIndicator();
                                }, 500);
                            }

                            sessionStorage.removeItem('shopAiTokenPollingId');
                            return;
                        }

                        console.log('Token not available yet, polling again in 10s');
                        setTimeout(poll, 10000);
                    } catch (error) {
                        console.error('Error polling for token status:', error);
                        setTimeout(poll, 10000);
                    }
                };

                setTimeout(poll, 2000);
            }
        },

        /**
         * Product-related functionality
         */
        Product: {
            /**
             * Create a product card element
             * @param {Object} product - Product data
             * @returns {HTMLElement} Product card element
             */
            createCard: function (product) {
                const card = document.createElement('div');
                card.classList.add('shop-ai-product-card');

                // Create image container
                const imageContainer = document.createElement('div');
                imageContainer.classList.add('shop-ai-product-image');

                // Add product image or placeholder
                const image = document.createElement('img');
                image.src = product.image_url || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
                image.alt = product.title;
                image.onerror = function () {
                    // If image fails to load, use a fallback placeholder
                    this.src = 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
                };
                imageContainer.appendChild(image);
                card.appendChild(imageContainer);

                // Add product info
                const info = document.createElement('div');
                info.classList.add('shop-ai-product-info');

                // Add product title
                const title = document.createElement('h3');
                title.classList.add('shop-ai-product-title');
                title.textContent = product.title;

                // If product has a URL, make the title a link
                if (product.url) {
                    const titleLink = document.createElement('a');
                    titleLink.href = product.url;
                    titleLink.target = '_blank';
                    titleLink.textContent = product.title;
                    title.textContent = '';
                    title.appendChild(titleLink);
                }

                info.appendChild(title);

                // Add product price
                const price = document.createElement('p');
                price.classList.add('shop-ai-product-price');
                price.textContent = product.price;
                info.appendChild(price);

                // Add add-to-cart button
                const button = document.createElement('button');
                button.classList.add('shop-ai-add-to-cart');
                button.textContent = 'Add to Cart';
                button.dataset.productId = product.id;
                button.dataset.productTitle = product.title;
                // Store variants if available
                if (product.variants && product.variants.length > 0) {
                    button.dataset.variants = JSON.stringify(product.variants);
                }

                // Add click handler for the button - use AJAX API
                button.addEventListener('click', function (e) {
                    e.preventDefault();
                    ShopAIChat.Cart.addToCart(product, button);
                });

                info.appendChild(button);
                card.appendChild(info);

                return card;
            }
        },

        /**
         * Cart-related functionality using Server-side Storefront API
         */
        Cart: {
            /**
             * Get the current cart ID from the cart cookie
             * Uses the shared cart cookie mechanism for browser/agent cart unification
             * @returns {string|null} Cart ID (GID format) or null
             */
            getCartId: function () {
                return ShopAIChat.CartCookie.getCartIdFromCookie();
            },

            /**
             * Store cart ID - only used as fallback when agent creates new cart
             * The primary mechanism is Set-Cookie header from server
             * @param {string} cartId - The cart GID
             */
            setCartId: function (cartId) {
                if (cartId && (!ShopAIChat.localCartId || ShopAIChat.CartCookie.isGidLike(ShopAIChat.localCartId))) {
                    // Only set cookie if we didn't have a cart (agent-first flow)
                    ShopAIChat.CartCookie.setCartCookie(cartId);
                    ShopAIChat.localCartId = ShopAIChat.CartCookie.getCartCookieValue(cartId);
                }
            },

            /**
             * Add a product to cart using Server-side Storefront API
             * @param {Object} product - Product data with id, title, variants
             * @param {HTMLElement} button - The button element that was clicked
             */
            addToCart: async function (product, button) {
                const messagesContainer = document.querySelector('.shop-ai-chat-messages');

                // Set button to loading state
                const originalText = button.textContent;
                button.disabled = true;
                button.classList.add('loading');
                button.textContent = 'Adding...';

                try {
                    // Extract variant ID (as GID) from product
                    const variantId = this.getVariantGid(product);

                    if (!variantId) {
                        throw new Error('No variant available for this product');
                    }

                    // Get existing cart ID if available
                    const cartId = this.getCartId();

                    // Call the server-side Storefront API endpoint
                    const response = await fetch('https://localhost:3458/api/cart-add', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            variantId: variantId,
                            productTitle: product.title,
                            quantity: 1,
                            cartId: cartId
                        })
                    });

                    const result = await response.json();

                    if (!result.success) {
                        throw new Error(result.error || result.message || 'Failed to add to cart');
                    }

                    // Store the cart ID for future operations
                    if (result.cart && result.cart.id) {
                        this.setCartId(result.cart);
                    }

                    // Refresh theme cart count from /cart.js for accurate count
                    ShopAIChat.CartCookie.refreshCartCount();

                    // Success! Update button state
                    button.classList.remove('loading');
                    button.classList.add('success');
                    button.textContent = 'Added!';

                    // Display the confirmation message from the server
                    if (result.message) {
                        ShopAIChat.Message.add(result.message, 'assistant', messagesContainer);
                    }

                    // Reset button after delay
                    setTimeout(() => {
                        button.disabled = false;
                        button.classList.remove('success');
                        button.textContent = originalText;
                    }, 2000);

                } catch (error) {
                    console.error('Add to cart error:', error);

                    // Error state
                    button.classList.remove('loading');
                    button.classList.add('error');
                    button.textContent = 'Error';

                    // Show error message
                    ShopAIChat.Message.add(
                        `Sorry, I couldn't add "${product.title}" to your cart. ${error.message}`,
                        'assistant',
                        messagesContainer
                    );

                    // Reset button after delay
                    setTimeout(() => {
                        button.disabled = false;
                        button.classList.remove('error');
                        button.textContent = originalText;
                    }, 2000);
                }
            },

            /**
             * Extract the variant GID from a product object
             * Storefront API requires GID format (gid://shopify/ProductVariant/123)
             * @param {Object} product - Product data
             * @returns {string|null} The variant GID or null if not found
             */
            getVariantGid: function (product) {
                // Check if product has variants array
                if (product.variants && product.variants.length > 0) {
                    // Get the first available variant
                    const availableVariant = product.variants.find(v => v.available !== false) || product.variants[0];
                    if (availableVariant.id) {
                        return this.ensureGidFormat(availableVariant.id, 'ProductVariant');
                    }
                }

                // Check if product has a single variant_id
                if (product.variant_id) {
                    return this.ensureGidFormat(product.variant_id, 'ProductVariant');
                }

                // Check for first_variant_id
                if (product.first_variant_id) {
                    return this.ensureGidFormat(product.first_variant_id, 'ProductVariant');
                }

                // If product.id looks like a variant (not a product ID)
                if (product.id && product.id.includes('/ProductVariant/')) {
                    return product.id;
                }

                return null;
            },

            /**
             * Ensure an ID is in GID format
             * @param {string|number} id - The ID which may or may not be a GID
             * @param {string} type - The Shopify resource type (e.g., 'ProductVariant')
             * @returns {string} The ID in GID format
             */
            ensureGidFormat: function (id, type) {
                if (typeof id === 'string' && id.startsWith('gid://shopify/')) {
                    return id;
                }
                // Extract numeric ID if already in some GID format
                const numericId = typeof id === 'number' ? id : this.extractNumericId(id);
                if (numericId) {
                    return `gid://shopify/${type}/${numericId}`;
                }
                return null;
            },

            /**
             * Extract numeric ID from a Shopify GID string or number
             * @param {string|number} id - The ID which may be a GID string
             * @returns {number|null} The numeric ID or null
             */
            extractNumericId: function (id) {
                if (typeof id === 'number') {
                    return id;
                }
                if (typeof id === 'string') {
                    // Handle GID format: "gid://shopify/ProductVariant/123456"
                    const match = id.match(/\/(\d+)$/);
                    if (match) {
                        return parseInt(match[1], 10);
                    }
                    // Try parsing as plain number string
                    const parsed = parseInt(id, 10);
                    if (!isNaN(parsed)) {
                        return parsed;
                    }
                }
                return null;
            },

            /**
             * Try to update the theme's cart count display
             * @param {number} count - New cart item count
             */
            updateThemeCartCount: function (count) {
                if (typeof count !== 'number') return;

                // Common cart count selectors used by various themes
                const cartCountSelectors = [
                    '.cart-count',
                    '.cart-count-bubble',
                    '[data-cart-count]',
                    '.header-cart-count',
                    '.cart-item-count',
                    '#CartCount',
                    '.js-cart-count',
                    '.cart-notification-count'
                ];

                cartCountSelectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        el.textContent = count;
                        // Show the element if it was hidden
                        if (count > 0) {
                            el.style.display = '';
                        }
                    });
                });

                // Dispatch custom event for themes that listen
                document.dispatchEvent(new CustomEvent('cart:updated', {
                    detail: { itemCount: count }
                }));

                // Also try to trigger Shopify's built-in cart update event
                if (window.Shopify && window.Shopify.theme && window.Shopify.theme.name) {
                    document.dispatchEvent(new CustomEvent('cart:refresh'));
                }
            }
        },

        /**
         * Embedded Checkout functionality using Shopify Checkout Web Components
         */
        Checkout: {
            /**
             * Open embedded checkout inline in the chat window
             * @param {HTMLElement} triggerButton - The button that was clicked
             */
            openEmbeddedCheckout: async function (triggerButton) {
                const checkoutUrl = triggerButton.getAttribute('data-checkout-url');

                if (!checkoutUrl) {
                    console.error('No checkout URL found');
                    return;
                }

                // Create checkout component if it doesn't exist
                let checkoutComponent = document.querySelector('shopify-checkout');
                if (!checkoutComponent) {
                    checkoutComponent = document.createElement('shopify-checkout');
                    checkoutComponent.setAttribute('id', 'shop-ai-checkout');
                    
                    // Add styling for inline checkout container
                    checkoutComponent.style.display = 'block';
                    checkoutComponent.style.width = '100%';
                    checkoutComponent.style.height = '600px';
                    checkoutComponent.style.minHeight = '600px';
                    
                    // Insert into chat messages container for inline display
                    const messagesContainer = document.querySelector('.shop-ai-chat-messages');
                    if (messagesContainer) {
                        messagesContainer.appendChild(checkoutComponent);
                    } else {
                        document.body.appendChild(checkoutComponent);
                    }

                    // Listen for checkout completion
                    checkoutComponent.addEventListener('checkout:complete', (event) => {
                        this.handleCheckoutComplete(event);
                    });

                    // Listen for checkout close
                    checkoutComponent.addEventListener('checkout:close', (event) => {
                        this.handleCheckoutClose(event);
                    });
                }

                try {
                    // Fetch authentication token from server
                    // const authResponse = await fetch('https://localhost:3458/api/checkout-auth', {
                    //     method: 'POST',
                    //     headers: {
                    //         'Content-Type': 'application/json',
                    //     },
                    // });

                    // if (!authResponse.ok) {
                    //     throw new Error('Failed to get authentication token');
                    // }

                    // const authToken = await authResponse.text();

                    // // Set checkout URL, authentication token, and target mode
                    // console.log("TOKEN:", authToken);
                    // checkoutComponent.setAttribute('src', checkoutUrl);
                    // checkoutComponent.setAttribute('auth', authToken);
                    // checkoutComponent.setAttribute('target', 'inline');
                    checkoutComponent.setAttribute('src', checkoutUrl);
                    checkoutComponent.setAttribute('target', 'popup');
                    setTimeout(() => {
                        if (checkoutComponent.open) {
                            checkoutComponent.open();
                        }
                    }, 100);
                    
                    // Scroll to checkout component
                    checkoutComponent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } catch (error) {
                    console.error('Error setting up inline checkout:', error);
                    
                    // Fallback to popup mode if authentication fails
                    checkoutComponent.setAttribute('src', checkoutUrl);
                    checkoutComponent.setAttribute('target', 'popup');
                    
                    setTimeout(() => {
                        if (checkoutComponent.open) {
                            checkoutComponent.open();
                        }
                    }, 100);
                }
            },

            /**
             * Handle checkout completion event
             * @param {Event} event - Checkout complete event
             */
            handleCheckoutComplete: function (event) {
                const messagesContainer = document.querySelector('.shop-ai-chat-messages');
                
                // Get order confirmation details if available
                const orderConfirmation = event.target?.orderConfirmation;
                
                let message = '🎉 Thank you for your purchase! Your order has been completed.';
                
                if (orderConfirmation) {
                    message += ` Order #${orderConfirmation.orderNumber || 'confirmed'}`;
                }

                // Remove inline checkout component after completion
                const checkoutComponent = event.target || document.querySelector('shopify-checkout[target="inline"]');
                if (checkoutComponent && checkoutComponent.getAttribute('target') === 'inline') {
                    // Delay removal slightly to allow user to see completion
                    setTimeout(() => {
                        checkoutComponent.remove();
                    }, 2000);
                }

                // Add confirmation message to chat
                ShopAIChat.Message.add(message, 'assistant', messagesContainer);

                // Clear the cart cookie since checkout is complete
                document.cookie = 'cart=; path=/; max-age=0';
                ShopAIChat.localCartId = null;

                // Refresh cart count to show empty cart
                ShopAIChat.CartCookie.refreshCartCount();
            },

            /**
             * Handle checkout close event (user closed without completing)
             */
            handleCheckoutClose: function (event) {
                console.log('Checkout closed');
                
                // For inline mode, remove the checkout component from the DOM
                const checkoutComponent = event.target || document.querySelector('shopify-checkout[target="inline"]');
                if (checkoutComponent && checkoutComponent.getAttribute('target') === 'inline') {
                    checkoutComponent.remove();
                }
            }
        },

        /**
         * Initialize the chat application
         */
        init: function () {
            // Initialize UI
            const container = document.querySelector('.shop-ai-chat-container');
            if (!container) return;

            this.UI.init(container);

            // Initialize local cart ID from cookie for tracking new cart creation
            this.localCartId = this.CartCookie.getCartIdFromCookie();

            // Check for existing conversation
            const conversationId = sessionStorage.getItem('shopAiConversationId');

            if (conversationId) {
                // Fetch conversation history
                this.API.fetchChatHistory(conversationId, this.UI.elements.messagesContainer);
            } else {
                // No previous conversation, show welcome message
                const welcomeMessage = window.shopChatConfig?.welcomeMessage || "👋 Hi there! How can I help you today?";
                this.Message.add(welcomeMessage, 'assistant', this.UI.elements.messagesContainer);
            }
        }
    };

    // Initialize the application when DOM is ready
    document.addEventListener('DOMContentLoaded', function () {
        ShopAIChat.init();
    });
})();
