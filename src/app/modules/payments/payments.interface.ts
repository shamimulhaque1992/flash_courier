import type { PaymentStatus } from "../../../generated/prisma";

export interface IPayment {
	id: string;
	status: PaymentStatus;
	amount: number;
	currency: string;
	paymentGateway: string;
	merchantInvoiceNumber: string;
	bkashPaymentId?: string;
	bkashTrxId?: string;
	payerReference?: string;
	paidAt?: Date;
	shipmentId: string;
}
