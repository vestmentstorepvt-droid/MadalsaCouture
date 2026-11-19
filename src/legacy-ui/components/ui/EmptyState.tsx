import type { FC, ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

/** Empty / error panel: dashed hairline box, centred, one optional action. */
export const EmptyState: FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center rounded-2xl border border-dashed border-hairline-strong bg-surface px-6 py-16 text-center">
    {icon && (
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-hairline text-mute" aria-hidden="true">
        {icon}
      </div>
    )}
    <h2 className="text-base font-semibold text-ink">{title}</h2>
    {description && <p className="mt-1 max-w-sm text-sm text-body">{description}</p>}
    {action}
  </div>
);

export default EmptyState;
