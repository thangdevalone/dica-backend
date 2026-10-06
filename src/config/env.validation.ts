import Joi from "joi";
export const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  PORT: Joi.number().port().default(3000),
  LOG_LEVEL: Joi.string()
    .valid("fatal", "error", "warn", "info", "debug", "trace", "silent")
    .default("info"),
  DATABASE_URL: Joi.string().required(),
  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .invalid("replace-with-at-least-32-random-characters")
    .required(),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .invalid("replace-with-another-at-least-32-random-characters")
    .required(),
  JWT_ACCESS_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default("15m"),
  JWT_REFRESH_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default("7d"),
  CORS_ORIGINS: Joi.string().default("http://localhost:3001"),
  HTTP_BODY_LIMIT: Joi.string()
    .pattern(/^\d+(kb|mb)$/i)
    .default("10mb"),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(5).default(0),
  SWAGGER_ENABLED: Joi.boolean().default(false),
  DB_POOL_MAX: Joi.number().integer().min(2).max(100).default(20),
  DB_CONNECTION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1_000)
    .max(60_000)
    .default(5_000),
  DB_IDLE_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1_000)
    .max(300_000)
    .default(30_000),
  DB_TRANSACTION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1_000)
    .max(120_000)
    .default(15_000),
  DB_STATEMENT_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1_000)
    .max(300_000)
    .default(30_000),
  DB_LOCK_TIMEOUT_MS: Joi.number()
    .integer()
    .min(100)
    .max(60_000)
    .default(5_000),
  DB_IDLE_TRANSACTION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1_000)
    .max(300_000)
    .default(30_000),
  DEMO_POLICY_ENABLED: Joi.boolean().default(false),
  FCM_ENABLED: Joi.boolean().default(false),
  FCM_PROJECT_ID: Joi.string().trim().allow("").default(""),
  FCM_CLIENT_EMAIL: Joi.string().trim().allow("").default(""),
  FCM_PRIVATE_KEY: Joi.string().allow("").default(""),
  FCM_ANDROID_CHANNEL_ID: Joi.string()
    .trim()
    .max(100)
    .default("dica_operations"),
}).custom((environment: Record<string, unknown>, helpers) => {
  if (environment["JWT_ACCESS_SECRET"] === environment["JWT_REFRESH_SECRET"])
    return helpers.error("any.custom", {
      message: "JWT access secret và refresh secret phải khác nhau.",
    });
  if (
    environment["FCM_ENABLED"] === true &&
    (!environment["FCM_PROJECT_ID"] ||
      !environment["FCM_CLIENT_EMAIL"] ||
      !environment["FCM_PRIVATE_KEY"])
  )
    return helpers.error("any.custom", {
      message:
        "FCM_PROJECT_ID, FCM_CLIENT_EMAIL and FCM_PRIVATE_KEY are required when FCM_ENABLED=true.",
    });
  return environment;
});
