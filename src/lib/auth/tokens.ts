import { createHash, randomBytes } from "node:crypto";

/** 256 random bits, URL-safe. */
export const randomToken = () => randomBytes(32).toString("base64url");

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
