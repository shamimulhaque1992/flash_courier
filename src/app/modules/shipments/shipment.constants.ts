import { ShipmentStatus } from "../../../generated/prisma/enums";

// Base transitions valid for all shipments
export const SAME_DIVISION_TRANSITIONS: Partial<
	Record<ShipmentStatus, ShipmentStatus[]>
> = {
	[ShipmentStatus.PAID]: [ShipmentStatus.READY_FOR_ASSIGNMENT],
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

// Inter-division: PAID must go IN_TRANSIT first, then READY_FOR_ASSIGNMENT
export const INTER_DIVISION_TRANSITIONS: Partial<
	Record<ShipmentStatus, ShipmentStatus[]>
> = {
	...SAME_DIVISION_TRANSITIONS,
	[ShipmentStatus.PAID]: [ShipmentStatus.IN_TRANSIT],
	[ShipmentStatus.IN_TRANSIT]: [
		ShipmentStatus.READY_FOR_ASSIGNMENT,
		ShipmentStatus.ASSIGNED,
	],
};
