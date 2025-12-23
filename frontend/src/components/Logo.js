import React from 'react';
import { Link } from 'react-router-dom';

export const Logo = ({ size = 'default', className = '', linkToHome = false }) => {
  const sizeClasses = {
    small: 'text-lg',
    default: 'text-xl',
    large: 'text-3xl'
  };

  const logoElement = (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className={[
          'font-extrabold tracking-wide leading-none',
          'bg-gradient-to-r from-[#7C3AED] to-[#EC4899] bg-clip-text text-transparent',
          sizeClasses[size]
        ].join(' ')}
        aria-label="KAYICOM"
      >
        KAYICOM
      </span>
    </div>
  );

  if (linkToHome) {
    return (
      <Link to="/" className="hover:opacity-80 transition-opacity">
        {logoElement}
      </Link>
    );
  }

  return logoElement;
};

export default Logo;
