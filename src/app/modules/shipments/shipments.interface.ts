import type { Division } from "../../../generated/prisma/enums";

export interface IUpdateShipmentStatusPayload {
	status: string;
	remarks?: string;
}

export interface ICancelShipmentPayload {
	shipmentId: string;
}

export interface ICreateShipmentPayload {
	receiverName: string;
	receiverEmail: string;
	receiverContactNumber: string;
	receiverThana: string;
	receiverDistrict: string;
	receiverDivision: Division;
	receiverAddress?: string;
	packageDescription?: string;
	packageWeight: number;
	packageDimensions?: string;
	isFragile?: boolean;
	note?: string;
}

export interface IRepayShipmentPayload {
	shipmentId: string;
}
