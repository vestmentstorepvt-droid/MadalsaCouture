import type { FC, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface SectionHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Optional link on the right, e.g. "View all". */
  action?: { label: string; to: string };
  /** h1 for page headers, h2 for sections. */
  as?: 'h1' | 'h2';
  align?: 'left' | 'center';
  id?: string;
}

/** The one heading pattern for sections and pages: mono eyebrow, tight Geist title, optional action. */
export const SectionHeader: FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  description,
  action,
  as: Heading = 'h2',
  align = 'left',
  id,
}) => {
  const centered = align === 'center';
  return (
    <div
      className={`flex flex-col gap-4 ${centered ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between'}`}
    >
      <div className={`max-w-2xl ${centered ? 'mx-auto' : ''}`}>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <Heading id={id} className="section-title">
          {title}
        </Heading>
        {description && <p className="mt-2 text-sm text-body md:text-base">{description}</p>}
      </div>
      {action && (
        <Link
          to={action.to}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full text-sm font-medium text-ink underline-offset-4 hover:underline"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
};

export default SectionHeader;
