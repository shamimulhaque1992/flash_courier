import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { TokenPayload } from "google-auth-library";
import httpStatus from "http-status";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import {
	AuthProvider,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import { sendEmail } from "../../utils/sendEmail";
import type {
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterCustomerPayload,
	IResetPasswordPayload,
	IVerifyEmailPayload,
} from "./auth.interface";

const registerCustomer = async (payload: IRegisterCustomerPayload) => {
	const { name, email, password, customer } = payload;

	const isUserExists = await prisma.users.findUnique({
		where: {
			email,
		},
	});

	if (isUserExists) {
		throw new Error("User already exists");
	}

	const hashedPassword = await bcrypt.hash(password, 8);
	const expirationSeconds = 5 * 60;
	const otpKey = `register-customer-otp:${email}`;
	const otpValue = crypto.randomInt(100000, 1000000).toString();

	await redisClient.set(otpKey, otpValue, {
		expiration: {
			type: "EX",
			value: expirationSeconds,
		},
	});

	const customerRegistrationKey = `customer-registration-data:${email}`;
	const customerRegistrationPayload = {
		name,
		email,
		password: hashedPassword,
		customer,
	};

	await redisClient.set(
		customerRegistrationKey,
		JSON.stringify(customerRegistrationPayload),
		{
			expiration: {
				type: "EX",
				value: expirationSeconds,
			},
		},
	);

	const templateData = {
		name,
		email,
		otp: otpValue,
		expirationMinutes: expirationSeconds / 60,
	};

	await sendEmail("verify-email.ejs", templateData, {
		from: config.email_sender,
		to: email,
		subject: "Verify your email",
	});
};

const verifyUserEmail = async (payload: IVerifyEmailPayload) => {
	const { otp } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExits = await prisma.users.findUnique({
		where: { email },
	});

	if (isUserExits?.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}
	if (isUserExits?.emailVerified) {
		throw new AppError(httpStatus.CONFLICT, "User is already verified");
	}

	if (isUserExits?.isDeleted || isUserExits?.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.GONE, "User is deleted");
	}

	const otpKey = `register-customer-otp:${email}`;
	const redisOtp = await redisClient.get(otpKey);

	if (!redisOtp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP has expired or is invalid");
	}

	if (redisOtp !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP did not match");
	}
	const customerRegistrationKey = `customer-registration-data:${email}`;
	const customerRegistrationStringifiedData = await redisClient.get(
		customerRegistrationKey,
	);

	if (!customerRegistrationStringifiedData) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Customer registration data not found",
		);
	}

	const customerRegistrationData: IRegisterCustomerPayload = JSON.parse(
		customerRegistrationStringifiedData,
	);

	const createdUser = await prisma.users.create({
		data: {
			name: customerRegistrationData.name,
			email: customerRegistrationData.email,
			password: customerRegistrationData.password,
			role: Role.CUSTOMER,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			customers: {
				create: {
					name: customerRegistrationData.name,
					email: customerRegistrationData.email,
					contactNumber:
						customerRegistrationData.customer?.contactNumber || null,
					thana: customerRegistrationData.customer?.thana || null,
					district: customerRegistrationData.customer?.district || null,
					division: customerRegistrationData.customer?.division || null,
					address: customerRegistrationData.customer?.address || null,
				},
			},
		},
		omit: { password: true },
		include: { customers: true },
	});

	await sendEmail(
		"email-verified-success.ejs",
		{ name: createdUser.name, email: createdUser.email },
		{
			from: config.email_sender,
			to: createdUser.email,
			subject: "Email Verified Successfully",
		},
	);

	await redisClient.del(otpKey);
	await redisClient.del(customerRegistrationKey);

	const { customers, ...user } = createdUser;
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		user: user,
		customers,
		accessToken,
		refreshToken,
	};
};

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.users.findUnique({
		where: { email },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.GONE, "User is deleted");
	}
	console.log(user, "user");

	if (user.password === null && user.googleId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"User already registered with Google. Please login with Google.",
		);
	}

	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password as string,
	);

	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.users.findUnique({
		where: { id: data.userId },
	});

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User is inactive or not found",
		);
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};
const forgotPassword = async (payload: IForgotPasswordPayload) => {
	const { email } = payload;

	const isUserExists = await prisma.users.findUnique({
		where: { email },
	});

	if (!isUserExists) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"User with this email does not exist",
		);
	}

	if (isUserExists.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (isUserExists.isDeleted || isUserExists.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.GONE, "User is deleted");
	}
	if (!isUserExists.emailVerified) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"User email is not verified. Please verify your email first!",
		);
	}

	if (isUserExists.googleId && isUserExists.authProvider === "GOOGLE") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"User is registered with Google. Please login with Google.",
		);
	}

	//after all check crate otp by crypto
	const otp = crypto.randomInt(100000, 1000000).toString(); // Generate a 6-digit OTP

	// then create key for redis
	const key = `forgot-password-otp:${email}`;
	// expiration time for otp is 5 minutes
	const expirationSeconds = 5 * 60;

	await redisClient.set(key, otp, {
		expiration: {
			type: "EX",
			value: expirationSeconds,
		},
	});

	const templateData = {
		name: isUserExists.name,
		email: isUserExists.email,
		otp,
		expirationMinutes: expirationSeconds / 60,
	};

	await sendEmail("forgot-password.ejs", templateData, {
		from: config.email_sender,
		to: isUserExists.email,
		subject: "Forgot Password OTP",
	});
};
const resetPassword = async (payload: IResetPasswordPayload) => {
	const { email, otp, newPassword } = payload;

	const isUserExists = await prisma.users.findUnique({
		where: { email },
	});

	if (!isUserExists) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"User with this email does not exist",
		);
	}

	if (isUserExists.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (isUserExists.isDeleted || isUserExists.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.GONE, "User is deleted");
	}
	if (!isUserExists.emailVerified) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"User email is not verified. Please verify your email first!",
		);
	}

	if (isUserExists.googleId && isUserExists.authProvider === "GOOGLE") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"User is registered with Google. Please login with Google.",
		);
	}
	const key = `forgot-password-otp:${isUserExists.email}`;
	const redisOtp = await redisClient.get(key);

	if (!redisOtp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP has expired or is invalid");
	}

	if (redisOtp !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP did not match");
	}

	const hashedPassword = await bcrypt.hash(
		newPassword,
		Number(config.bcrypt_salt_rounds),
	);

	await prisma.users.update({
		where: {
			email: isUserExists.email,
		},
		data: {
			password: hashedPassword,
		},
	});

	await redisClient.del(key);

	const templateData = {
		name: isUserExists.name,
		email: isUserExists.email,
	};

	await sendEmail("reset-password-success.ejs", templateData, {
		from: config.email_sender,
		to: isUserExists.email,
		subject: "Password Reset Successful",
	});
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googleIdTokenPayload: TokenPayload | null | undefined = null;
	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});
		googleIdTokenPayload = ticket.getPayload();
	} catch (error) {
		console.log("google id token verification failed");
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Google ID token");
	}

	if (!googleIdTokenPayload) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Failed to retrieve Google ID token payload",
		);
	}
	if (!googleIdTokenPayload.email) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Google ID token payload does not contain an email",
		);
	}
	if (!googleIdTokenPayload.name) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Google ID token payload does not contain an name",
		);
	}

	const isCustomerExistsWithGoogleAuth = await prisma.users.findUnique({
		where: {
			email: googleIdTokenPayload.email,
			role: Role.CUSTOMER,
			googleId: googleIdTokenPayload.sub,
		},
	});

	let user = isCustomerExistsWithGoogleAuth;

	if (!isCustomerExistsWithGoogleAuth) {
		const isCustomerWithCredentialsExists = await prisma.users.findUnique({
			where: {
				email: googleIdTokenPayload.email,
				role: Role.CUSTOMER,
			},
		});

		if (isCustomerWithCredentialsExists) {
			if (isCustomerWithCredentialsExists?.status === UserStatus.BLOCKED) {
				throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
			}
			if (!isCustomerWithCredentialsExists?.emailVerified) {
				throw new AppError(
					httpStatus.FORBIDDEN,
					"User email is not verified. Please verify your email first!",
				);
			}

			if (
				isCustomerWithCredentialsExists.isDeleted ||
				isCustomerWithCredentialsExists.status === UserStatus.DELETED
			) {
				throw new AppError(httpStatus.GONE, "User is deleted");
			}

			user = await prisma.users.update({
				where: {
					email: googleIdTokenPayload.email,
					role: Role.CUSTOMER,
				},
				data: {
					googleId: googleIdTokenPayload.sub,
				},
			});
		} else {
			user = await prisma.users.create({
				data: {
					email: googleIdTokenPayload.email,
					name: googleIdTokenPayload.name,
					googleId: googleIdTokenPayload.sub,
					authProvider: AuthProvider.GOOGLE,
					role: Role.CUSTOMER,
					status: UserStatus.ACTIVE,
					emailVerified: true,
					Customer: {
						create: {
							email: googleIdTokenPayload.email,
							name: googleIdTokenPayload.name,
						},
					},
				},
			});

			await sendEmail(
				"googl-register-success.ejs",
				{ name: googleIdTokenPayload.name, email: googleIdTokenPayload.email },
				{
					from: config.email_sender,
					to: googleIdTokenPayload.email,
					subject: "Google Registration Successful",
				},
			);
		}
	}
	if (!user) {
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Failed to create or update user with Google authentication",
		);
	}

	if (user?.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.GONE, "User is deleted");
	}
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

export const AuthServices = {
	registerCustomer,
	verifyUserEmail,
	loginUser,
	refreshToken,
	forgotPassword,
	resetPassword,
	googleLogin,
};
