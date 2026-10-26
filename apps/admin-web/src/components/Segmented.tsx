/** iOS-style segmented control (single choice). */
export function Segmented<T extends string>(props: { label: string; value: T; options: { value: T; label: string; title?: string }[]; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" aria-label={props.label} className="inline-flex rounded-lg border border-app-border bg-app-subtle p-0.5">
      {props.options.map((option) => {
        const active = option.value === props.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => props.onChange(option.value)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              active ? 'bg-app-surface text-app-strong shadow-sm' : 'text-app-muted hover:text-app-text'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
