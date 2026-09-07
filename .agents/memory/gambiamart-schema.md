---
name: GambiaMart schema — products extra columns
description: Products table has extra columns added after initial seed; requires SQL update for existing rows
---

## Products table key columns
- `colors`: jsonb string[] (added after v1 schema — NOT in original seed; update via SQL per category)
- `features`: jsonb string[] (same — services table had it from day 1, products did not)
- `isFeatured`, `freeShipping`, `soldCount` — also added in schema update
- `images`: jsonb string[] (imageUrl for API products)

## Important
- `drizzle-kit push --force` adds columns with defaults (empty array/false/0)
- Existing seeded products need SQL UPDATE to add colors/features by category
- The seed checks `existingProducts.length === 0` so won't re-seed — must use direct SQL UPDATE

**Why:** Original schema omitted these to keep initial migration simple; they were added later when product detail screen needed them.
