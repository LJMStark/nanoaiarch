'use client';

import { getOnboardingStatus } from '@/actions/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useEffect, useState } from 'react';
import { OnboardingModal } from './OnboardingModal';

interface OnboardingProviderProps {
  children: React.ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { openOnboarding } = useOnboardingStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const result = await getOnboardingStatus();

        if (result.success && result.data && !result.data.onboardingCompleted) {
          // User hasn't completed onboarding, show the modal
          openOnboarding();
        }
      } catch (error) {
        // Silently fail - don't block user experience
      } finally {
        setChecked(true);
      }
    };

    checkOnboarding();
  }, [openOnboarding]);

  return (
    <>
      {children}
      {checked && <OnboardingModal />}
    </>
  );
}
