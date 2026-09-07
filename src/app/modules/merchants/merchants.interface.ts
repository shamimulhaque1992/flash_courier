import { Division, MerchantVerificationStatus, Role } from "../../../generated/prisma/enums";

export interface IApplyAsMerchantPayload {
  user: {
    name: string;
    email: string;
    password: string;
    role: Role;
  };
  merchant: {
    contactNumber: string;
    thana: string;
    district: string;
    division: Division;
    address: string;
    tradeLicenseNumber: string;
    businessLicenseNumber: string;
    businessType: string;
    businessDescription: string;
  };
}
export interface IVerifyMerchantEmailPayload {
  email: string;
  otp: string;
}
export interface IApproveMerchantApplicationPayload {
  merchantId: string;
  verificationStatus: MerchantVerificationStatus;
  rejectionReason?: string;
}
