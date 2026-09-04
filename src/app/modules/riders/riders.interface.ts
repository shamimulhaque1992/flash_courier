import type { RiderVerificationStatus } from "../../../generated/prisma";

export interface IRider {
	id: string;
	name: string;
	email: string;
	contactNumber: string;
	nidNumber: string;
	nidDocument: string;
	nidDocumentPublicId: string;
	address?: string;
	licenseNumber?: string;
	vehicleType?: string;
	vehicleRegistrationNumber?: string;
	verificationStatus: RiderVerificationStatus;
	userId: string;
}
