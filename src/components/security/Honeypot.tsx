import React, { useState } from 'react';

/**
 * Honeypot Field Component for Forms
 * Invisible to real users, but tempting for bots.
 * If filled, the submission should be rejected.
 */
interface HoneypotProps {
  fieldName?: string; // e.g. "website", "company", "fax"
  onChange?: (isBot: boolean) => void;
}

export const Honeypot: React.FC<HoneypotProps> = ({ fieldName = "website", onChange }) => {
  const [value, setValue] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);
    if (val.length > 0) {
      // console.warn('🍯 Honeypot filled! Blocking submission.');
      if (onChange) onChange(true);
    }
  };

  return (
    <div style={{ 
      opacity: 0, 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      height: 0, 
      width: 0, 
      zIndex: -1,
      overflow: 'hidden' 
    }} aria-hidden="true">
      <label htmlFor={fieldName}>Leave this field empty</label>
      <input
        type="text"
        id={fieldName}
        name={fieldName}
        value={value}
        onChange={handleChange}
        tabIndex={-1}
        autoComplete="off"
      />
    </div>
  );
};

