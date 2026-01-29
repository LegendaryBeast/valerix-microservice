# Valerix Store - Customer Frontend

A beautiful, simple customer-facing web store for placing orders.

## 🚀 Quick Start

### Open in Browser
```bash
cd webapp
open index.html
```

Or visit the opened page in your browser!

## 📋 Prerequisites

Make sure your backend services are running:
```bash
# Terminal 1 - Order Service
cd services/order-service && npm run dev

# Terminal 2 - Inventory Service
cd services/inventory-service && npm run dev
```

## ✨ Features

### 🛍️ Product Catalog
- Browse available products with real-time stock levels
- Visual stock indicators (green = in stock, orange = low stock, red = out of stock)
- Product cards with prices and "Add to Cart" buttons
- Auto-refreshes inventory from backend

### 🛒 Shopping Cart
- Sidebar cart with smooth slide-in animation
- Add/remove products
- Adjust quantities with +/- buttons
- Real-time total calculation
- Stock validation (can't exceed available quantity)

### 📦 Checkout Process
- Simple customer information form
- Delivery address collection
- Order summary before placement
- Success confirmation with order details

### 🎨 Beautiful Design
- Modern dark theme
- Smooth animations and transitions
- Fully responsive (works on mobile!)
- Product image placeholders with animated gradients
- Toast notifications for feedback

## 💡 How to Use

1. **Browse Products** - Products load automatically from inventory
2. **Add to Cart** - Click "Add to Cart" on any product
3. **View Cart** - Click the cart button in header
4. **Adjust Quantities** - Use +/- buttons in cart
5. **Checkout** - Click "Proceed to Checkout"
6. **Fill Details** - Enter your information
7. **Place Order** - Submit and see success confirmation!

## 🎯 Customer Flow

```
Browse Products → Add to Cart → Review Cart → Checkout → Success!
```

## 📱 What Customers See

- **Header**: Store name + cart button with item count
- **Hero**: Welcome message
- **Products**: Grid of available products
- **Cart**: Slide-out sidebar with cart items
- **Checkout**: Modal form for customer details
- **Success**: Order confirmation with details

## 🔧 Technical Details

### API Integration
- Fetches inventory from Inventory Service
- Creates orders via Order Service
- Real-time stock updates

### Pricing
- Prices auto-generated based on product ID
- Consistent pricing across sessions
- Range: $29.99 - $229.99

### Stock Management
- Shows available quantity
- Prevents over-ordering
- Updates after successful checkout

## 📝 Files

```
webapp/
├── index.html  # Customer interface
├── styles.css  # Modern e-commerce styling
├── app.js      # Shopping cart & checkout logic
└── README.md   # This file
```

## 🎨 Customization

### Change Store Name
Edit `index.html`:
```html
<h1 class="brand-name">Your Store Name</h1>
```

### Adjust Colors
Edit `styles.css`:
```css
:root {
    --primary: #6366f1;  /* Your brand color */
}
```

### Update API Endpoints
Edit `app.js`:
```javascript
const API_CONFIG = {
    orderService: 'http://localhost:3000',
    inventoryService: 'http://localhost:3002'
};
```

## 🆘 Troubleshooting

**No products showing?**
- Check Inventory Service is running on port 3002
- View browser console for errors

**Order fails?**
- Check Order Service is running on port 3000
- Ensure product is in stock
- Check browser console for error details

**Cart not updating?**
- Refresh the page
- Clear browser cache

## 🌟 Features

✅ Real-time inventory
✅ Shopping cart
✅ Quantity controls
✅ Stock validation
✅ Customer checkout
✅ Order confirmation
✅ Toast notifications
✅ Responsive design
✅ Smooth animations
✅ Error handling

---

**Happy Shopping! 🎉**
