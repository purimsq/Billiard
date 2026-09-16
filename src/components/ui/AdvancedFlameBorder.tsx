import React from 'react';

interface AdvancedFlameBorderProps {
  streak?: number;
}

export const AdvancedFlameBorder: React.FC<AdvancedFlameBorderProps> = () => {
  return (
    <div className="absolute -inset-[1px] rounded-xl pointer-events-none z-20 overflow-visible">
      <svg
        className="w-full h-full overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Deep dark crimson red base glow filter */}
          <filter id="crimsonMarginGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#DC2626" floodOpacity="0.75" />
          </filter>
        </defs>

        {/* Base margin brightly illuminated in rich dark crimson/ruby red */}
        <rect
          x="0.5"
          y="0.5"
          width="calc(100% - 1px)"
          height="calc(100% - 1px)"
          rx="12"
          fill="none"
          stroke="#DC2626"
          strokeWidth="2"
          strokeOpacity="0.95"
          filter="url(#crimsonMarginGlow)"
        />
      </svg>
    </div>
  );
};
