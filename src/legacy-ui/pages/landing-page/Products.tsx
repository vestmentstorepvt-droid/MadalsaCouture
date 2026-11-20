import React from 'react';
import { ShopPage } from '../../components/features/shop/ShopPage';

/**
 * /products — all products with filters. Legacy links such as
 * /products?category=new-arrivals and /products?q=… still work
 * (see components/features/shop/useShopFilters.ts).
 */
export const Products: React.FC = () => <ShopPage />;

export default Products;
