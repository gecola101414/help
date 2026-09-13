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
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  const textSizes = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-5xl',
  };

  const kSizes = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-5xl',
  };

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center space-x-2.5 ${onClick ? 'cursor-pointer select-none group' : ''}`}
    >
      {/* Globe Icon in 3D effect with Parallels, Meridians & Stylized G */}
      <div className="relative shrink-0 flex items-center justify-center transition-transform group-hover:scale-105">
        <svg
          className={`${iconSizes[size]} drop-shadow-md`}
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* 3D Sphere Radial Gradient */}
            <radialGradient id="globe3dGrad" cx="30%" cy="30%" r="70%" fx="25%" fy="25%">
              <stop offset="0%" stopColor="#A7F3D0" />
              <stop offset="50%" stopColor="#2DD4BF" />
              <stop offset="85%" stopColor="#0D9488" />
              <stop offset="100%" stopColor="#064E3B" />
            </radialGradient>

            {/* Inner Shadow for 3D Depth */}
            <radialGradient id="globeShadow" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
            </radialGradient>
          </defs>

          {/* Sfera 3D Base */}
          <circle cx="22" cy="22" r="20" fill="url(#globe3dGrad)" stroke="#047857" strokeWidth="1.5" />
          <circle cx="22" cy="22" r="20" fill="url(#globeShadow)" />

          {/* Meridiani (Archi Longitudinali 3D) */}
          <ellipse cx="22" cy="22" rx="10" ry="20" stroke="#064E3B" strokeWidth="1.2" strokeOpacity="0.6" fill="none" />
          <ellipse cx="22" cy="22" rx="16" ry="20" stroke="#047857" strokeWidth="1" strokeOpacity="0.4" fill="none" />
          <line x1="22" y1="2" x2="22" y2="42" stroke="#047857" strokeWidth="1.2" strokeOpacity="0.7" />

          {/* Paralleli (Righe di Latitudine Curvate) */}
          <path d="M4 14 Q22 18 40 14" stroke="#064E3B" strokeWidth="1.2" strokeOpacity="0.6" fill="none" />
          <line x1="2" y1="22" x2="42" y2="22" stroke="#047857" strokeWidth="1.5" strokeOpacity="0.8" strokeDasharray="3 1.5" />
          <path d="M4 30 Q22 26 40 30" stroke="#064E3B" strokeWidth="1.2" strokeOpacity="0.6" fill="none" />

          {/* G Stilizzata perfettamente sovrapposta con riflesso bianco brillante */}
          <path
            d="M31 15.5 C28.5 11.5 24 9.5 19 9.5 C12 9.5 7 15 7 22 C7 29 12 34.5 19.5 34.5 C26.5 34.5 31 30 31 23.5 H19.5"
            stroke="#042F2C"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.4"
          />
          <path
            d="M31 15.5 C28.5 11.5 24 9.5 19 9.5 C12 9.5 7 15 7 22 C7 29 12 34.5 19.5 34.5 C26.5 34.5 31 30 31 23.5 H19.5"
            stroke="#FFFFFF"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Testo Logo: [G-Mondo] + eo + K (Rossa) + ind */}
      <div className="flex flex-col">
        <div className={`flex items-baseline font-black tracking-tighter leading-none ${textSizes[size]}`}>
          <span className="text-[#0D9488] font-black">eo</span>
          <span className={`text-[#DC2626] font-black px-0.5 ${kSizes[size]}`}>K</span>
          <span className="text-[#0F172A] font-black">ind</span>
        </div>
        {showSubtext && (
          <p className="text-[11px] font-bold text-[#0D9488] tracking-tight -mt-0.5">
            2026 @Gimondo Domenico
          </p>
        )}
      </div>
    </div>
  );
};

