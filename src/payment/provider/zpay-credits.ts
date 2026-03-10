type WebhookLikeParams = {
  money?: string;
  param?: string;
};

type CreditPackageLike = {
  id: string;
  amount: number;
  expireDays?: number;
  price?: {
    priceId: string;
    amount: number;
    currency: string;
  };
};

export function resolveCreditPurchaseFromWebhook({
  params,
  creditPackage,
}: {
  params: WebhookLikeParams;
  creditPackage: CreditPackageLike | null | undefined;
}): {
  packageId: string;
  amount: number;
  expireDays?: number;
  description: string;
} | null {
  if (!params.param || !creditPackage) {
    return null;
  }

  try {
    const parsedParams = JSON.parse(params.param) as {
      packageId?: string;
    };

    if (
      !parsedParams.packageId ||
      parsedParams.packageId !== creditPackage.id
    ) {
      return null;
    }

    return {
      packageId: creditPackage.id,
      amount: creditPackage.amount,
      expireDays: creditPackage.expireDays,
      description: `+${creditPackage.amount} credits for package ${creditPackage.id} (¥${params.money})`,
    };
  } catch {
    return null;
  }
}
