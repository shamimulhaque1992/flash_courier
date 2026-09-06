import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type NextFunction,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/modules/auth/auth.route";
import { MerchantRoutes } from "./app/modules/merchants/merchants.route";
import { RiderRoutes } from "./app/modules/riders/riders.route";
import { ShipmentRoutes } from "./app/modules/shipments/shipments.route";

// import { UserRoutes } from "./app/module/user/user.route";

const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/merchants", MerchantRoutes);
app.use("/api/v1/riders", RiderRoutes);
app.use("/api/v1/shipments", ShipmentRoutes);

// Basic route
app.get("/", async (_req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to Flash Courier Backend",
	});
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
