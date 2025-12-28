import { getImageSource, handleImageError, getMpDisplayName, getMpPartyInfo } from '../utils/imageUtils';
import { useEffect, useRef } from 'react';

export default function MpCard({ mp, onClick }) {
    const imageSrc = getImageSource(mp.profilePicture, 'mp');
    const imageRef = useRef(null);

    // Handle image loading and sizing
    useEffect(() => {
        if (imageRef.current) {
            const img = imageRef.current;
            
            const handleLoad = () => {
                // Determine aspect ratio and apply appropriate styling
                if (img.naturalWidth && img.naturalHeight) {
                    const aspectRatio = img.naturalWidth / img.naturalHeight;
                    
                    // Set default to smart fitting mode
                    img.setAttribute('data-fit-mode', 'smart');
                    
                    if (aspectRatio > 1.2) {
                        // Landscape image - focus on center
                        img.style.objectPosition = 'center';
                        img.setAttribute('data-aspect-ratio', 'landscape');
                        img.setAttribute('data-focus', 'center');
                        img.setAttribute('data-content', 'full-body');
                    } else if (aspectRatio < 0.8) {
                        // Portrait image - focus on face area
                        img.style.objectPosition = 'center 25%';
                        img.setAttribute('data-aspect-ratio', 'portrait');
                        img.setAttribute('data-focus', 'face');
                        img.setAttribute('data-content', 'face');
                    } else {
                        // Square-ish image - perfect fit
                        img.style.objectPosition = 'center';
                        img.setAttribute('data-aspect-ratio', 'square');
                        img.setAttribute('data-focus', 'center');
                        img.setAttribute('data-content', 'face');
                    }
                    
                    // Additional smart positioning based on image content
                    // For MP photos, we want to focus on the face area
                    if (aspectRatio < 1.1) {
                        // Portrait or square - prioritize face visibility
                        img.style.objectPosition = 'center 20%';
                        img.setAttribute('data-focus', 'face');
                        img.setAttribute('data-content', 'face');
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
    }, [imageSrc]);

    return (
      <div className="card" onClick={onClick} title={getMpPartyInfo(mp)}>
        <div className="card-img">
          <img 
            ref={imageRef}
            src={imageSrc} 
            alt={getMpDisplayName(mp)} 
            onError={(e) => handleImageError(e, 'mp')}
            loading="lazy"
          />
        </div>
        <div className="card-body">
          <div className="name">{getMpDisplayName(mp)}</div>
          <div className="meta">{getMpPartyInfo(mp)}</div>
        </div>
        <div className={`status-dot ${mp.status === 'current' ? 'on' : 'off'}`} />
      </div>
    );
  }
  