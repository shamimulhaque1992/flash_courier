export interface IMerchant {
    id: string;
    name: string;
    email: string;
    contactNumber?: string;
    address?: string;
    businessLicenseNumber: string;
    businessType: string;
    businessDescription?: string;
    businessLicenseDocument: string;
    businessLicenseDocumentPublicId: string;
    userId: string;
}
