import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useGetStaticPageQuery } from '../../services/cmsApi';
import StaticCmsPage from './StaticCmsPage';

const toTitle = (slug: string) =>
  slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/**
 * Storefront route for any published CMS static page: /pages/:slug
 * The title comes from the CMS record; the slug is used only until it loads.
 */
const CmsPageRoute: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data } = useGetStaticPageQuery(slug ?? '', { skip: !slug });

  if (!slug) return <Navigate to="/" replace />;

  return <StaticCmsPage key={slug} slug={slug} title={data?.title || toTitle(slug)} />;
};

export default CmsPageRoute;
