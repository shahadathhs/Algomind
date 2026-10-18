import { Module } from "@nestjs/common";
import { ConfigModule } from "./core/config/config.module.js";
import { PrismaModule } from "./core/prisma/prisma.module.js";
import { HealthModule } from "./modules/health/health.module.js";

@Module({ imports: [ConfigModule, PrismaModule, HealthModule] })
export class AppModule {}
