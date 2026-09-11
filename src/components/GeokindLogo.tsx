import React from 'react';

interface GeokindLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtext?: boolean;
  onClick?: () => void;
}

export const GeokindLogo: React.FC<GeokindLogoProps> = ({
  size = 'md',
  showSubtext = true,
  onClick,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const kSizes = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-5xl',
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center space-x-2 ${onClick ? 'cursor-pointer select-none' : ''}`}
    >
      {/* Mondo con G stilizzata, Paralleli e Meridiani */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          className={`${iconSizes[size]} drop-shadow-xs`}
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Sfera Mondo sfumata */}
          <circle cx="18" cy="18" r="16" fill="url(#globeGrad)" stroke="#0D9488" strokeWidth="2" />
          
          {/* Paralleli (Righe Orizzontali) */}
          <line x1="3" y1="12" x2="33" y2="12" stroke="#14B8A6" strokeWidth="1.2" strokeOpacity="0.8" />
          <line x1="2" y1="18" x2="34" y2="18" stroke="#0D9488" strokeWidth="1.5" strokeDasharray="2 1" />
          <line x1="3" y1="24" x2="33" y2="24" stroke="#14B8A6" strokeWidth="1.2" strokeOpacity="0.8" />

          {/* Meridiani (Ellissi Verticali) */}
          <ellipse cx="18" cy="18" rx="8" ry="16" stroke="#0D9488" strokeWidth="1.3" strokeOpacity="0.9" fill="none" />
          <ellipse cx="18" cy="18" rx="14" ry="16" stroke="#14B8A6" strokeWidth="1" strokeOpacity="0.5" fill="none" />

          {/* G Stilizzata sovrapposta e integrata con i paralleli/meridiani */}
          <path
            d="M25 12.5 C23 9.5 19.8 8 16 8 C10.5 8 6.5 12.2 6.5 18 C6.5 23.8 10.5 28 16.5 28 C22 28 25.5 24.5 25.5 19.5 H16.5"
            stroke="#0F766E"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M25 12.5 C23 9.5 19.8 8 16 8 C10.5 8 6.5 12.2 6.5 18 C6.5 23.8 10.5 28 16.5 28 C22 28 25.5 24.5 25.5 19.5 H16.5"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          <defs>
            <linearGradient id="globeGrad" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#CCFBF1" />
              <stop offset="1" stopColor="#99F6E4" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Brand Text: [G mondo] + eo + K (rossa) + ind */}
      <div>
        <div className={`flex items-baseline font-black tracking-tighter font-sans ${textSizes[size]}`}>
          <span className="text-teal-900">eo</span>
          <span className={`text-red-600 font-black px-0.5 ${kSizes[size]}`}>K</span>
          <span className="text-slate-900">ind</span>
          <span className="ml-1 text-[9px] uppercase font-extrabold tracking-widest px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 self-center">
            Civico
          </span>
        </div>
        {showSubtext && (
          <p className="text-[11px] font-semibold text-teal-800 -mt-1">
            2026 @Gimondo Domenico
          </p>
        )}
      </div>
    </div>
  );
};
