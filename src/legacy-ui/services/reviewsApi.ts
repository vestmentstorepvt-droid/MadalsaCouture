import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../api/baseQuery';

/**
 * reviewsApi — placeholder slice.
 * The reviews feature is not yet available from the backend.
 * This slice exists to keep the store registration intact.
 * The ReviewsAndRatings page renders a static notice instead of real data.
 */
export const reviewsApi = createApi({
  reducerPath: 'reviewsApi',
  baseQuery: baseQueryWithErrorLogging,
  endpoints: () => ({}),
});
