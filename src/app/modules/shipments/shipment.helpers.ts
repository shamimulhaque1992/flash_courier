import type { ShipmentsWhereInput } from "../../../generated/prisma/models";
import type { IQuery } from "../../interfaces";

export const buildMeta = (page: number, limit: number, total: number) => ({
	page,
	limit,
	total,
	totalPages: Math.ceil(total / limit),
});

export const applyCommonFilters = (
	conditions: ShipmentsWhereInput[],
	query: IQuery,
) => {
	if (query.status) conditions.push({ shipmentStatus: query.status });
	if (query.paymentStatus)
		conditions.push({ paymentStatus: query.paymentStatus });
	if (query.trackingNumber)
		conditions.push({ trackingNumber: query.trackingNumber });
	if (query.searchTerm)
		conditions.push({
			OR: [
				{ trackingNumber: { contains: query.searchTerm, mode: "insensitive" } },
				{ receiverName: { contains: query.searchTerm, mode: "insensitive" } },
				{ receiverEmail: { contains: query.searchTerm, mode: "insensitive" } },
				{
					receiverDistrict: { contains: query.searchTerm, mode: "insensitive" },
				},
			],
		});
};

export const getPaginationParams = (query: IQuery) => ({
	limit: query.limit ? Number(query.limit) : 10,
	page: query.page ? Number(query.page) : 1,
	skip:
		((query.page ? Number(query.page) : 1) - 1) *
		(query.limit ? Number(query.limit) : 10),
	sortBy: query.sortBy ?? "createdAt",
	sortOrder: query.sortOrder ?? "desc",
});
