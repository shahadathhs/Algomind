import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { ClientVersionsModule } from "../client-versions/client-versions.module.js";
import { AdminLevelsController } from "./admin-levels.controller.js";
import { LevelsService } from "./levels.service.js";

@Module({
  imports: [AuthModule, AuditModule, ClientVersionsModule],
  controllers: [AdminLevelsController],
  providers: [LevelsService],
  exports: [LevelsService],
})
export class LevelsModule {}
