'use client';

import { updateUserBio } from '@/actions/user-profile';
import { FormError } from '@/components/shared/form-error';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

interface UpdateBioCardProps {
  className?: string;
  initialBio?: string | null;
}

/**
 * Update user bio
 */
export function UpdateBioCard({ className, initialBio }: UpdateBioCardProps) {
  const t = useTranslations('Dashboard.settings.profile');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | undefined>('');
  const { data: session } = authClient.useSession();

  // Create a schema for bio validation
  const formSchema = z.object({
    bio: z.string().max(200, { message: t('bio.maxLength') }),
  });

  // Initialize the form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bio: initialBio || '',
    },
  });

  // Check if user exists
  const user = session?.user;
  if (!user) {
    return null;
  }

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSaving(true);
    setError('');

    try {
      const result = await updateUserBio(values.bio);
      if (result.success) {
        toast.success(t('bio.success'));
      } else {
        setError(result.error);
        toast.error(t('bio.fail'));
      }
    } catch (err) {
      setError('An unexpected error occurred');
      toast.error(t('bio.fail'));
    } finally {
      setIsSaving(false);
    }
  };

  const charCount = form.watch('bio')?.length || 0;

  return (
    <Card
      className={cn(
        'w-full overflow-hidden pt-6 pb-0 flex flex-col',
        className
      )}
    >
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {t('bio.title')}
        </CardTitle>
        <CardDescription>{t('bio.description')}</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1"
        >
          <CardContent className="space-y-4 flex-1">
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder={t('bio.placeholder')}
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormError message={error} />
          </CardContent>
          <CardFooter className="mt-6 px-6 py-4 flex justify-between items-center bg-muted rounded-none">
            <p className="text-sm text-muted-foreground">
              {charCount}/200 {t('bio.characters')}
            </p>

            <Button
              type="submit"
              disabled={isSaving}
              className="cursor-pointer"
            >
              {isSaving ? t('bio.saving') : t('bio.save')}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
