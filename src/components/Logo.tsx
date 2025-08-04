import React from 'react';

const Logo: React.FC = () => {
  return (
    <div className="logo-container">
      <div className="logo">
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="logo-svg"
        >
          {/* Outer circle with decorative border */}
          <circle cx="20" cy="20" r="19" stroke="url(#goldGradient)" strokeWidth="2" fill="none"/>
          
          {/* Inner geometric pattern - inspired by Islamic geometric art */}
          <g className="logo-pattern">
            {/* Central star/compass design */}
            <path
              d="M20 8 L24 16 L32 16 L26 22 L28 30 L20 26 L12 30 L14 22 L8 16 L16 16 Z"
              fill="url(#goldGradient)"
              opacity="0.9"
            />
            
            {/* Decorative circles */}
            <circle cx="20" cy="20" r="3" fill="var(--warm-orange)" opacity="0.8"/>
            <circle cx="20" cy="20" r="1.5" fill="var(--primary-gold)"/>
            
            {/* Corner decorative elements */}
            <circle cx="8" cy="8" r="1.5" fill="var(--sage-green)" opacity="0.7"/>
            <circle cx="32" cy="8" r="1.5" fill="var(--sage-green)" opacity="0.7"/>
            <circle cx="8" cy="32" r="1.5" fill="var(--sage-green)" opacity="0.7"/>
            <circle cx="32" cy="32" r="1.5" fill="var(--sage-green)" opacity="0.7"/>
          </g>
          
          {/* Gradients */}
          <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary-gold)" />
              <stop offset="100%" stopColor="var(--secondary-gold)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <span className="logo-text">mycromwell</span>
    </div>
  );
};

export default Logo; 