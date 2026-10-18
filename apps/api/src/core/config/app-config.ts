import { type Env, loadEnv } from "./env.js";

/** Typed, validated configuration. Injected wherever settings are needed. */
export class AppConfig {
  readonly nodeEnv: Env["nodeEnv"];
  readonly port: number;
  readonly databaseUrl: string;
  readonly corsOrigins: string[];

  constructor(env: Env) {
    this.nodeEnv = env.nodeEnv;
    this.port = env.port;
    this.databaseUrl = env.databaseUrl;
    this.corsOrigins = env.corsOrigins;
  }

  static fromEnvironment(): AppConfig {
    return new AppConfig(loadEnv());
  }
}
