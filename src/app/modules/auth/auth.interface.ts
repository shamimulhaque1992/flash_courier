import { Role } from "../../../generated/prisma/enums";

export interface IUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  userId: string;
}
