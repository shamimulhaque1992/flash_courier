import { RiderVerificationStatus, Role } from "../../../generated/prisma/enums";

export interface IApplyAsRiderPayload {
  user: {
    name: string;
    email: string;
    password: string;
    role: Role;
  };
  rider: {
    contactNumber: string;
    nidNumber: string;
    thana: string;
    district: string;
    division: string;
    address: string;
    licenseNumber?: string;
    vehicleType: string;
    vehicleRegistrationNumber?: string;
  };
}
export interface IVerifyRiderEmailPayload {
  email: string;
  otp: string;
}
export interface IApproveRiderApplicationPayload {
  riderId: string;
  verificationStatus: RiderVerificationStatus;
  rejectionReason?: string;
}
