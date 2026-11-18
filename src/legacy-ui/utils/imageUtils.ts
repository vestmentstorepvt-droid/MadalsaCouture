/**
 * Helper to apply Cloudinary image transformations to a raw URL.
 * Automatically adds format auto, quality auto, and a specified width.
 * 
 * @param url The raw image URL
 * @param width The maximum width for the image in pixels
 * @returns The optimized image URL
 */
export const optimizeImage = (url: string | undefined | null, width: number = 800): string => {
  if (!url) return '';

  // Only apply transformations to Cloudinary URLs
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    // Check if it already has transformations to avoid double applying
    if (url.includes('/upload/c_') || url.includes('/upload/w_') || url.includes('/upload/f_auto')) {
      return url;
    }

    // Insert transformation string right after '/upload/'
    const transformString = `c_limit,w_${width},f_auto,q_auto`;
    return url.replace('/upload/', `/upload/${transformString}/`);
  }

  return url;
};

/**
 * Helper to apply Cloudinary video transformations to a raw URL.
 * Automatically adds video codec auto, format auto, quality auto.
 * 
 * @param url The raw video URL
 * @param width The maximum width for the video in pixels
 * @returns The optimized video URL
 */
export const optimizeVideo = (url: string | undefined | null, width: number = 1920): string => {
  if (!url) return '';
  
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    if (url.includes('/upload/c_') || url.includes('/upload/w_') || url.includes('/upload/f_auto') || url.includes('/upload/vc_auto') || url.includes('/upload/q_auto')) {
      return url;
    }
    
    const transformString = `c_limit,w_${width},vc_auto,f_auto,q_auto`;
    return url.replace('/upload/', `/upload/${transformString}/`);
  }
  
  return url;
};

/**
 * Helper to extract a poster image URL from a Cloudinary video URL.
 * 
 * @param url The raw video URL
 * @param width The maximum width for the poster in pixels
 * @returns The optimized poster image URL
 */
export const getCloudinaryVideoPoster = (url: string | undefined | null, width: number = 1920): string => {
  if (!url) return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    // Generate a jpg thumbnail for the video
    let posterUrl = url.replace(/\.(mp4|webm|ogv|mov)$/i, '.jpg');
    // Optimization will be applied by optimizeImage if it hasn't been already
    return optimizeImage(posterUrl, width);
  }
  return '';
};
