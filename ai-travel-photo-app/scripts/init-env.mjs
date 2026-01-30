import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");
const examplePath = path.join(projectRoot, ".env.example");

function log(message) {
  process.stdout.write(`${message}\n`);
}

function warn(message) {
  process.stderr.write(`${message}\n`);
}

function hasCommand(command) {
  const check = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(check, [command], { stdio: "ignore" });
  return result.status === 0;
}

function askQuestion(rl, label, fallback) {
  const suffix = fallback !== undefined ? ` [${fallback}]` : "";
  return new Promise(resolve => {
    rl.question(`${label}${suffix}: `, answer => {
      const trimmed = answer.trim();
      resolve(trimmed.length > 0 ? trimmed : fallback ?? "");
    });
  });
}

function buildDatabaseUrl({ host, port, user, password, database }) {
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const auth = password ? `${encodedUser}:${encodedPassword}` : encodedUser;
  return `mysql://${auth}@${host}:${port}/${database}`;
}

function replaceOrAppend(envContent, key, value) {
  const line = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(envContent)) {
    return envContent.replace(regex, line);
  }
  return `${envContent.trimEnd()}\n${line}\n`;
}

function tryCreateDatabase({ host, port, user, password, database }) {
  if (!hasCommand("mysql")) {
    warn("[init-env] mysql client not found, skip auto-create database.");
    return;
  }

  const args = ["-h", host, "-P", port, "-u", user];
  if (password) {
    args.push(`-p${password}`);
  }

  const createSql = `CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARSET utf8mb4;`;
  const result = spawnSync("mysql", [...args, "-e", createSql], { stdio: "inherit" });
  if (result.status !== 0) {
    warn("[init-env] Failed to create database. Please create it manually.");
  } else {
    log("[init-env] Database is ready.");
  }
}

async function main() {
  if (fs.existsSync(envPath)) {
    log("[init-env] .env already exists, skip.");
    return;
  }

  if (!fs.existsSync(examplePath)) {
    warn("[init-env] .env.example not found.");
    process.exit(1);
  }

  log("[init-env] .env not found. Creating a new one from .env.example.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const host = await askQuestion(rl, "MySQL host", "localhost");
    const port = await askQuestion(rl, "MySQL port", "3306");
    const user = await askQuestion(rl, "MySQL user", "root");
    const password = await askQuestion(rl, "MySQL password", "");
    const database = await askQuestion(rl, "MySQL database", "ai_travel");

    const databaseUrl = buildDatabaseUrl({
      host,
      port,
      user,
      password,
      database,
    });

    const jwtSecret = crypto.randomBytes(24).toString("hex");

    let envContent = fs.readFileSync(examplePath, "utf8");
    envContent = replaceOrAppend(envContent, "DATABASE_URL", databaseUrl);
    envContent = replaceOrAppend(envContent, "JWT_SECRET", jwtSecret);
    envContent = replaceOrAppend(envContent, "OWNER_OPEN_ID", "local-super-admin");

    fs.writeFileSync(envPath, envContent, "utf8");
    log(`[init-env] Wrote ${envPath}`);

    tryCreateDatabase({ host, port, user, password, database });
  } finally {
    rl.close();
  }
}

main().catch(error => {
  warn(`[init-env] Failed: ${error?.message || error}`);
  process.exit(1);
});
