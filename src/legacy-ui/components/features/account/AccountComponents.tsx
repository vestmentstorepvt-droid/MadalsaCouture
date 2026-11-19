import { type ReactNode } from 'react';
import { AppButton, type ButtonVariant } from '../../ui/button/AppButton';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const SectionCard = ({ title, subtitle, action, children, className = '' }: SectionCardProps) => (
  <section className={`rounded-3xl border border-hairline bg-white/80 p-6 shadow-md backdrop-blur ${className}`}>
    {(title || action || subtitle) ? (
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {title ? <h2 className="text-xl font-semibold text-slate-900">{title}</h2> : null}
          {subtitle ? <p className="mt-1 text-sm leading-7 text-slate-600">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    ) : null}
    {children}
  </section>
);

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  fullWidth?: boolean;
}

export const ActionButton = ({ children, variant = 'outline', size = 'md', icon, className = '', fullWidth = false, ...props }: ActionButtonProps) => (
  <AppButton variant={variant} size={size} className={`rounded-full ${fullWidth ? 'w-full' : ''} ${className}`} {...props}>
    {icon ? <span className="flex items-center gap-2">{icon}{children}</span> : children}
  </AppButton>
);
