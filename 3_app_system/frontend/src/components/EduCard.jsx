import { useState, useEffect, useRef } from "react";
import { useApi } from "../hooks";
import { userApi } from "../api";
import BookmarkButton from "./BookmarkButton";

function EduCard({ item }) {
  const [bookmarked, setBookmarked] = useState(false);
  const { executeApiCall, loading } = useApi();
  const imageRef = useRef(null);

  // Check if already bookmarked
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser?.bookmarks?.includes(item._id)) {
      setBookmarked(true);
    }
  }, [item._id]);

  // Handle image loading and sizing
  useEffect(() => {
    if (imageRef.current) {
      const img = imageRef.current;
      
      const handleLoad = () => {
        // Determine aspect ratio and apply appropriate styling
        if (img.naturalWidth && img.naturalHeight) {
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          
          if (aspectRatio > 1.5) {
            // Wide landscape image
            img.style.objectPosition = 'center';
            img.setAttribute('data-aspect-ratio', 'landscape');
          } else if (aspectRatio < 0.8) {
            // Portrait image
            img.style.objectPosition = 'center top';
            img.setAttribute('data-aspect-ratio', 'portrait');
          } else {
            // Standard landscape or square image
            img.style.objectPosition = 'center';
            img.setAttribute('data-aspect-ratio', 'standard');
          }
        }
      };

      if (img.complete) {
        handleLoad();
      } else {
        img.addEventListener('load', handleLoad);
      }

      return () => {
        img.removeEventListener('load', handleLoad);
      };
    }
  }, [item.image?.url]);

  // Toggle bookmark status
  const toggleBookmark = async () => {
    try {
      const result = await executeApiCall(userApi.toggleBookmark, item._id);
      setBookmarked(result.bookmarked);
    } catch (err) {
      console.error("Bookmark failed", err);
      // Error is already handled by the useApi hook
    }
  };

  // Handle broken image URLs
  const handleImageError = (event) => {
    event.target.src = '/placeholder-education.jpg';
    event.target.onerror = null; // Prevent infinite loop
  };

  // Check if image URL is valid (not a broken Cloudinary URL)
  const isValidImageUrl = (url) => {
    if (!url) return false;
    return !url.includes('cloudinary.com/example');
  };

  const imageSrc = isValidImageUrl(item.image?.url) ? item.image.url : '/placeholder-education.jpg';

  return (
    <div className="bg-white shadow-md rounded overflow-hidden hover:shadow-lg transition relative">
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <img
          ref={imageRef}
          src={imageSrc}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-300"
          onError={handleImageError}
          loading="lazy"
        />
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg mb-1">{item.name}</h3>
            <p className="text-sm text-gray-600 mb-2">{item.description}</p>
          </div>
          <BookmarkButton 
            bookmarked={bookmarked} 
            onToggle={toggleBookmark}
            disabled={loading}
          />
        </div>
        <div className="text-xs text-purple-700 mt-2">
          <p>🕒 {item.timeToRead} min read</p>
          <p>🎯 {item.difficulty}</p>
        </div>
      </div>
    </div>
  );
}

export default EduCard;
