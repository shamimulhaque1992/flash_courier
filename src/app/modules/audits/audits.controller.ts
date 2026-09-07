import httpStatus from "http-status";
import type { RequestUser } from "../../middleware/checkAuth";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuditServices } from "./audits.services";

const publishAudit = catchAsync(async (req, res) => {
	const result = await AuditServices.publishAudit(
		req.body,
		req.user as RequestUser,
	);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Audit report published and emailed to merchant",
		data: result,
	});
});

const getMerchantAudits = catchAsync(async (req, res) => {
	const result = await AuditServices.getMerchantAudits(
		req.params.merchantId as string,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Audit reports retrieved",
		data: result,
	});
});

export const AuditControllers = { publishAudit, getMerchantAudits };
