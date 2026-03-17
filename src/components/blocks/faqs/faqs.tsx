'use client';

import { HeaderSection } from '@/components/layout/header-section';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { IconName } from 'lucide-react/dynamic';
import { useLocale, useTranslations } from 'next-intl';

type FAQItem = {
  id: string;
  icon: IconName;
  question: string;
  answer: string;
};

export default function FaqSection() {
  const locale = useLocale();
  const t = useTranslations('HomePage.faqs');

  const faqItems: FAQItem[] = [
    {
      id: 'item-1',
      icon: 'calendar-clock',
      question: t('items.item-1.question'),
      answer: t('items.item-1.answer'),
    },
    {
      id: 'item-2',
      icon: 'wallet',
      question: t('items.item-2.question'),
      answer: t('items.item-2.answer'),
    },
    {
      id: 'item-3',
      icon: 'refresh-cw',
      question: t('items.item-3.question'),
      answer: t('items.item-3.answer'),
    },
    {
      id: 'item-4',
      icon: 'hand-coins',
      question: t('items.item-4.question'),
      answer: t('items.item-4.answer'),
    },
    {
      id: 'item-5',
      icon: 'mail',
      question: t('items.item-5.question'),
      answer: t('items.item-5.answer'),
    },
  ];

  return (
    <section id="faqs" className="px-4 py-16">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <HeaderSection
          className="max-w-xl"
          title={t('title')}
          titleAs="h2"
          subtitle={t('subtitle')}
          subtitleAs="p"
        />

        <div className="surface-panel mx-auto w-full rounded-[2rem] p-4 sm:p-6">
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="rounded-[1.25rem] border-b border-dashed border-border/70 px-3 last:border-b-0"
              >
                <AccordionTrigger className="cursor-pointer rounded-[1.1rem] py-5 text-base hover:text-foreground hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="pb-5 text-base leading-7 text-muted-foreground">
                    {item.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
