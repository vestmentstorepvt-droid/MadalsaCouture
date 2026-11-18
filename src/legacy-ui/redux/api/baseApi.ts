import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithErrorLogging } from '../../api/baseQuery';

export const baseApi = createApi({
  reducerPath: 'baseApi',
  baseQuery: baseQueryWithErrorLogging,
  tagTypes: ['Auth', 'User', 'Products', 'Orders'],
  endpoints: () => ({}),
});

export const { reducerPath } = baseApi;
