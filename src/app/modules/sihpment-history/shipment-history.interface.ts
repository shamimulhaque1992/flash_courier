import { ShipmentStatus } from "../../../generated/prisma";

export interface IShipmentHistory {
    id: string;
    shipmentId: string;
    status: ShipmentStatus;
    updatedBy: string;
    remarks?: string;
}
