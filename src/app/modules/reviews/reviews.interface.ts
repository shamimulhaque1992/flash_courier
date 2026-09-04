export interface IReview {
	id: string;
	merchantRating: number;
	riderRating: number;
	comment?: string;
	customerId: string;
	merchantId: string;
	riderId: string;
	shipmentId: string;
}
