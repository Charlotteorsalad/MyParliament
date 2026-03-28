import { getImageSource, getMpDisplayName, getMpPartyInfo } from '../utils/imageUtils';
import { useState } from 'react';

export default function MpCard({ mp, onClick }) {
    const imageSrc = getImageSource(mp.profilePicture, 'mp');
    const [imgError, setImgError] = useState(false);

    const fallbackBg = '#e2e8f0';
    const bgImage = imgError ? 'none' : `url(${imageSrc})`;

    return (
      <div className="card" onClick={onClick} title={getMpPartyInfo(mp)}>
        {/* background-size: contain = full image always visible, no cropping */}
        <div
          style={{
            width: '100%',
            height: '200px',
            flexShrink: 0,
            backgroundImage: bgImage,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
            backgroundColor: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
          }}
          role="img"
          aria-label={getMpDisplayName(mp)}
        >
          {/* Hidden img to detect load error */}
          <img
            src={imageSrc}
            alt=""
            aria-hidden="true"
            onError={() => setImgError(true)}
            style={{ display: 'none' }}
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
