'use client';

import { Button } from '@/components/ui/button';
import { useConsumeCredits, useCreditBalance } from '@/hooks/use-credits';
import { CoinsIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const CONSUME_CREDITS = 10;

export function ConsumeCreditsCard() {
  const { data: balance = 0, isLoading: isLoadingBalance } = useCreditBalance();
  const consumeCreditsMutation = useConsumeCredits();
  const [loading, setLoading] = useState(false);

  const hasEnoughCredits = (amount: number) => balance >= amount;

  const handleConsume = async () => {
    if (!hasEnoughCredits(CONSUME_CREDITS)) {
      toast.error('积分不足，请购买更多积分');
      return;
    }
    setLoading(true);
    try {
      await consumeCreditsMutation.mutateAsync({
        amount: CONSUME_CREDITS,
        description: `测试积分消耗（${CONSUME_CREDITS} 积分）`,
      });
      toast.success(`已成功消耗 ${CONSUME_CREDITS} 积分`);
    } catch (error) {
      toast.error('积分消耗失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold">积分消耗测试</h3>

      <div className="space-y-2">
        <p>
          <strong>当前余额：</strong> {balance}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleConsume}
          disabled={
            loading || consumeCreditsMutation.isPending || isLoadingBalance
          }
          size="sm"
        >
          <CoinsIcon className="w-4 h-4 mr-2" />
          消耗 {CONSUME_CREDITS} 积分
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">加载中...</p>}
    </div>
  );
}
