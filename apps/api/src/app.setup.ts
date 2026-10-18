import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppConfig } from "./core/config/app-config.js";
import { HttpExceptionFilter } from "./core/errors/http-exception.filter.js";

/** Application-wide setup, kept separate from main.ts so it can be reused. */
export function setupApp(app: INestApplication): void {
  const config = app.get(AppConfig);
  app.setGlobalPrefix("v1");
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({ origin: config.corsOrigins });
  app.enableShutdownHooks();
}

export function setupDocs(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Algomind API")
      .setDescription("Authentication, levels, campaign, and publishing.")
      .setVersion("0.0.1")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("docs", app, document);
}
