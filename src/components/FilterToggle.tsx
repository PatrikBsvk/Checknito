'use client';

interface FilterToggleProps {
  onToggle: (onlyOwn: boolean) => void;
  initialValue?: boolean;
}

export default function FilterToggle({ onToggle, initialValue = false }: FilterToggleProps) {
  return (
    <div className="toggle-group" role="tablist" aria-label="Filtr transmisí">
      <button
        type="button"
        role="tab"
        aria-selected={initialValue}
        className={initialValue ? 'active' : ''}
        onClick={() => onToggle(true)}
      >
        Jen moje
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={!initialValue}
        className={!initialValue ? 'active' : ''}
        onClick={() => onToggle(false)}
      >
        Všechny
      </button>
    </div>
  );
}
