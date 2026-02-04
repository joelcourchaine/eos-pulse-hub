-- Drop the existing check constraint and recreate it with Genesis added
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_brand_check;

ALTER TABLE stores ADD CONSTRAINT stores_brand_check CHECK (
  brand IS NULL OR brand IN (
    'GMC', 'Chevrolet', 'Buick', 'Cadillac', 'Ford', 'Lincoln', 
    'Nissan', 'Infiniti', 'Mazda', 'Honda', 'Acura', 'Toyota', 'Lexus',
    'Hyundai', 'Genesis', 'Kia', 'Stellantis', 'Chrysler', 'Dodge', 'Jeep', 'Ram',
    'Volkswagen', 'Audi', 'BMW', 'Mercedes-Benz', 'Other', 'KTRV'
  )
);