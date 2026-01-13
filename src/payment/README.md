# Payment Module

This module provides payment integration with Zpay (Alipay for China market), supporting one-time payments for lifetime plans and credit packages.

## Structure

### Core Payment Module
- `/payment/types.ts` - Type definitions for the payment module
- `/payment/index.ts` - Main payment interface and global provider instance
- `/payment/provider/zpay.ts` - Zpay payment provider implementation

### Server Actions
- `/actions/create-checkout-session.ts` - Server action for creating checkout sessions
- `/actions/check-payment-completion.ts` - Server action for checking payment completion status
- `/actions/create-credit-checkout-session.ts` - Server action for creating credit package checkout sessions
- `/actions/consume-credits.ts` - Server action for consuming user credits
- `/actions/get-credit-balance.ts` - Server action for getting user credit balance
- `/actions/get-credit-stats.ts` - Server action for getting credit statistics
- `/actions/get-credit-transactions.ts` - Server action for getting credit transaction history
- `/actions/get-current-plan.ts` - Server action for getting current user plan data

### API Routes
- `/app/api/webhooks/zpay/route.ts` - API route for Zpay webhook events

### Pages
- `/app/[locale]/(protected)/payment/page.tsx` - Payment processing page with status display
- `/app/[locale]/(protected)/settings/billing/page.tsx` - Account billing page
- `/app/[locale]/(protected)/settings/credits/page.tsx` - Credits management page
- `/app/[locale]/(marketing)/pricing/page.tsx` - Pricing page using the pricing table component

### Components

#### Payment Components
- `/components/payment/payment-card.tsx` - Payment status display component with polling

#### Pricing Components
- `/components/pricing/pricing-card.tsx` - Component to display a single pricing plan
- `/components/pricing/pricing-table.tsx` - Component to display all pricing plans
- `/components/pricing/create-checkout-button.tsx` - Button component to initiate checkout

#### Settings Components
- `/components/settings/billing/billing-card.tsx` - Billing management card component
- `/components/settings/credits/credit-packages.tsx` - Credit packages display component
- `/components/settings/credits/credit-checkout-button.tsx` - Credit package checkout button
- `/components/settings/credits/credit-detail-viewer.tsx` - Credit detail viewer component
- `/components/settings/credits/credit-transactions-table.tsx` - Credit transactions table component
- `/components/settings/credits/credit-transactions.tsx` - Credit transactions component
- `/components/settings/credits/credits-card.tsx` - Credits card component
- `/components/settings/credits/credits-page-client.tsx` - Credits page client component

### Hooks
- `/hooks/use-payment-completion.ts` - Hook for checking payment completion with polling
- `/hooks/use-payment.ts` - Hooks for payment-related data fetching (current plan)
- `/hooks/use-credits.ts` - Hooks for credit-related operations (balance, stats, transactions, consumption)

## Environment Variables

The following environment variables are required:

```
ZPAY_APPID=your_zpay_app_id
ZPAY_SECRET=your_zpay_secret

# Zpay Price IDs
NEXT_PUBLIC_ZPAY_PRICE_LIFETIME=zpay_lifetime
NEXT_PUBLIC_ZPAY_PRICE_CREDITS_SMALL=zpay_credits_small
NEXT_PUBLIC_ZPAY_PRICE_CREDITS_MEDIUM=zpay_credits_medium
NEXT_PUBLIC_ZPAY_PRICE_CREDITS_LARGE=zpay_credits_large
NEXT_PUBLIC_ZPAY_PRICE_CREDITS_XLARGE=zpay_credits_xlarge
```

## Payment Plans

Payment plans are defined in `src/config/pricing.ts`. Each plan has pricing options with the following structure:

```typescript
// In src/config/pricing.ts
export const pricingConfig = {
  provider: 'zpay',
  plans: {
    free: {
      id: "free",
      prices: [],
      isFree: true,
      isLifetime: false,
    },
    lifetime: {
      id: "lifetime",
      prices: [
        {
          type: PaymentTypes.ONE_TIME,
          priceId: process.env.NEXT_PUBLIC_ZPAY_PRICE_LIFETIME || 'zpay_lifetime',
          amount: 99900,  // CNY in cents (999 CNY)
          currency: "CNY",
        },
      ],
      isFree: false,
      isLifetime: true,
    }
  }
}
```

## Server Actions

The payment module uses server actions for payment operations:

### Checkout Operations

#### `/actions/create-checkout-session.ts`
```typescript
// Create a checkout session for plans
export const createCheckoutAction = userActionClient
  .schema(checkoutSchema)
  .action(async ({ parsedInput, ctx }) => {
    // Creates Zpay checkout session with localized URLs
    // Returns { success: true, data: { url, id } } or { success: false, error }
  });
```

#### `/actions/create-credit-checkout-session.ts`
```typescript
// Create a checkout session for credit packages
export const createCreditCheckoutAction = userActionClient
  .schema(creditCheckoutSchema)
  .action(async ({ parsedInput, ctx }) => {
    // Creates Zpay checkout session for credit purchases
    // Returns { success: true, data: { url, id } } or { success: false, error }
  });
```

### Payment Status

#### `/actions/check-payment-completion.ts`
```typescript
// Check if a payment is completed for the given session ID
export const checkPaymentCompletionAction = userActionClient
  .schema(checkPaymentCompletionSchema)
  .action(async ({ parsedInput: { sessionId } }) => {
    // Checks payment status in database
    // Returns { success: true, isPaid: boolean } or { success: false, error }
  });
```

#### `/actions/get-current-plan.ts`
```typescript
// Get current user plan data
export const getCurrentPlanAction = userActionClient
  .schema(schema)
  .action(async ({ parsedInput, ctx }) => {
    // Returns current plan and lifetime status
    // Returns { success: true, data: { currentPlan } } or { success: false, error }
  });
```

### Credit System

#### `/actions/consume-credits.ts`
```typescript
// Consume user credits
export const consumeCreditsAction = userActionClient
  .schema(consumeSchema)
  .action(async ({ parsedInput, ctx }) => {
    // Deducts credits from user account
    // Returns { success: true } or { success: false, error }
  });
```

#### `/actions/get-credit-balance.ts`
```typescript
// Get user credit balance
export const getCreditBalanceAction = userActionClient
  .schema(schema)
  .action(async ({ ctx }) => {
    // Returns current credit balance
    // Returns { success: true, data: { balance: number } } or { success: false, error }
  });
```

## Core Components

### Payment Processing

#### PaymentCard
Displays payment status with automatic polling and redirect:

```tsx
<PaymentCard />
// Automatically handles payment completion checking and redirects
// Used in /app/[locale]/(protected)/payment/page.tsx
```

### Checkout Components

#### CheckoutButton
Creates a Zpay checkout session and redirects the user:

```tsx
<CheckoutButton
  userId="user_123"
  planId="lifetime"
  priceId={process.env.NEXT_PUBLIC_ZPAY_PRICE_LIFETIME!}
  metadata={{ userId: "user_123" }}
  variant="default"
  size="default"
>
  Buy Lifetime
</CheckoutButton>
```

#### CreditCheckoutButton
Creates a Zpay checkout session for credit packages:

```tsx
<CreditCheckoutButton
  userId="user_123"
  packageId="credits_100"
  priceId={process.env.NEXT_PUBLIC_ZPAY_PRICE_CREDITS_SMALL!}
  metadata={{ userId: "user_123" }}
  variant="default"
  size="default"
>
  Buy Credits
</CreditCheckoutButton>
```

### Pricing Components

#### PricingTable
Displays all pricing plans:

```tsx
<PricingTable
  metadata={{ userId: "user_123" }}
  currentPlan="lifetime"
/>
```

#### PricingCard
Displays a single pricing plan with checkout button:

```tsx
<PricingCard
  plan={plan}
  paymentType="ONE_TIME"
  metadata={{ userId: "user_123" }}
  isCurrentPlan={false}
/>
```

### Billing Management

#### BillingCard
Displays current plan information:

```tsx
<BillingCard />
// Shows current plan and management options
```

### Credit System

#### CreditPackages
Displays available credit packages for purchase:

```tsx
<CreditPackages />
// Shows credit packages with purchase buttons
```

#### CreditsPageClient
Complete credits management interface:

```tsx
<CreditsPageClient />
// Shows balance, transactions, and purchase options
```

## Webhooks

Zpay webhook events are handled via `/app/api/webhooks/zpay/route.ts`, which calls the `handleWebhookEvent` function from the payment module.

The webhook handler processes events like:

- `TRADE_SUCCESS` - Payment completed successfully

The webhook functionality is implemented in the `handleWebhookEvent` method of the Zpay provider.

## Integration Steps

1. Set up Zpay account and get API credentials
2. Create products in the Zpay dashboard that match your pricing configuration
3. Add environment variables to your project
4. Set up webhook endpoints in the Zpay dashboard:
   - `https://your-domain.com/api/webhooks/zpay`
5. Add the pricing page and account billing components to your application
6. Use the `CheckoutButton` component where needed

## Error Handling

The payment module includes error handling for:

- Missing environment variables
- Failed checkout session creation
- Invalid webhooks
- User permission checks
- Network/API failures

## Hooks

### Payment Hooks

#### usePaymentCompletion
Hook for checking payment completion with automatic polling:

```typescript
const { data: paymentCheck, isLoading, error } = usePaymentCompletion(
  sessionId,
  enablePolling // true for automatic polling
);
// Returns { isPaid: boolean }
```

#### useCurrentPlan
Hook for getting current plan based on lifetime status:

```typescript
const { data: currentPlan, isLoading, error } = useCurrentPlan(userId);
// Returns { currentPlan: PricePlan | null }
```

### Credit Hooks

#### useCreditBalance
Hook for fetching user credit balance:

```typescript
const { data: balance, isLoading, error } = useCreditBalance();
// Returns { balance: number }
```

#### useCreditStats
Hook for fetching credit statistics:

```typescript
const { data: stats, isLoading, error } = useCreditStats();
// Returns credit usage statistics
```

#### useConsumeCredits
Hook for consuming credits:

```typescript
const { mutate: consumeCredits, isPending } = useConsumeCredits();
// Usage: consumeCredits({ amount: 10, description: "AI generation" })
```

#### useCreditTransactions
Hook for fetching credit transaction history:

```typescript
const { data: transactions, isLoading, error } = useCreditTransactions(
  pageIndex,
  pageSize,
  search,
  sorting
);
// Returns paginated transaction data
```

## Global Functions

The main payment interface in `/payment/index.ts` provides these global functions:

```typescript
// Create a checkout session for a plan
createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult>;

// Create a credit checkout session
createCreditCheckout(params: CreateCreditCheckoutParams): Promise<CheckoutResult>;

// Handle a webhook event
handleWebhookEvent(payload: string, signature: string): Promise<void>;
```

## Payment Flow

### Lifetime/One-time Payment Flow
1. User clicks `CheckoutButton` with plan details
2. `createCheckoutAction` creates Zpay checkout session
3. User is redirected to Alipay payment page
4. After payment, user is redirected to `/payment` page
5. `PaymentCard` component polls `checkPaymentCompletionAction`
6. Once payment is confirmed, user is redirected to billing page
7. Webhook updates database with payment details

### Credit Purchase Flow
1. User clicks `CreditCheckoutButton` with package details
2. `createCreditCheckoutAction` creates Zpay checkout session
3. User is redirected to Alipay payment page
4. After payment, user is redirected to `/payment` page
5. `PaymentCard` component polls `checkPaymentCompletionAction`
6. Once payment is confirmed, user is redirected to credits page
7. Webhook updates database with credit purchase details

### Payment Status Polling
The `PaymentCard` component uses `usePaymentCompletion` hook to:
- Poll `checkPaymentCompletionAction` every 2 seconds
- Display loading, success, failed, or timeout states
- Automatically redirect to callback URL on success
- Invalidate relevant React Query cache

## Limitations

**Zpay does NOT support:**
- Subscriptions (recurring payments)
- Customer portal (self-service billing management)
- Multiple currencies (CNY only)

For subscription-based business models, consider using Stripe instead.
