import { Module } from "@nestjs/common";
import { ConfigModule } from "./core/config/config.module.js";
import { PrismaModule } from "./core/prisma/prisma.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthModule } from "./modules/health/health.module.js";

@Module({ imports: [ConfigModule, PrismaModule, HealthModule, AuthModule] })
export class AppModule {}
