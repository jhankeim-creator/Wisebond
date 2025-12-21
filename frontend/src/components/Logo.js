import React from 'react';
import { Wallet } from 'lucide-react';

export const Logo = ({ size = 'default', className = '' }) => {
  const sizeClasses = {
    small: 'h-8',
    default: 'h-10',
    large: 'h-14'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Logo Image */}
      <img 
        src="https://customer-assets.emergentagent.com/job_24be30fd-73cd-41dd-9303-f4b522fea9ce/artifacts/0gcbodjz_%2B509%2039%2030%208318%2020251221_022043.jpg"
        alt="KAYICOM"
        className={`${sizeClasses[size]} object-contain`}
      />
    </div>
  );
};

export default Logo;
