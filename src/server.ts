import app from "./app";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";
import {
  seedSupperAdmin,
  seedTesterAdmin,
  seedTesterCustomer,
  seedTesterMerchant,
  seedTesterRider,
} from "./app/utils/seed";

const PORT = config.port;

const main = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to the database successfully.");

    await redisClient.connect();
    console.log("Connected to Redis successfully.");

    console.log("SMTP transporter is ready to send emails.");

    await seedSupperAdmin();
    await seedTesterAdmin();
    await seedTesterMerchant();
    await seedTesterRider();
    await seedTesterCustomer();

    // cron jobs
    // await deleteUnverifiedDoctors();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error starting the server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

main();
