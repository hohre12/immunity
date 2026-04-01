import axios from 'axios';
import { db } from '../db';

interface ChargeRequest {
  userId: string;
  amount: number;
  currency: string;
  cardToken: string;
}

export class PaymentService {
  async charge(req: ChargeRequest) {
    const { userId, amount, currency, cardToken } = req;

    // 결제 기록 생성
    const payment = await db.payment.create({
      data: {
        userId,
        amount,
        currency,
        status: 'pending',
      },
    });

    // PG사 호출
    const pgResponse = await axios.post('https://pg-api.example.com/charge', {
      amount,
      currency,
      token: cardToken,
      transactionId: payment.id,
    });

    if (pgResponse.data.success) {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: 'completed' },
      });
      return { success: true, paymentId: payment.id };
    } else {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: 'failed' },
      });
      return { success: false, error: pgResponse.data.error };
    }
  }

  async refund(paymentId: string, amount: number) {
    const payment = await db.payment.findUnique({ where: { id: paymentId } });

    const pgResponse = await axios.post('https://pg-api.example.com/refund', {
      transactionId: paymentId,
      amount,
    });

    if (pgResponse.data.success) {
      await db.payment.update({
        where: { id: paymentId },
        data: { status: 'refunded', refundedAmount: amount },
      });
    }

    return pgResponse.data;
  }

  async retryFailedPayment(paymentId: string) {
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== 'failed') {
      throw new Error('Invalid payment for retry');
    }

    for (let i = 0; i < 3; i++) {
      try {
        const pgResponse = await axios.post('https://pg-api.example.com/charge', {
          amount: payment.amount,
          currency: payment.currency,
          token: payment.cardToken,
          transactionId: payment.id,
        });

        if (pgResponse.data.success) {
          await db.payment.update({
            where: { id: payment.id },
            data: { status: 'completed' },
          });
          return { success: true };
        }
      } catch (e) {
        // retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }
}
