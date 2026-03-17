import { cn } from '@/lib/utils';

interface HeaderSectionProps {
  id?: string;
  title?: string;
  titleAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
  titleClassName?: string;
  subtitle?: string;
  subtitleAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
  subtitleClassName?: string;
  description?: string;
  descriptionAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';
  descriptionClassName?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * different pages may use this component as different heading style for SEO friendly
 */
export function HeaderSection({
  id,
  title,
  titleAs = 'h2',
  titleClassName,
  subtitle,
  subtitleAs = 'p',
  subtitleClassName,
  description,
  descriptionAs = 'p',
  descriptionClassName,
  className,
  children,
}: HeaderSectionProps) {
  const TitleComponent = titleAs;
  const SubtitleComponent = subtitleAs;
  const DescriptionComponent = descriptionAs;
  return (
    <div
      id={id}
      className={cn(
        'flex max-w-3xl flex-col items-start gap-3 text-left',
        className
      )}
    >
      {title ? (
        <TitleComponent className={cn('editorial-label', titleClassName)}>
          {title}
        </TitleComponent>
      ) : null}
      {subtitle ? (
        <SubtitleComponent
          className={cn(
            'font-bricolage-grotesque text-balance text-4xl leading-[0.95] tracking-[-0.05em] text-foreground sm:text-5xl',
            subtitleClassName
          )}
        >
          {subtitle}
        </SubtitleComponent>
      ) : null}
      {description ? (
        <DescriptionComponent
          className={cn(
            'max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg',
            descriptionClassName
          )}
        >
          {description}
        </DescriptionComponent>
      ) : null}

      {children}
    </div>
  );
}
