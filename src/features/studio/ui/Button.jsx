const VARIANTS = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:hover:bg-primary',
  secondary: 'bg-secondary text-foreground border border-cool-600 hover:bg-muted',
  ghost: 'text-secondary-foreground hover:bg-secondary hover:text-foreground',
  danger: 'bg-destructive text-destructive-foreground hover:brightness-110',
};

export default function Button({ variant = 'secondary', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 h-9 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

/** Square icon-only button. `label` is required: it becomes the tooltip and the accessible name. */
export function IconButton({ label, active = false, className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={`inline-flex items-center justify-center rounded-md size-8 shrink-0 transition-colors disabled:opacity-35 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand ${
        active ? 'bg-primary/25 text-brand' : 'text-secondary-foreground hover:bg-muted hover:text-foreground'
      } ${className}`}
      {...props}
    />
  );
}
