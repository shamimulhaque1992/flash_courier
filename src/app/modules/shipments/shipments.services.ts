import crypto from "crypto";
import { addMinutes, format } from "date-fns";
import httpStatus from "http-status";
import {
  PaymentStatus,
  RiderScheduleStatus,
  ShipmentStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { generatePdf } from "../../utils/generatePdf";
import { sendEmail } from "../../utils/sendEmail";
import { calculateShipmentFee } from "../../utils/shipmentPricing";
import type {
  ICreateShipmentPayload,
  IRepayShipmentPayload,
  IUpdateShipmentStatusPayload,
  ICancelShipmentPayload,
} from "./shipments.interface";
import type { IQuery } from "../../interfaces";
import type { ShipmentsWhereInput } from "../../../generated/prisma/models";
import {
  computeProbableDeliveryTime,
  getNextOccurrenceOfDay,
} from "../riders-schedules/riders-schedules.services";

const SLOT_DURATION_MINUTES = 40;

const generateTrackingNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FC-${timestamp}-${random}`;
};

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const createShipment = async (
  payload: ICreateShipmentPayload,
  user: RequestUser,
) => {
  return prisma.$transaction(async (tx) => {
    const merchant = await tx.merchants.findUnique({
      where: { userId: user.userId },
    });

    if (!merchant)
      throw new AppError(httpStatus.NOT_FOUND, "Merchant profile not found");

    if (merchant.verificationStatus !== "VERIFIED")
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Only verified merchants can create shipments",
      );

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
    if (!bkashIdToken)
      throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash access token found");

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
  const { paymentID: paymentId, status } = query;

  if (!paymentId)
    throw new AppError(httpStatus.BAD_REQUEST, "Payment ID missing");
  if (!status)
    throw new AppError(httpStatus.BAD_REQUEST, "Payment status missing");

  const { shipment, bkashExecuteResult } = await prisma.$transaction(
    async (tx) => {
      const bkashIdToken = await getBkashIdToken();
      if (!bkashIdToken)
        throw new AppError(
          httpStatus.BAD_GATEWAY,
          "No Bkash access token found",
        );

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

      if (!bkashExecuteResponse.ok)
        throw new AppError(httpStatus.BAD_GATEWAY, "Bkash execute failed!");

      const bkashExecuteResult = await bkashExecuteResponse.json();

      const payment = await tx.payments.findUnique({
        where: { bkashPaymentId: paymentId },
      });

      if (!payment)
        throw new AppError(httpStatus.NOT_FOUND, "Payment record not found");

      if (status === "success") {
        const shipment = await tx.shipments.update({
          where: { id: payment.shipmentId },
          data: {
            shipmentStatus: ShipmentStatus.PAID,
            paymentStatus: PaymentStatus.PAID,
          },
          include: { merchant: true },
        });

        await tx.payments.update({
          where: { bkashPaymentId: paymentId },
          data: {
            status: PaymentStatus.PAID,
            bkashTrxId: bkashExecuteResult.trxID,
            paidAt: bkashExecuteResult.paymentExecuteTime,
            gatewayResponse: bkashExecuteResult,
          },
        });

        return { shipment, bkashExecuteResult };
      }

      await tx.payments.update({
        where: { bkashPaymentId: paymentId },
        data: {
          status: PaymentStatus.FAILED,
          gatewayResponse: bkashExecuteResult,
        },
      });
      return { shipment: null, bkashExecuteResult };
    },
    { timeout: 15000 },
  );

  if (status !== "success" || !shipment) {
    const redirectStatus =
      status === "failure" || status === "cancel"
        ? status
        : "error=payment-failed";
    return {
      redirectUrl: `${config.frontend_url}/dashboard/shipments?status=${redirectStatus}`,
    };
  }

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
    if (shipment.receiverAddress)
      doc.text(`  Full Address: ${shipment.receiverAddress}`);
    doc.moveDown();
    doc.text("Package Information:");
    if (shipment.packageWeight)
      doc.text(`  Weight: ${shipment.packageWeight} kg`);
    if (shipment.packageDimensions)
      doc.text(`  Dimensions: ${shipment.packageDimensions}`);
    if (shipment.packageDescription)
      doc.text(`  Description: ${shipment.packageDescription}`);
    doc.text(`  Fragile: ${shipment.isFragile ? "Yes" : "No"}`);
    doc.moveDown();
    doc.text("Payment Information:");
    doc.text(`  Delivery Fee: ${shipment.deliveryFee} BDT`);
    doc.text(`  Payment Method: bKash`);
    doc.text(`  Transaction ID: ${bkashExecuteResult.trxID}`);
    doc.text(`  Paid At: ${bkashExecuteResult.paymentExecuteTime}`);
  });

  await sendEmail(
    "shipment-payment-success.ejs",
    {
      merchantName: shipment.merchant.name,
      trackingNumber: shipment.trackingNumber,
      receiverName: shipment.receiverName,
      receiverDistrict: shipment.receiverDistrict,
      receiverDivision: shipment.receiverDivision,
      packageWeight: shipment.packageWeight ?? "N/A",
      deliveryFee: shipment.deliveryFee.toString(),
      trxId: bkashExecuteResult.trxID,
    },
    {
      from: config.email_sender,
      to: shipment.merchant.email,
      subject: "Shipment Payment Confirmed — Flash Courier",
      attachments: [{ filename: "shipment_invoice.pdf", content: invoicePdf }],
    },
  );

  return {
    redirectUrl: `${config.frontend_url}/dashboard/shipments?status=success`,
  };
};

const payForShipment = async (
  payload: IRepayShipmentPayload,
  user: RequestUser,
) => {
  const shipment = await prisma.shipments.findUnique({
    where: { id: payload.shipmentId },
    include: { payment: true, merchant: true },
  });

  if (!shipment) throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");

  if (shipment.merchant.userId !== user.userId)
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only pay for your own shipments",
    );

  if (shipment.shipmentStatus !== ShipmentStatus.PENDING_PAYMENT)
    throw new AppError(httpStatus.CONFLICT, "Shipment is not pending payment");

  const bkashIdToken = await getBkashIdToken();
  if (!bkashIdToken)
    throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash access token found");

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

const assignShipment = async (
  shipmentId: string,
  scheduleId: string,
  adminUser: RequestUser,
) => {
  const { updatedShipment, otp, riderName, riderEmail, probableDeliveryTime } =
    await prisma.$transaction(async (tx) => {
      const schedule = await tx.riderSchedules.findUnique({
        where: { id: scheduleId },
        include: { rider: true },
      });

      if (!schedule || schedule.isDeleted)
        throw new AppError(httpStatus.NOT_FOUND, "Schedule not found");

      if (schedule.status !== RiderScheduleStatus.PUBLISHED)
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Can only assign shipments to a published schedule",
        );

      if (schedule.availableSlots <= 0)
        throw new AppError(
          httpStatus.CONFLICT,
          "No available slots on this schedule",
        );

      const shipment = await tx.shipments.findUnique({
        where: { id: shipmentId },
      });

      if (!shipment || shipment.isDeleted)
        throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");

      if (shipment.shipmentStatus !== ShipmentStatus.READY_FOR_ASSIGNMENT)
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Shipment is not ready for assignment",
        );

      const slotIndex = schedule.totalSlots - schedule.availableSlots;
      const assignmentDate = getNextOccurrenceOfDay(schedule.dayOfWeek);
      const calculatedTime = computeProbableDeliveryTime(
        schedule.startTime,
        slotIndex,
        assignmentDate,
      );
      // If rider is already ahead of the calculated slot time (finished early),
      // use now + 40min instead so the probable time is never in the past
      const now = new Date();
      const probableDeliveryTime =
        calculatedTime > now
          ? calculatedTime
          : addMinutes(now, SLOT_DURATION_MINUTES);

      const otp = generateOtp();

      const [updatedShipment] = await Promise.all([
        tx.shipments.update({
          where: { id: shipmentId },
          data: {
            riderId: schedule.riderId,
            scheduleId: schedule.id,
            shipmentStatus: ShipmentStatus.ASSIGNED,
            probableDeliveryTime,
            otp,
          },
        }),
        tx.riderSchedules.update({
          where: { id: scheduleId },
          data: { availableSlots: { decrement: 1 } },
        }),
        tx.shipmentHistories.create({
          data: {
            shipmentId,
            status: ShipmentStatus.ASSIGNED,
            updatedBy: adminUser.userId,
            remarks: `Assigned to rider ${schedule.rider.name}. Probable delivery: ${format(probableDeliveryTime, "PPpp")}`,
          },
        }),
      ]);

      return {
        updatedShipment,
        otp,
        riderName: schedule.rider.name,
        riderEmail: schedule.rider.email,
        probableDeliveryTime,
      };
    });

  // PDF + emails outside transaction — non-critical, DB already committed
  const deliveryPdf = await generatePdf((doc) => {
    doc.fontSize(20).text("Flash Courier", { align: "center" });
    doc.fontSize(14).text("Delivery Notification", { align: "center" });
    doc.moveDown(2);
    doc.fontSize(12).text(`Dear ${updatedShipment.receiverName},`);
    doc.moveDown();
    doc.text("Your shipment has been assigned to a rider and is on its way.");
    doc.moveDown();
    doc.text(`Tracking Number: ${updatedShipment.trackingNumber}`);
    doc.text(`Rider: ${riderName}`);
    doc.text(`Probable Delivery: ${format(probableDeliveryTime, "PPpp")}`);
    doc.moveDown();
    doc.fontSize(16).text("Delivery OTP", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(28).fillColor("#f97316").text(otp, { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(11)
      .fillColor("black")
      .text(
        "Share this OTP only with the rider upon delivery to confirm receipt.",
        { align: "center" },
      );
  });

  await Promise.all([
    // Email to customer — with OTP and delivery PDF
    sendEmail(
      "shipment-assigned.ejs",
      {
        receiverName: updatedShipment.receiverName,
        trackingNumber: updatedShipment.trackingNumber,
        riderName,
        probableDeliveryTime: format(probableDeliveryTime, "PPpp"),
        otp,
      },
      {
        from: config.email_sender,
        to: updatedShipment.receiverEmail,
        subject: "Your Shipment Is On Its Way — Flash Courier",
        attachments: [
          { filename: "delivery_notification.pdf", content: deliveryPdf },
        ],
      },
    ),
    // Email to rider — address + fee only, no package details
    sendEmail(
      "shipment-assigned-rider.ejs",
      {
        riderName,
        trackingNumber: updatedShipment.trackingNumber,
        probableDeliveryTime: format(probableDeliveryTime, "PPpp"),
        receiverName: updatedShipment.receiverName,
        receiverContactNumber: updatedShipment.receiverContactNumber,
        receiverThana: updatedShipment.receiverThana,
        receiverDistrict: updatedShipment.receiverDistrict,
        receiverDivision: updatedShipment.receiverDivision,
        receiverAddress: updatedShipment.receiverAddress ?? null,
        deliveryFee: updatedShipment.deliveryFee.toString(),
      },
      {
        from: config.email_sender,
        to: riderEmail,
        subject: "New Shipment Assigned to You — Flash Courier",
      },
    ),
  ]);

  return updatedShipment;
};

const respondToShipment = async (
  shipmentId: string,
  status: "ACCEPTED_BY_RIDER" | "REJECTED_BY_RIDER",
  riderUser: RequestUser,
) => {
  return prisma.$transaction(async (tx) => {
    const rider = await tx.riders.findUnique({
      where: { userId: riderUser.userId },
    });
    if (!rider || rider.isDeleted)
      throw new AppError(httpStatus.NOT_FOUND, "Rider profile not found");

    const shipment = await tx.shipments.findUnique({
      where: { id: shipmentId, riderId: rider.id },
    });

    if (!shipment || shipment.isDeleted)
      throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");

    if (shipment.shipmentStatus !== ShipmentStatus.ASSIGNED)
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Shipment must be in ASSIGNED status to accept or reject",
      );

    const [updatedShipment] = await Promise.all([
      tx.shipments.update({
        where: { id: shipmentId },
        data: { shipmentStatus: status },
      }),
      tx.shipmentHistories.create({
        data: {
          shipmentId,
          status,
          updatedBy: riderUser.userId,
          remarks:
            status === ShipmentStatus.ACCEPTED_BY_RIDER
              ? "Shipment accepted by rider"
              : "Shipment rejected by rider",
        },
      }),
    ]);

    if (status === ShipmentStatus.REJECTED_BY_RIDER && shipment.scheduleId) {
      await tx.riderSchedules.update({
        where: { id: shipment.scheduleId },
        data: { availableSlots: { increment: 1 } },
      });
    }

    return updatedShipment;
  });
};

const markShipmentDelivered = async (
  shipmentId: string,
  otp: string,
  riderUser: RequestUser,
) => {
  return prisma.$transaction(async (tx) => {
    const rider = await tx.riders.findUnique({
      where: { userId: riderUser.userId },
    });
    if (!rider || rider.isDeleted)
      throw new AppError(httpStatus.NOT_FOUND, "Rider profile not found");

    const shipment = await tx.shipments.findUnique({
      where: { id: shipmentId, riderId: rider.id },
      include: { schedule: true },
    });

    if (!shipment || shipment.isDeleted)
      throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");

    if (shipment.shipmentStatus !== ShipmentStatus.OUT_FOR_DELIVERY)
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Shipment must be out for delivery before marking as delivered",
      );

    if (!shipment.otp || shipment.otp !== otp)
      throw new AppError(httpStatus.BAD_REQUEST, "Invalid delivery OTP");

    const actualDeliveryTime = new Date();

    await Promise.all([
      tx.shipments.update({
        where: { id: shipmentId },
        data: {
          shipmentStatus: ShipmentStatus.DELIVERED,
          actualDeliveryTime,
          otp: null, // clear OTP after successful delivery
        },
      }),
      tx.shipmentHistories.create({
        data: {
          shipmentId,
          status: ShipmentStatus.DELIVERED,
          updatedBy: riderUser.userId,
          remarks: "Delivered successfully — OTP verified",
        },
      }),
    ]);

    // Readjust remaining shipments on the same schedule from actualDeliveryTime forward
    if (shipment.scheduleId && shipment.schedule) {
      const remainingShipments = await tx.shipments.findMany({
        where: {
          scheduleId: shipment.scheduleId,
          id: { not: shipmentId },
          shipmentStatus: {
            in: [
              ShipmentStatus.ASSIGNED,
              ShipmentStatus.ACCEPTED_BY_RIDER,
              ShipmentStatus.PICKED_UP,
            ],
          },
        },
        orderBy: { probableDeliveryTime: "asc" },
      });

      let nextSlotStart = actualDeliveryTime;
      for (const s of remainingShipments) {
        const newProbableDeliveryTime = addMinutes(
          nextSlotStart,
          SLOT_DURATION_MINUTES,
        );
        await tx.shipments.update({
          where: { id: s.id },
          data: { probableDeliveryTime: newProbableDeliveryTime },
        });
        nextSlotStart = newProbableDeliveryTime;
      }
    }

    return { message: "Shipment delivered successfully. Schedule readjusted." };
  });
};

const cancelShipment = async (
  payload: ICancelShipmentPayload,
  user: RequestUser,
) => {
  return prisma.$transaction(async (tx) => {
    const merchant = await tx.merchants.findUnique({
      where: { userId: user.userId },
    });
    if (!merchant)
      throw new AppError(httpStatus.NOT_FOUND, "Merchant profile not found");

    const shipment = await tx.shipments.findUnique({
      where: { id: payload.shipmentId, merchantId: merchant.id },
      include: { payment: true, merchant: true },
    });

    if (!shipment || shipment.isDeleted)
      throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");

    if (shipment.shipmentStatus === ShipmentStatus.CANCELLED_BY_MERCHANT)
      throw new AppError(httpStatus.CONFLICT, "Shipment is already cancelled");

    if (shipment.shipmentStatus === ShipmentStatus.DELIVERED)
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Cannot cancel a delivered shipment",
      );

    const isInterDivision =
      shipment.merchant.division.trim().toLowerCase() !==
      shipment.receiverDivision.trim().toLowerCase();

    // Same division: cancellable until ASSIGNED
    // Inter division: cancellable until IN_TRANSIT
    const nonCancellableStatuses = isInterDivision
      ? [
          ShipmentStatus.IN_TRANSIT,
          ShipmentStatus.PICKED_UP,
          ShipmentStatus.OUT_FOR_DELIVERY,
          ShipmentStatus.DELIVERED,
        ]
      : [
          ShipmentStatus.ASSIGNED,
          ShipmentStatus.ACCEPTED_BY_RIDER,
          ShipmentStatus.PICKED_UP,
          ShipmentStatus.IN_TRANSIT,
          ShipmentStatus.OUT_FOR_DELIVERY,
          ShipmentStatus.DELIVERED,
        ];

    if (
      nonCancellableStatuses.includes(
        shipment.shipmentStatus as ShipmentStatus as any,
      )
    )
      throw new AppError(
        httpStatus.BAD_REQUEST,
        isInterDivision
          ? "Inter-division shipment cannot be cancelled once it is in transit"
          : "Same-division shipment cannot be cancelled once it is assigned to a rider",
      );

    await tx.shipments.update({
      where: { id: shipment.id },
      data: { shipmentStatus: ShipmentStatus.CANCELLED_BY_MERCHANT },
    });

    // Restore schedule slot if shipment was assigned
    if (shipment.scheduleId) {
      await tx.riderSchedules.update({
        where: { id: shipment.scheduleId },
        data: { availableSlots: { increment: 1 } },
      });
    }

    await tx.shipmentHistories.create({
      data: {
        shipmentId: shipment.id,
        status: ShipmentStatus.CANCELLED_BY_MERCHANT,
        updatedBy: user.userId,
        remarks: "Cancelled by merchant",
      },
    });

    // Refund if payment was made
    if (shipment.paymentStatus === PaymentStatus.PAID && shipment.payment) {
      const bkashIdToken = await getBkashIdToken();
      if (!bkashIdToken)
        throw new AppError(
          httpStatus.BAD_GATEWAY,
          "No Bkash access token found",
        );

      const refundResponse = await fetch(
        `${config.bkash_app_base_url}/tokenized/checkout/payment/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            authorization: bkashIdToken,
            "x-app-key": config.bkash_app_key,
          },
          body: JSON.stringify({
            paymentID: shipment.payment.bkashPaymentId,
            trxID: shipment.payment.bkashTrxId,
            amount: shipment.payment.amount.toString(),
            sku: "Shipment Cancellation",
            reason: "Merchant cancelled shipment",
          }),
        },
      );

      const refundResult = await refundResponse.json();

      await tx.payments.update({
        where: { shipmentId: shipment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          refundTrxId: refundResult.refundTrxID,
          refundAmount: refundResult.amount,
          refundReason: "Merchant cancelled shipment",
          refundedAt: new Date(),
          gatewayResponse: refundResult,
        },
      });

      await tx.shipments.update({
        where: { id: shipment.id },
        data: { paymentStatus: PaymentStatus.REFUNDED },
      });
    }

    return await tx.shipments.findUnique({
      where: { id: shipment.id },
      include: { payment: true },
    });
  });
};

// Valid forward-only transitions
const ALLOWED_TRANSITIONS: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
  [ShipmentStatus.PAID]: [
    ShipmentStatus.READY_FOR_ASSIGNMENT,
    ShipmentStatus.IN_TRANSIT,
  ],
  [ShipmentStatus.READY_FOR_ASSIGNMENT]: [ShipmentStatus.IN_TRANSIT],
  [ShipmentStatus.IN_TRANSIT]: [
    ShipmentStatus.READY_FOR_ASSIGNMENT,
    ShipmentStatus.ASSIGNED,
  ],
  [ShipmentStatus.ASSIGNED]: [
    ShipmentStatus.ACCEPTED_BY_RIDER,
    ShipmentStatus.REJECTED_BY_RIDER,
  ],
  [ShipmentStatus.ACCEPTED_BY_RIDER]: [ShipmentStatus.PICKED_UP],
  [ShipmentStatus.REJECTED_BY_RIDER]: [ShipmentStatus.READY_FOR_ASSIGNMENT],
  [ShipmentStatus.PICKED_UP]: [ShipmentStatus.OUT_FOR_DELIVERY],
  [ShipmentStatus.OUT_FOR_DELIVERY]: [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.RETURNED_BY_CUSTOMER,
  ],
};

const updateShipmentStatus = async (
  shipmentId: string,
  payload: IUpdateShipmentStatusPayload,
  user: RequestUser,
) => {
  const shipment = await prisma.shipments.findUnique({
    where: { id: shipmentId },
  });

  if (!shipment || shipment.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");

  const currentStatus = shipment.shipmentStatus as ShipmentStatus;
  const newStatus = payload.status as ShipmentStatus;

  if (currentStatus === ShipmentStatus.DELIVERED)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot update a delivered shipment",
    );

  if (currentStatus === ShipmentStatus.CANCELLED_BY_MERCHANT)
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot update a cancelled shipment",
    );

  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus))
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot transition from ${currentStatus} to ${newStatus}`,
    );

  // If rejecting by rider, restore the schedule slot
  if (newStatus === ShipmentStatus.REJECTED_BY_RIDER && shipment.scheduleId) {
    await prisma.riderSchedules.update({
      where: { id: shipment.scheduleId },
      data: { availableSlots: { increment: 1 } },
    });
  }

  const [updatedShipment] = await Promise.all([
    prisma.shipments.update({
      where: { id: shipmentId },
      data: {
        shipmentStatus: newStatus,
        ...(newStatus === ShipmentStatus.PICKED_UP
          ? { pickedUpAt: new Date() }
          : {}),
      },
    }),
    prisma.shipmentHistories.create({
      data: {
        shipmentId,
        status: newStatus,
        updatedBy: user.userId,
        remarks: payload.remarks ?? `Status updated to ${newStatus} by admin`,
      },
    }),
  ]);

  return updatedShipment;
};

const getMerchantShipments = async (query: IQuery, user: RequestUser) => {
  const merchant = await prisma.merchants.findUnique({
    where: { userId: user.userId },
  });
  if (!merchant)
    throw new AppError(httpStatus.NOT_FOUND, "Merchant profile not found");

  const { limit, page, skip, sortBy, sortOrder } = getPaginationParams(query);
  const andConditions: ShipmentsWhereInput[] = [
    { merchantId: merchant.id },
    { isDeleted: false },
  ];

  applyCommonFilters(andConditions, query);

  const [data, total] = await Promise.all([
    prisma.shipments.findMany({
      where: { AND: andConditions },
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip,
      include: {
        payment: true,
        rider: { select: { name: true, email: true, contactNumber: true } },
        schedule: {
          select: { dayOfWeek: true, startTime: true, endTime: true },
        },
      },
    }),
    prisma.shipments.count({ where: { AND: andConditions } }),
  ]);

  return { data, meta: buildMeta(page, limit, total) };
};

const getCustomerShipments = async (query: IQuery, user: RequestUser) => {
  const { limit, page, skip, sortBy, sortOrder } = getPaginationParams(query);
  const andConditions: ShipmentsWhereInput[] = [
    { receiverEmail: user.email },
    { isDeleted: false },
  ];

  applyCommonFilters(andConditions, query);

  const [data, total] = await Promise.all([
    prisma.shipments.findMany({
      where: { AND: andConditions },
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip,
      include: {
        rider: { select: { name: true, contactNumber: true } },
      },
      omit: { otp: true },
    }),
    prisma.shipments.count({ where: { AND: andConditions } }),
  ]);

  return { data, meta: buildMeta(page, limit, total) };
};

const getRiderShipments = async (query: IQuery, user: RequestUser) => {
  const rider = await prisma.riders.findUnique({
    where: { userId: user.userId },
  });
  if (!rider || rider.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, "Rider profile not found");

  const { limit, page, skip, sortBy, sortOrder } = getPaginationParams(query);
  const andConditions: ShipmentsWhereInput[] = [
    { riderId: rider.id },
    { isDeleted: false },
  ];

  applyCommonFilters(andConditions, query);

  const [data, total] = await Promise.all([
    prisma.shipments.findMany({
      where: { AND: andConditions },
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip,
      include: {
        schedule: {
          select: { dayOfWeek: true, startTime: true, endTime: true },
        },
      },
      omit: {
        packageDescription: true,
        packageWeight: true,
        packageDimensions: true,
        isFragile: true,
        otp: true,
      },
    }),
    prisma.shipments.count({ where: { AND: andConditions } }),
  ]);

  return { data, meta: buildMeta(page, limit, total) };
};

const getAllShipments = async (query: IQuery) => {
  const { limit, page, skip, sortBy, sortOrder } = getPaginationParams(query);
  const andConditions: ShipmentsWhereInput[] = [{ isDeleted: false }];

  applyCommonFilters(andConditions, query);

  if (query.merchantId) andConditions.push({ merchantId: query.merchantId });
  if (query.riderId) andConditions.push({ riderId: query.riderId });
  if (query.merchantEmail)
    andConditions.push({
      merchant: {
        email: { contains: query.merchantEmail, mode: "insensitive" },
      },
    });
  if (query.riderEmail)
    andConditions.push({
      rider: { email: { contains: query.riderEmail, mode: "insensitive" } },
    });

  const [data, total] = await Promise.all([
    prisma.shipments.findMany({
      where: { AND: andConditions },
      orderBy: { [sortBy]: sortOrder },
      take: limit,
      skip,
      include: {
        merchant: { select: { name: true, email: true } },
        rider: { select: { name: true, email: true, contactNumber: true } },
        payment: true,
        schedule: {
          select: { dayOfWeek: true, startTime: true, endTime: true },
        },
      },
      omit: { otp: true },
    }),
    prisma.shipments.count({ where: { AND: andConditions } }),
  ]);

  return { data, meta: buildMeta(page, limit, total) };
};

const getSingleShipment = async (shipmentId: string, user: RequestUser) => {
  const isRider = user.role === "RIDER";

  const shipment = await prisma.shipments.findUnique({
    where: { id: shipmentId },
    include: {
      merchant: { select: { name: true, email: true, contactNumber: true } },
      rider: { select: { name: true, email: true, contactNumber: true } },
      payment: true,
      schedule: { select: { dayOfWeek: true, startTime: true, endTime: true } },
      shipmentHistory: { orderBy: { updatedAt: "asc" } },
    },
    omit: {
      otp: true,
      ...(isRider
        ? {
            packageDescription: true,
            packageWeight: true,
            packageDimensions: true,
            isFragile: true,
          }
        : {}),
    },
  });

  if (!shipment || shipment.isDeleted)
    throw new AppError(httpStatus.NOT_FOUND, "Shipment not found");

  // Ownership checks
  if (user.role === "MERCHANT") {
    const merchant = await prisma.merchants.findUnique({
      where: { userId: user.userId },
    });
    if (!merchant || shipment.merchantId !== merchant.id)
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to view this shipment",
      );
  }

  if (user.role === "RIDER") {
    const rider = await prisma.riders.findUnique({
      where: { userId: user.userId },
    });
    if (!rider || shipment.riderId !== rider.id)
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to view this shipment",
      );
  }

  if (user.role === "CUSTOMER") {
    if (shipment.receiverEmail !== user.email)
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to view this shipment",
      );
  }

  return shipment;
};

const getPaginationParams = (query: IQuery) => ({
  limit: query.limit ? Number(query.limit) : 10,
  page: query.page ? Number(query.page) : 1,
  skip:
    ((query.page ? Number(query.page) : 1) - 1) *
    (query.limit ? Number(query.limit) : 10),
  sortBy: query.sortBy ?? "createdAt",
  sortOrder: query.sortOrder ?? "desc",
});

const buildMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

const applyCommonFilters = (
  conditions: ShipmentsWhereInput[],
  query: IQuery,
) => {
  if (query.status) conditions.push({ shipmentStatus: query.status });
  if (query.paymentStatus)
    conditions.push({ paymentStatus: query.paymentStatus });
  if (query.trackingNumber)
    conditions.push({ trackingNumber: query.trackingNumber });
  if (query.searchTerm)
    conditions.push({
      OR: [
        { trackingNumber: { contains: query.searchTerm, mode: "insensitive" } },
        { receiverName: { contains: query.searchTerm, mode: "insensitive" } },
        { receiverEmail: { contains: query.searchTerm, mode: "insensitive" } },
        {
          receiverDistrict: { contains: query.searchTerm, mode: "insensitive" },
        },
        {
          receiverDivision: { contains: query.searchTerm, mode: "insensitive" },
        },
      ],
    });
};

export const ShipmentServices = {
  createShipment,
  shipmentPaymentCallback,
  payForShipment,
  assignShipment,
  respondToShipment,
  markShipmentDelivered,
  cancelShipment,
  updateShipmentStatus,
  getMerchantShipments,
  getCustomerShipments,
  getRiderShipments,
  getAllShipments,
  getSingleShipment,
};
