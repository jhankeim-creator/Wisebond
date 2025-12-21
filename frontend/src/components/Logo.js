import React from 'react';
import { Link } from 'react-router-dom';

const LOGO_URL = "https://customer-assets.emergentagent.com/job_24be30fd-73cd-41dd-9303-f4b522fea9ce/artifacts/0gcbodjz_%2B509%2039%2030%208318%2020251221_022043.jpg";

export const Logo = ({ size = 'default', className = '', linkToHome = false }) => {
  const sizeClasses = {
    small: 'h-8',
    default: 'h-10',
    large: 'h-14'
  };

  const logoElement = (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src={LOGO_URL}
        alt="KAYICOM"
        className={`${sizeClasses[size]} object-contain rounded-lg`}
        style={{ maxWidth: size === 'small' ? '100px' : size === 'large' ? '160px' : '120px' }}
      />
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
