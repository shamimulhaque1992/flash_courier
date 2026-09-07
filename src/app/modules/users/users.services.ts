import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

const uploadImage = async (buffer: Buffer, userId: string) => {
	const currentUser = await prisma.users.findUnique({
		where: { id: userId },
		select: {
			imageUrl: true,
			imagePublicId: true,
		},
	});
	const cloudinaryResponse = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream({ resource_type: "auto" }, async (error, result) => {
					if (error) {
						console.error(`Cloudinary upload failed: ${error.message}`);
						reject(error);
					}
					if (!result) {
						return reject(
							new AppError(
								httpStatus.INTERNAL_SERVER_ERROR,
								"Cloudinary upload returned no result",
							),
						);
					}
					resolve(result);

					// const updateUser = await prisma.user.update({
					// 	where: { id: userId },
					// 	data: {
					// 		imageUrl: result?.secure_url || null,
					// 		imagePublicId: result?.public_id || null,
					// 	},
					// });
					// console.log("🚀 ~ uploadImage ~ updateUser:", updateUser);
				})
				.end(buffer);
		},
	);

	const updateUser = await prisma.users.update({
		where: { id: userId },
		data: {
			imageUrl: cloudinaryResponse?.secure_url || null,
			imagePublicId: cloudinaryResponse?.public_id || null,
		},
		omit: {
			password: true,
		},
	});

	if (currentUser?.imagePublicId && currentUser?.imageUrl) {
		await cloudinary.uploader.destroy(currentUser.imagePublicId);
	}

	return updateUser;
};

export const userServices = {
	uploadImage,
};
