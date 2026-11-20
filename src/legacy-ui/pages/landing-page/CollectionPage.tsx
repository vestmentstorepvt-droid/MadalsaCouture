import React from 'react';
import { ShopPage } from '../../components/features/shop/ShopPage';

/**
 * /collections/:slug — the shop page with that collection preselected.
 * Shoppers can switch to "All" or another collection and keep their filters.
 */
export const CollectionPage: React.FC = () => <ShopPage />;

export default CollectionPage;
