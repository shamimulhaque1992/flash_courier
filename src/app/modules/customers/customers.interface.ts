import type { Division } from "../../../generated/prisma/enums";

export interface ICustomer {
	id: string;
	name: string;
	email: string;
	contactNumber?: string;
	division: Division;
	thana?: string;
	district?: string;
	address?: string;
	userId: string;
}
