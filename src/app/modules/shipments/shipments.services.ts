import httpStatus from "http-status";
import { PaymentStatus, ShipmentStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { generatePdf } from "../../utils/generatePdf";
import { sendEmail } from "../../utils/sendEmail";
import { calculateShipmentFee } from "../../utils/shipmentPricing";
import type { ICreateShipmentPayload } from "./shipments.interface";

const generateTrackingNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FC-${timestamp}-${random}`;
};

const createShipment = async (
  payload: ICreateShipmentPayload,
  user: RequestUser,
) => {
  return prisma.$transaction(async (tx) => {
    const merchant = await tx.merchants.findUnique({
      where: { userId: user.userId },
    });

    if (!merchant) {
      throw new AppError(httpStatus.NOT_FOUND, "Merchant profile not found");
    }

    if (merchant.verificationStatus !== "VERIFIED") {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Only verified merchants can create shipments",
      );
    }

    const pricing = calculateShipmentFee({
      senderDivision: merchant.division,
      receiverDivision: payload.receiverDivision,
      weightKg: payload.packageWeight,
      isFragile: payload.isFragile,
    });

    const trackingNumber = generateTrackingNumber();

    const shipment = await tx.shipments.create({
      data: {
        trackingNumber,
        receiverName: payload.receiverName,
        receiverEmail: payload.receiverEmail,
        receiverContactNumber: payload.receiverContactNumber,
        receiverThana: payload.receiverThana,
        receiverDistrict: payload.receiverDistrict,
        receiverDivision: payload.receiverDivision,
        receiverAddress: payload.receiverAddress,
        packageDescription: payload.packageDescription,
        packageWeight: payload.packageWeight,
        packageDimensions: payload.packageDimensions,
        isFragile: payload.isFragile ?? false,
        deliveryFee: pricing.totalFee,
        note: payload.note,
        merchantId: merchant.id,
        shipmentStatus: ShipmentStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    const bkashIdToken = await getBkashIdToken();
    if (!bkashIdToken) {
      throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash access token found");
    }

    const bkashCreateResponse = await fetch(
      `${config.bkash_app_base_url}/tokenized/checkout/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          authorization: bkashIdToken,
          "x-app-key": config.bkash_app_key,
        },
        body: JSON.stringify({
          mode: "0011",
          payerReference: user.email,
          callbackURL: `${config.bkash_callback_url}/shipments/payment/callback`,
          amount: pricing.totalFee.toString(),
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: shipment.id,
        }),
      },
    );

    const bkashCreateResult = await bkashCreateResponse.json();

    await tx.payments.create({
      data: {
        merchantInvoiceNumber: bkashCreateResult.merchantInvoiceNumber,
        shipmentId: shipment.id,
        amount: pricing.totalFee,
        bkashPaymentId: bkashCreateResult.paymentID,
        payerReference: user.email,
        gatewayResponse: bkashCreateResult,
      },
    });

    return {
      shipment,
      pricingBreakdown: pricing,
      bkashURL: bkashCreateResult.bkashURL,
    };
  });
};

const shipmentPaymentCallback = async (query: Record<string, string>) => {
  return prisma.$transaction(async (tx) => {
    const { paymentID: paymentId, status } = query;

    if (!paymentId) {
      throw new AppError(httpStatus.BAD_REQUEST, "Payment ID missing");
    }
    if (!status) {
      throw new AppError(httpStatus.BAD_REQUEST, "Payment status missing");
    }

    const bkashIdToken = await getBkashIdToken();
    if (!bkashIdToken) {
      throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash access token found");
    }

    const bkashExecuteResponse = await fetch(
      `${config.bkash_app_base_url}/tokenized/checkout/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          authorization: bkashIdToken,
          "x-app-key": config.bkash_app_key,
        },
        body: JSON.stringify({ paymentID: paymentId }),
      },
    );

    if (!bkashExecuteResponse.ok) {
      throw new AppError(httpStatus.BAD_GATEWAY, "Bkash execute failed!");
    }

    const bkashExecuteResult = await bkashExecuteResponse.json();

    if (status === "success") {
      const shipment = await tx.shipments.update({
        where: { id: bkashExecuteResult.merchantInvoiceNumber },
        data: {
          shipmentStatus: ShipmentStatus.PAID,
          paymentStatus: PaymentStatus.PAID,
        },
        include: { merchant: true },
      });

      await tx.payments.update({
        where: {
          shipmentId: bkashExecuteResult.merchantInvoiceNumber,
          bkashPaymentId: paymentId,
        },
        data: {
          status: PaymentStatus.PAID,
          bkashTrxId: bkashExecuteResult.trxID,
          paidAt: new Date(bkashExecuteResult.paymentExecuteTime),
          gatewayResponse: bkashExecuteResult,
        },
      });

      const invoicePdf = await generatePdf((doc) => {
        doc.fontSize(20).text("Flash Courier", { align: "center" });
        doc.fontSize(14).text("Shipment Invoice", { align: "center" });
        doc.moveDown(2);

        doc.fontSize(12).text(`Merchant: ${shipment.merchant.name}`);
        doc.text(`Merchant Email: ${shipment.merchant.email}`);
        doc.moveDown();

        doc.text(`Tracking Number: ${shipment.trackingNumber}`);
        doc.moveDown();

        doc.text("Receiver Information:");
        doc.text(`  Name: ${shipment.receiverName}`);
        doc.text(`  Email: ${shipment.receiverEmail}`);
        doc.text(`  Contact: ${shipment.receiverContactNumber}`);
        doc.text(
          `  Address: ${shipment.receiverThana}, ${shipment.receiverDistrict}, ${shipment.receiverDivision}`,
        );
        if (shipment.receiverAddress) {
          doc.text(`  Full Address: ${shipment.receiverAddress}`);
        }
        doc.moveDown();

        doc.text("Package Information:");
        if (shipment.packageWeight) {
          doc.text(`  Weight: ${shipment.packageWeight} kg`);
        }
        if (shipment.packageDimensions) {
          doc.text(`  Dimensions: ${shipment.packageDimensions}`);
        }
        if (shipment.packageDescription) {
          doc.text(`  Description: ${shipment.packageDescription}`);
        }
        doc.text(`  Fragile: ${shipment.isFragile ? "Yes" : "No"}`);
        doc.moveDown();

        doc.text("Payment Information:");
        doc.text(`  Delivery Fee: ${shipment.deliveryFee} BDT`);
        doc.text(`  Payment Method: bKash`);
        doc.text(`  Transaction ID: ${bkashExecuteResult.trxID}`);
        doc.text(`  Paid At: ${bkashExecuteResult.paymentExecuteTime}`);
      });

      const templateData = {
        merchantName: shipment.merchant.name,
        trackingNumber: shipment.trackingNumber,
        receiverName: shipment.receiverName,
        receiverDistrict: shipment.receiverDistrict,
        receiverDivision: shipment.receiverDivision,
        packageWeight: shipment.packageWeight ?? "N/A",
        deliveryFee: shipment.deliveryFee.toString(),
        trxId: bkashExecuteResult.trxID,
      };

      await sendEmail("shipment-payment-success.ejs", templateData, {
        from: config.email_sender,
        to: shipment.merchant.email,
        subject: "Shipment Payment Confirmed — Flash Courier",
        attachments: [
          { filename: "shipment_invoice.pdf", content: invoicePdf },
        ],
      });

      return {
        redirectUrl: `${config.frontend_url}/dashboard/shipments?status=success`,
      };
    }

    if (status === "failure") {
      await tx.payments.update({
        where: { bkashPaymentId: paymentId },
        data: {
          status: PaymentStatus.FAILED,
          gatewayResponse: bkashExecuteResult,
        },
      });
      return {
        redirectUrl: `${config.frontend_url}/dashboard/shipments?status=failure`,
      };
    }

    if (status === "cancel") {
      await tx.payments.update({
        where: { bkashPaymentId: paymentId },
        data: {
          status: PaymentStatus.FAILED,
          gatewayResponse: bkashExecuteResult,
        },
      });
      return {
        redirectUrl: `${config.frontend_url}/dashboard/shipments?status=cancel`,
      };
    }

    return {
      redirectUrl: `${config.frontend_url}/dashboard/shipments?error=payment-failed`,
    };
  });
};

const payForShipment = async (
  payload: { shipmentId: string },
  user: RequestUser,
) => {
  const shipment = await prisma.shipments.findUnique({
    where: { id: payload.shipmentId },
    include: { payment: true, merchant: true },
  });

  if (!shipment) {
    throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");
  }

  if (shipment.merchant.userId !== user.userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only pay for your own shipments",
    );
  }

  if (shipment.shipmentStatus !== ShipmentStatus.PENDING_PAYMENT) {
    throw new AppError(httpStatus.CONFLICT, "Shipment is not pending payment");
  }

  const bkashIdToken = await getBkashIdToken();
  if (!bkashIdToken) {
    throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash access token found");
  }

  const bkashCreateResponse = await fetch(
    `${config.bkash_app_base_url}/tokenized/checkout/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        authorization: bkashIdToken,
        "x-app-key": config.bkash_app_key,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: user.email,
        callbackURL: `${config.bkash_callback_url}/shipments/payment/callback`,
        amount: shipment.deliveryFee.toString(),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: shipment.id,
      }),
    },
  );

  const bkashCreateResult = await bkashCreateResponse.json();

  await prisma.payments.update({
    where: { shipmentId: shipment.id },
    data: {
      merchantInvoiceNumber: bkashCreateResult.merchantInvoiceNumber,
      bkashPaymentId: bkashCreateResult.paymentID,
      gatewayResponse: bkashCreateResult,
    },
  });

  return { bkashURL: bkashCreateResult.bkashURL };
};

export const ShipmentServices = {
  createShipment,
  shipmentPaymentCallback,
  payForShipment,
};
