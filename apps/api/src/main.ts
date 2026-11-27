import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/zod.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_URL || process.env.APP_URL || "http://localhost:3002",
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  const port = Number(process.env.PORT || process.env.API_PORT || 3001);
  await app.listen(port, "0.0.0.0");
  console.log(`API listening on http://0.0.0.0:${port}`);
}

bootstrap();
