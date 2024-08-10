import { Inject, Injectable, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ClientProxy } from '@nestjs/microservices';
import Stripe from 'stripe';

import { envs } from '../config/envs';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { NATS_SERVICE } from '../config/constants/services';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.STRIPE_SECRET);
  private readonly logger = new Logger('PaymentsService');

  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

  async createPaymentSession({ currency, items, orderId }: PaymentSessionDto) {
    const lineItems = items.map(({ name, price, quantity }) => {
      return {
        price_data: {
          currency,
          product_data: {
            name,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity,
      };
    });

    const session = await this.stripe.checkout.sessions.create({
      payment_intent_data: {
        metadata: {
          orderId,
        },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: envs.STRIPE_SUCCESS_URL,
      cancel_url: envs.STRIPE_CANCEL_URL,
    });

    return {
      cancelUrl: session.cancel_url,
      successUrl: session.success_url,
      url: session.url,
    };
  }

  async stripeWebhook(req: Request, res: Response) {
    const signature = req.headers['stripe-signature'];

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'],
        signature,
        envs.STRIPE_ENDPOINT_SECRET,
      );
    } catch (error) {
      res.status(400).json({ message: `Webhook error: ${error.message}` });

      return;
    }

    switch (event.type) {
      case 'charge.succeeded':
        const chargeSucceeded = event.data.object;

        const payload = {
          stripePaymentId: chargeSucceeded.id,
          orderId: chargeSucceeded.metadata.orderId,
          receiptUrl: chargeSucceeded.receipt_url,
        };

        this.client.emit('payment.succeeded', payload);
        break;

      default:
        console.log(`Event ${event.type} not handled`);
    }

    return res.status(200).json({ signature });
  }
}
