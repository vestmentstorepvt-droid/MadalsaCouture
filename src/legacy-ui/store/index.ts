import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import cartReducer from './slices/cartSlice';
import { userApi } from '../services/userApi';
import { recentActivityApi } from '../services/recentActivityApi';
import { productsApi } from '../services/productsApi';
import { couponApi } from '../services/couponApi';
import { reviewsApi } from '../services/reviewsApi';
import { authApi } from '../services/authApi';
import { adminOrdersApi } from '../services/adminOrdersApi';
import { baseApi } from '../redux/api/baseApi';
import { cmsApi } from '../services/cmsApi';
import { cmsAdminApi } from '../services/cmsAdminApi';
import { addressApi } from '../services/addressApi';
import { wishlistApi } from '../services/wishlistApi';
import { ordersApi } from '../services/ordersApi';
import { inventoryApi } from '../services/inventoryApi';
import { mediaApi } from '../services/mediaApi';
import { auditLogApi } from '../services/auditLogApi';
import { profileApi } from '../services/profileApi';
import { adminProductsApi } from '../services/adminProductsApi';
import { notificationsApi } from '../services/notificationsApi';
import { cartApi } from '../services/cartApi';
import { adminExchangesApi } from '../services/adminExchangesApi';
import { tagsApi } from '../services/tagsApi';
import { collectionsApi } from '../services/collectionsApi';
import { adminAlertsApi } from '../services/adminAlertsApi';
import { commentsApi } from '../services/commentsApi';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    [userApi.reducerPath]: userApi.reducer,
    [recentActivityApi.reducerPath]: recentActivityApi.reducer,
    [productsApi.reducerPath]: productsApi.reducer,
    [couponApi.reducerPath]: couponApi.reducer,
    [reviewsApi.reducerPath]: reviewsApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
    [adminOrdersApi.reducerPath]: adminOrdersApi.reducer,
    [baseApi.reducerPath]: baseApi.reducer,
    [cmsApi.reducerPath]: cmsApi.reducer,
    [cmsAdminApi.reducerPath]: cmsAdminApi.reducer,
    [addressApi.reducerPath]: addressApi.reducer,
    [wishlistApi.reducerPath]: wishlistApi.reducer,
    [ordersApi.reducerPath]: ordersApi.reducer,
    [inventoryApi.reducerPath]: inventoryApi.reducer,
    [mediaApi.reducerPath]: mediaApi.reducer,
    [auditLogApi.reducerPath]: auditLogApi.reducer,
    [profileApi.reducerPath]: profileApi.reducer,
    [adminProductsApi.reducerPath]: adminProductsApi.reducer,
    [notificationsApi.reducerPath]: notificationsApi.reducer,
    [cartApi.reducerPath]: cartApi.reducer,
    [adminExchangesApi.reducerPath]: adminExchangesApi.reducer,
    [tagsApi.reducerPath]: tagsApi.reducer,
    [collectionsApi.reducerPath]: collectionsApi.reducer,
    [adminAlertsApi.reducerPath]: adminAlertsApi.reducer,
    [commentsApi.reducerPath]: commentsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      userApi.middleware,
      recentActivityApi.middleware,
      productsApi.middleware,
      couponApi.middleware,
      reviewsApi.middleware,
      authApi.middleware,
      adminOrdersApi.middleware,
      baseApi.middleware,
      cmsApi.middleware,
      cmsAdminApi.middleware,
      addressApi.middleware,
      wishlistApi.middleware,
      ordersApi.middleware,
      inventoryApi.middleware,
      mediaApi.middleware,
      auditLogApi.middleware,
      profileApi.middleware,
      adminProductsApi.middleware,
      notificationsApi.middleware,
      cartApi.middleware,
      adminExchangesApi.middleware,
      tagsApi.middleware,
      collectionsApi.middleware,
      adminAlertsApi.middleware,
      commentsApi.middleware,
    ),
});


export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Persist cart items to localStorage after every state change
store.subscribe(() => {
  const { cart } = store.getState();
  try {
    localStorage.setItem('cart', JSON.stringify(cart.items));
    localStorage.setItem('cartDeselected', JSON.stringify(cart.deselected));
  } catch {
    // Storage quota exceeded — silent fail
  }
});
