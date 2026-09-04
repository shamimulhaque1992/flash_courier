import { Role } from "../../../generated/prisma/enums";

export interface IUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  userId: string;
}

export interface ILoginUserPayload {
  email: string;
  password: string;
}

export interface IRegisterCustomerPayload {
  name: string;
  email: string;
  password: string;
  customer?: {
    contactNumber: string;
    thana: string;
    district: string;
    division: string;
    address: string;
  };
}

export interface IRequestUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

export interface IGoogleLoginPayload {
  idToken: string;
}

export interface IForgotPasswordPayload {
  email: string;
}
export interface IResetPasswordPayload {
  email: string;
  newPassword: string;
  otp: string;
}
export interface IVerifyEmailPayload {
  email: string;
  otp: string;
}
