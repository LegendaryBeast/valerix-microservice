-- Inventory Service Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- inventory table
CREATE TABLE inventory (
    product_id VARCHAR(255) PRIMARY KEY,
    product_name VARCHAR(500) NOT NULL,
    stock_level INTEGER NOT NULL DEFAULT 0,
    reserved_stock INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT positive_stock CHECK (stock_level >= 0),
    CONSTRAINT positive_reserved CHECK (reserved_stock >= 0),
    CONSTRAINT valid_reservation CHECK (reserved_stock <= stock_level)
);

CREATE INDEX idx_inventory_stock_level ON inventory(stock_level);
CREATE INDEX idx_inventory_last_updated ON inventory(last_updated);

-- inventory_transactions table (audit log)
CREATE TABLE inventory_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(255) NOT NULL REFERENCES inventory(product_id),
    transaction_type VARCHAR(50) NOT NULL, -- 'RESERVE', 'DEDUCT', 'RESTOCK'
    quantity INTEGER NOT NULL,
    order_id UUID,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (transaction_type IN ('RESERVE', 'DEDUCT', 'RESTOCK', 'RELEASE'))
);

CREATE INDEX idx_inv_trans_product_id ON inventory_transactions(product_id);
CREATE INDEX idx_inv_trans_order_id ON inventory_transactions(order_id);
CREATE INDEX idx_inv_trans_created_at ON inventory_transactions(created_at);
CREATE INDEX idx_inv_trans_type ON inventory_transactions(transaction_type);

-- Function to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_inventory_last_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update last_updated and version
CREATE TRIGGER update_inventory_timestamp BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_inventory_last_updated();

-- Insert sample product data
INSERT INTO inventory (product_id, product_name, stock_level, reserved_stock) VALUES
    ('product_abc', 'Gaming Console XYZ', 100, 0),
    ('product_xyz', 'Wireless Headphones Pro', 250, 5),
    ('product_def', 'Smart Watch Elite', 75, 10),
    ('product_ghi', '4K Monitor Ultra Wide', 50, 0),
    ('product_jkl', 'Mechanical Keyboard RGB', 150, 15);

-- Insert sample transaction history
INSERT INTO inventory_transactions (product_id, transaction_type, quantity, order_id, previous_stock, new_stock) VALUES
    ('product_abc', 'RESTOCK', 100, NULL, 0, 100),
    ('product_xyz', 'RESTOCK', 250, NULL, 0, 250),
    ('product_xyz', 'RESERVE', 5, uuid_generate_v4(), 250, 245),
    ('product_def', 'RESTOCK', 75, NULL, 0, 75),
    ('product_def', 'RESERVE', 10, uuid_generate_v4(), 75, 65);
