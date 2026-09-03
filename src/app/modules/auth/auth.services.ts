import { prisma } from "../../lib/prisma";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";
import bcrypt from "bcryptjs";
import { sendEmail } from "../../utils/sendEmail";
import config from "../../config";

const registerCustomer = async (payload: any) => {
  const { name, email, password, customerData } = payload;

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
    customer: customerData,
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

export const AuthServices = {};
