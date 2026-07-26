import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

/**
 * HID keyboard-wedge RFID readers type the UID then send Enter.
 * This input captures rapid key bursts as a single card scan.
 */
export default function RfidScanInput({
  value,
  onChange,
  placeholder = 'Tap RFID card on reader…',
  className = 'input',
  autoFocus,
}: Props) {
  const [buffer, setBuffer] = useState('');
  const lastKeyAt = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <input
      ref={inputRef}
      className={className}
      value={value || buffer}
      placeholder={placeholder}
      onChange={(e) => {
        const now = Date.now();
        // If keys arrive faster than typing (~40ms), treat as reader wedge
        if (now - lastKeyAt.current < 50 && e.target.value.length > value.length) {
          setBuffer(e.target.value);
        } else {
          onChange(e.target.value);
          setBuffer('');
        }
        lastKeyAt.current = now;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const scanned = (buffer || value).trim();
          if (scanned) {
            onChange(scanned);
            setBuffer('');
          }
        }
      }}
      autoComplete="off"
      spellCheck={false}
    />
  );
}
