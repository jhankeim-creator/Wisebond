import React from 'react';

export const Logo = ({ size = 'default', className = '', dark = false }) => {
  const sizeClasses = {
    small: 'h-8',
    default: 'h-10',
    large: 'h-14'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${sizeClasses[size]} px-3 py-1 rounded-lg font-black tracking-wider flex items-center justify-center
        ${dark ? 'bg-white text-purple-700' : 'bg-gradient-to-r from-purple-600 to-purple-800 text-white'}
        shadow-lg`}
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        <span className="text-lg sm:text-xl">KAYICOM</span>
      </div>
    </div>
  );
};

export default Logo;
