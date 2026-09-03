import { PaymentStatus, ShipmentStatus } from "../../../generated/prisma";

export interface IShipment {
    id: string;
    trackingNumber: string;
    receiverName: string;
    receiverEmail: string;
    receiverContactNumber: string;
    receiverThana: string;
    receiverDistrict: string;
    receiverDivision: string;
    receiverAddress?: string;
    packageDescription?: string;
    packageWeight?: number;
    packageDimensions?: string;
    deliveryFee: number;
    paymentStatus: PaymentStatus;
    shipmentStatus: ShipmentStatus;
    note?: string;
    pickedUpAt?: Date;
    probableDeliveryTime?: Date;
    actualDeliveryTime?: Date;
    merchantId: string;
    customerId?: string;
    riderId?: string;
}
