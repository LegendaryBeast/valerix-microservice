// Configuration
const API_CONFIG = {
    orderService: 'http://localhost:3000',
    inventoryService: 'http://localhost:3002'
};

// State
let products = [];
let cart = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
});

// ========================
// Products
// ========================
async function loadProducts() {
    try {
        const response = await fetch(`${API_CONFIG.inventoryService}/api/inventory`);
        if (!response.ok) throw new Error('Failed to load products');

        products = await response.json();
        displayProducts(products);
    } catch (error) {
        console.error('Error loading products:', error);
        const grid = document.getElementById('products-grid');
        grid.innerHTML = `
            <div class="loading-card">
                <p style="color: var(--danger);">
                    Unable to load products. Please make sure the Inventory Service is running.
                </p>
            </div>
        `;
    }
}

function displayProducts(productsToDisplay) {
    const grid = document.getElementById('products-grid');

    if (productsToDisplay.length === 0) {
        grid.innerHTML = `
            <div class="loading-card">
                <p>No products available at the moment.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = productsToDisplay.map(product => {
        const available = product.available_quantity;
        const isOutOfStock = available === 0;
        const isLowStock = available > 0 && available < 10;

        return `
            <div class="product-card">
                <div class="product-image">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
                <div class="product-info">
                    <div class="product-name">Product ${product.product_id}</div>
                    <div class="product-id">ID: ${product.product_id}</div>
                    <div class="product-stock">
                        <span class="stock-indicator ${isOutOfStock ? 'out' : isLowStock ? 'low' : ''}"></span>
                        ${isOutOfStock ? 'Out of Stock' : `${available} in stock`}
                    </div>
                    <div class="product-footer">
                        <div class="product-price">$${generatePrice(product.product_id)}</div>
                        <button 
                            class="btn-add-cart" 
                            onclick="addToCart('${product.product_id}')"
                            ${isOutOfStock ? 'disabled' : ''}
                        >
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M9 2L7 7M17 2L19 7M1 7H23M3 7L5 20H19L21 7" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            Add to Cart
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Generate consistent price based on product ID
function generatePrice(productId) {
    const hash = productId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const price = 29.99 + (hash % 200);
    return price.toFixed(2);
}

// ========================
// Shopping Cart
// ========================
function addToCart(productId) {
    const product = products.find(p => p.product_id === productId);
    if (!product || product.available_quantity === 0) {
        showToast('Product is out of stock', 'error');
        return;
    }

    const existingItem = cart.find(item => item.productId === productId);

    if (existingItem) {
        if (existingItem.quantity >= product.available_quantity) {
            showToast('Cannot add more than available stock', 'error');
            return;
        }
        existingItem.quantity++;
    } else {
        cart.push({
            productId: productId,
            quantity: 1,
            price: parseFloat(generatePrice(productId))
        });
    }

    updateCart();
    showToast('Added to cart!', 'success');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.productId !== productId);
    updateCart();
    showToast('Removed from cart', 'success');
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.productId === productId);
    const product = products.find(p => p.product_id === productId);

    if (!item || !product) return;

    const newQuantity = item.quantity + change;

    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }

    if (newQuantity > product.available_quantity) {
        showToast('Cannot exceed available stock', 'error');
        return;
    }

    item.quantity = newQuantity;
    updateCart();
}

function updateCart() {
    // Update cart count
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').textContent = totalItems;

    // Update cart items
    const cartItemsContainer = document.getElementById('cart-items');

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-cart">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M9 2L7 7M17 2L19 7M1 7H23M3 7L5 20H19L21 7" stroke="currentColor" stroke-width="2"/>
                </svg>
                <p>Your cart is empty</p>
                <span>Add some products to get started</span>
            </div>
        `;
        document.getElementById('checkout-btn').disabled = true;
    } else {
        cartItemsContainer.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-header">
                    <div class="cart-item-name">Product ${item.productId}</div>
                    <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
                </div>
                <div class="cart-item-footer">
                    <div class="quantity-controls">
                        <button class="qty-btn" onclick="updateQuantity('${item.productId}', -1)">−</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="qty-btn" onclick="updateQuantity('${item.productId}', 1)">+</button>
                    </div>
                    <button class="btn-remove" onclick="removeFromCart('${item.productId}')">Remove</button>
                </div>
            </div>
        `).join('');
        document.getElementById('checkout-btn').disabled = false;
    }

    // Update total
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;
}

function toggleCart() {
    document.getElementById('cart-sidebar').classList.toggle('active');
}

// ========================
// Checkout
// ========================
function proceedToCheckout() {
    if (cart.length === 0) return;

    toggleCart();

    // Update checkout summary
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const summaryHtml = `
        ${cart.map(item => `
            <div class="summary-item">
                <span>Product ${item.productId} × ${item.quantity}</span>
                <span>$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
        `).join('')}
        <div class="summary-item">
            <span>Total</span>
            <span>$${total.toFixed(2)}</span>
        </div>
    `;
    document.getElementById('checkout-summary').innerHTML = summaryHtml;

    document.getElementById('checkout-modal').classList.add('active');
}

function closeCheckout() {
    document.getElementById('checkout-modal').classList.remove('active');
    document.getElementById('checkout-form').reset();
}

async function handleCheckout(event) {
    event.preventDefault();

    const customerName = document.getElementById('customer-name').value;
    const customerEmail = document.getElementById('customer-email').value;
    const customerId = `customer-${Date.now()}`;

    const orderData = {
        customerId: customerId,
        items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price
        }))
    };

    try {
        const response = await fetch(`${API_CONFIG.orderService}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create order');
        }

        const order = await response.json();

        // Close checkout modal
        closeCheckout();

        // Show success
        showOrderSuccess(order, customerName, customerEmail);

        // Clear cart
        cart = [];
        updateCart();

        // Reload products to update stock
        await loadProducts();

    } catch (error) {
        console.error('Error creating order:', error);
        showToast(`Order failed: ${error.message}`, 'error');
    }
}

function showOrderSuccess(order, customerName, customerEmail) {
    const total = order.total_amount || cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    document.getElementById('order-details').innerHTML = `
        <p><strong>Order ID:</strong> ${order.id ? order.id.substring(0, 8) + '...' : 'Processing'}</p>
        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Email:</strong> ${customerEmail}</p>
        <p><strong>Total:</strong> $${total.toFixed(2)}</p>
        <p><strong>Status:</strong> ${order.status || 'Pending'}</p>
    `;

    document.getElementById('success-modal').classList.add('active');
}

function closeSuccess() {
    document.getElementById('success-modal').classList.remove('active');
}

// ========================
// Toast Notifications
// ========================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ========================
// Error Handling
// ========================
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});
