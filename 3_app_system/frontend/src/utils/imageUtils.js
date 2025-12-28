/**
 * Image utility functions for handling broken URLs and providing fallbacks
 */

// Import placeholder images
import placeholderMp from '../assets/image/placeholder-mp.jpg';
import placeholderEducation from '../assets/image/placeholder-education.jpg';
import placeholderUser from '../assets/image/placeholder-user.jpg';
import placeholderDefault from '../assets/image/placeholder-user.jpg'; // Using user as default

// Check if image URL is valid and accessible
export const isValidImageUrl = (url) => {
  if (!url) return false;
  
  // Check if it's a valid URL format
  try {
    const urlObj = new URL(url);
    // Only allow http/https protocols
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

// Get appropriate fallback image based on context
export const getFallbackImage = (context = 'mp') => {
  switch (context) {
    case 'mp':
      return placeholderMp;
    case 'education':
      return placeholderEducation;
    case 'user':
      return placeholderUser;
    default:
      return placeholderDefault;
  }
};

// Get image source with fallback - only fallback if URL is completely invalid
export const getImageSource = (url, context = 'mp') => {
  // If no URL provided, use fallback immediately
  if (!url) return getFallbackImage(context);
  
  // If URL is invalid format, use fallback immediately
  if (!isValidImageUrl(url)) return getFallbackImage(context);
  
  // URL is valid, use it
  return url;
};

// Handle image load errors - only trigger if image actually fails to load
export const handleImageError = (event, context = 'mp') => {
  // Only set fallback if current src is not already a fallback
  const currentSrc = event.target.src;
  const fallbackSrc = getFallbackImage(context);
  
  // Check if current src is not already a placeholder
  if (!currentSrc.includes('placeholder-')) {
    event.target.src = fallbackSrc;
    event.target.onerror = null; // Prevent infinite loop
  }
};

// Get display text with fallback
export const getDisplayText = (text, fallback = 'Not available') => {
  return text || fallback;
};

// Get MP display name with fallback
export const getMpDisplayName = (mp) => {
  return mp.full_name_with_titles || mp.name || 'Unknown MP';
};

// Get MP party info with fallback
export const getMpPartyInfo = (mp) => {
  const party = mp.party_full_name || mp.party || 'No Party';
  const constituency = mp.constituency || 'No Constituency';
  return `${party} · ${constituency}`;
};
