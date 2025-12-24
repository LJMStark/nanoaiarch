import { HeaderSection } from '@/components/layout/header-section';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

type Testimonial = {
  name: string;
  role: string;
  image: string;
  quote: string;
};

const chunkArray = (
  array: Testimonial[],
  chunkSize: number
): Testimonial[][] => {
  const result: Testimonial[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
};

export default function TestimonialsSection() {
  const t = useTranslations('HomePage.testimonials');

  const testimonials: Testimonial[] = [
    {
      name: t('items.item-1.name' as any),
      role: t('items.item-1.role' as any),
      image: t('items.item-1.image' as any),
      quote: t('items.item-1.quote' as any),
    },
    {
      name: t('items.item-2.name' as any),
      role: t('items.item-2.role' as any),
      image: t('items.item-2.image' as any),
      quote: t('items.item-2.quote' as any),
    },
    {
      name: t('items.item-3.name' as any),
      role: t('items.item-3.role' as any),
      image: t('items.item-3.image' as any),
      quote: t('items.item-3.quote' as any),
    },
    {
      name: t('items.item-4.name' as any),
      role: t('items.item-4.role' as any),
      image: t('items.item-4.image' as any),
      quote: t('items.item-4.quote' as any),
    },
    {
      name: t('items.item-5.name' as any),
      role: t('items.item-5.role' as any),
      image: t('items.item-5.image' as any),
      quote: t('items.item-5.quote' as any),
    },
    {
      name: t('items.item-6.name' as any),
      role: t('items.item-6.role' as any),
      image: t('items.item-6.image' as any),
      quote: t('items.item-6.quote' as any),
    },
    {
      name: t('items.item-7.name' as any),
      role: t('items.item-7.role' as any),
      image: t('items.item-7.image' as any),
      quote: t('items.item-7.quote' as any),
    },
    {
      name: t('items.item-8.name' as any),
      role: t('items.item-8.role' as any),
      image: t('items.item-8.image' as any),
      quote: t('items.item-8.quote' as any),
    },
    {
      name: t('items.item-9.name' as any),
      role: t('items.item-9.role' as any),
      image: t('items.item-9.image' as any),
      quote: t('items.item-9.quote' as any),
    },
    {
      name: t('items.item-10.name' as any),
      role: t('items.item-10.role' as any),
      image: t('items.item-10.image' as any),
      quote: t('items.item-10.quote' as any),
    },
    {
      name: t('items.item-11.name' as any),
      role: t('items.item-11.role' as any),
      image: t('items.item-11.image' as any),
      quote: t('items.item-11.quote' as any),
    },
    {
      name: t('items.item-12.name' as any),
      role: t('items.item-12.role' as any),
      image: t('items.item-12.image' as any),
      quote: t('items.item-12.quote' as any),
    },
  ];

  const testimonialChunks = chunkArray(
    testimonials,
    Math.ceil(testimonials.length / 3)
  );

  return (
    <section id="testimonials" className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <HeaderSection
          title={t('title')}
          titleAs="h2"
          subtitle={t('subtitle')}
          subtitleAs="p"
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-2 md:mt-12 lg:grid-cols-3">
          {testimonialChunks.map((chunk, chunkIndex) => (
            <div key={chunkIndex} className="space-y-3">
              {chunk.map(({ name, role, quote, image }, index) => (
                <Card
                  key={index}
                  className="shadow-none bg-transparent hover:bg-accent dark:hover:bg-card"
                >
                  <CardContent className="grid grid-cols-[auto_1fr] gap-3 pt-4">
                    <Avatar className="size-9 border-2 border-gray-200">
                      <AvatarImage
                        alt={name}
                        src={image}
                        loading="lazy"
                        width="120"
                        height="120"
                      />
                      <AvatarFallback />
                    </Avatar>

                    <div>
                      <h3 className="font-medium">{name}</h3>

                      <span className="text-muted-foreground block text-sm tracking-wide">
                        {role}
                      </span>

                      <blockquote className="mt-3">
                        <p className="text-gray-700 dark:text-gray-300">
                          {quote}
                        </p>
                      </blockquote>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
