import { Module } from "@nestjs/common";
import { ConfigModule } from "./core/config/config.module.js";
import { PrismaModule } from "./core/prisma/prisma.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { CampaignModule } from "./modules/campaign/campaign.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { ClientVersionsModule } from "./modules/client-versions/client-versions.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { LevelsModule } from "./modules/levels/levels.module.js";
import { SeedModule } from "./modules/seed/seed.module.js";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    AuditModule,
    ClientVersionsModule,
    LevelsModule,
    CampaignModule,
    CatalogModule,
    SeedModule,
  ],
})
export class AppModule {}
