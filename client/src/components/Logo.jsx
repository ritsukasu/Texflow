import { useId } from 'react';
import { Link } from 'react-router-dom';

export const LogoMark = ({ size = 28 }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id={id} x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6F8AA5" />
          <stop offset="1" stopColor="#2F4358" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <g className="logo-quill">
        <path d="M11.2 21.6C8.8 15.4 13.6 8.6 25.4 6.6 26.4 14.6 20.6 21.4 11.2 21.6Z" fill="#fff" />
        <g stroke="#46627f" strokeLinecap="round">
          <path d="M23.6 13.4 19.6 14.6M21.4 17.4 17.6 17.8M17.8 10.6 15.6 12.8" strokeWidth="1" />
          <path d="M10.6 22.3 22.4 9.8" strokeWidth="1.3" />
        </g>
        <path d="M9.6 21.6 11.4 23.3 7.1 26.5Z" fill="#fff" />
      </g>
    </svg>
  );
};

export const Logo = ({ to = '/', size = 28, showName = true }) => (
  <Link to={to} className="logo" aria-label="Texflow home">
    <LogoMark size={size} />
    {showName && <span className="logo-name">Texflow</span>}
  </Link>
);
