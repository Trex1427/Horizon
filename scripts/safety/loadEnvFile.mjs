import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseLine(line = "") {
  const trimmed = String(line).trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const rawValue = trimmed.slice(separatorIndex + 1).trim();
  const unquoted = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");

  if (!key) {
    return null;
  }

  return { key, value: unquoted };
}

export function loadEnvFile(relativePath = ".env") {
  const filePath = resolve(process.cwd(), relativePath);
  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) {
      continue;
    }

    if (typeof process.env[parsed.key] === "undefined") {
      process.env[parsed.key] = parsed.value;
    }
  }

  return filePath;
}
