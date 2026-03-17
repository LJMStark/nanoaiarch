import BackButtonSmall from '@/components/shared/back-button-small';

/**
 * auth layout is different from other public layouts,
 * so auth directory is not put in (public) directory.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="relative flex min-h-svh items-center justify-center overflow-hidden px-6 py-8 md:px-10"
    >
      <BackButtonSmall className="absolute left-6 top-6 z-20 md:left-10 md:top-10" />

      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(113,139,96,0.2),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(173,142,103,0.16),transparent_26%)]"
      />
      <div
        aria-hidden
        className="surface-panel absolute -left-24 top-24 hidden h-80 w-80 rounded-full blur-3xl lg:block"
      />
      <div
        aria-hidden
        className="surface-subtle absolute -right-20 bottom-16 hidden h-72 w-72 rounded-full blur-3xl lg:block"
      />

      <div className="relative z-10 flex w-full max-w-md flex-col gap-6">
        {children}
      </div>
    </main>
  );
}
