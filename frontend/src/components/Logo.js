import React from 'react';

export const Logo = ({ size = 'default', className = '' }) => {
  const sizes = {
    small: 'text-xl',
    default: 'text-2xl',
    large: 'text-3xl',
    hero: 'text-4xl sm:text-5xl'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="logo">
      <div className="w-10 h-10 bg-gradient-to-br from-[#EA580C] to-[#C2410C] rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
        <span className="text-white font-bold text-xl">K</span>
      </div>
      <span className={`logo-text ${sizes[size]}`}>
        <span className="logo-kayi">KAYI</span>
        <span className="logo-com">COM</span>
      </span>
    </div>
  );
};

export default Logo;
