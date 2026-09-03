import { AuthProvider, Role, UserStatus } from "../../../generated/prisma";

export interface IUser {
    id: string;
    name: string;
    email: string;
    role: Role;
    status: UserStatus;
    password?: string;
    googleId?: string;
    authProvider: AuthProvider;
    emailVerified: boolean;
    imageUrl?: string;
    imagePublicId?: string;
    needPasswordChange: boolean;
}
