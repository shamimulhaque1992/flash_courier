export interface ICreateShipmentPayload {
	receiverName: string;
	receiverEmail: string;
	receiverContactNumber: string;
	receiverThana: string;
	receiverDistrict: string;
	receiverDivision: string;
	receiverAddress?: string;
	packageDescription?: string;
	packageWeight: number;
	packageDimensions?: string;
	isFragile?: boolean;
	note?: string;
}

export interface IRepayShipmentPayload {
	shipmentId: string
}