import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuthServices } from "./auth.services";
import config from "../../config";
import { IRequestUser } from "./auth.interface";

const cookieOptions = {
  httpOnly: true,
  secure: config.node_env === "development" ? false : true,
  sameSite: (config.node_env === "development" ? "lax" : "none") as
    | "lax"
    | "none",
};

const registerCustomer = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  await AuthServices.registerCustomer(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Verification email sent to your email address successfully",
    data: null,
  });
});
const verifyUserEmail = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const result = await AuthServices.verifyUserEmail(payload);

  const { accessToken, refreshToken, user, customers } = result;
  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24, // 24 hour or 1 day
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    sameSite: config.node_env === "development" ? "lax" : "none",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Email verified successfully",
    data: { accessToken, refreshToken, user, customers },
  });
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const result = await AuthServices.loginUser(payload);
  const { accessToken, refreshToken } = result;

  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24, // 24 hour or 1 day
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged in successfully",
    data: {
      accessToken,
      refreshToken,
    },
  });
});

const logoutUser = catchAsync(async (req: Request, res: Response) => {
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out successfully",
    data: null,
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as unknown as IRequestUser;

  if (!user) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "User information is missing in the request",
    );
  }

  const result = await AuthServices.getMe(user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile fetched successfully",
    data: result,
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  if (!req.cookies.refreshToken) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Refresh token is missing");
  }
  const result = await AuthServices.refreshToken(req.cookies.refreshToken);
  const { accessToken, refreshToken: newRefreshToken } = result;

  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24, // 24 hour or 1 day
  });
  res.cookie("refreshToken", newRefreshToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "New tokens generated successfully",
    data: {
      accessToken,
      refreshToken: newRefreshToken,
    },
  });
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
  const googleToken = req.body;
  const result = await AuthServices.googleLogin(googleToken);
  const { accessToken, refreshToken } = result;

  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24, // 24 hour or 1 day
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged in successfully",
    data: {
      accessToken,
      refreshToken,
    },
  });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  await AuthServices.forgotPassword(payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP sent to your email successfully",
    data: null,
  });
});
const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  await AuthServices.resetPassword(payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset successfully",
    data: null,
  });
});

export const AuthController = {
  registerCustomer,
  verifyUserEmail,
  loginUser,
  getMe,
  logoutUser,
  refreshToken,
  googleLogin,
  forgotPassword,
  resetPassword,
};
