/*
  # Add tile dimensions and box MOQ

  1. Changes
    - Add length_mm column to products table
    - Add width_mm column to products table
    - Add box_moq column to products table
    - Add tile_coverage_sqft computed column
    - Add function to update product stock

  2. Notes
    - length_mm and width_mm are in millimeters
    - box_moq is minimum order quantity per box
    - tile_coverage_sqft is automatically computed in square feet
*/

-- Add new columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS length_mm numeric,
ADD COLUMN IF NOT EXISTS width_mm numeric,
ADD COLUMN IF NOT EXISTS box_moq integer DEFAULT 1;

-- Add computed column for tile coverage in square feet
ALTER TABLE products
ADD COLUMN IF NOT EXISTS tile_coverage_sqft numeric
GENERATED ALWAYS AS (
  CASE 
    WHEN length_mm IS NOT NULL AND width_mm IS NOT NULL 
    THEN (length_mm * width_mm) / (1000 * 1000) * 10.764
    ELSE NULL
  END
) STORED;

-- Create function to update product stock
CREATE OR REPLACE FUNCTION update_product_stock(p_product_id uuid, p_quantity integer)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock = stock - p_quantity
  WHERE id = p_product_id AND stock >= p_quantity;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for product %', p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql;