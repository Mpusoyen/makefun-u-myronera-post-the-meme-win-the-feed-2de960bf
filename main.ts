// Entry for u-myronera-post-the-meme-win-the-feed-2de960bf.
// The entry itself is a public post on X. This program's whole job is to
// take POST.json from the bot directory, make sure it really names an X
// status post, and copy it untouched into the output directory, where
// the gate picks it up.

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const botDir = process.env.MAKEFUN_BOT_DIR ?? "/bot";
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const postPath = join(botDir, "POST.json");

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

if (!existsSync(postPath)) {
  fail(`POST.json is missing from the bot directory (${postPath})`);
}

let parsedJson: unknown;
try {
  parsedJson = JSON.parse(readFileSync(postPath, "utf8"));
} catch {
  fail(`POST.json is not valid JSON (${postPath})`);
}

const urlField = (parsedJson as { url?: unknown } | null)?.url;
if (typeof urlField !== "string" || urlField.trim() === "") {
  fail('POST.json must hold a non-empty string in its "url" field');
}

let address: URL;
try {
  address = new URL(urlField);
} catch {
  fail(`the url in POST.json does not parse: ${urlField}`);
}

if (address.protocol !== "https:" && address.protocol !== "http:") {
  fail(`the post url must be http(s), not ${address.protocol}`);
}

const allowedHosts = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);
if (!allowedHosts.has(address.hostname.toLowerCase())) {
  fail(`the post url must sit on x.com or twitter.com, not ${address.hostname}`);
}

// The path of a post address is /<handle>/status/<id>: three segments,
// the middle one literally "status", the last one digits and digits only.
const segments = address.pathname.split("/").filter((part) => part !== "");
if (segments.length !== 3 || segments[1] !== "status") {
  fail(`the post url path must be /<handle>/status/<id>, not ${address.pathname}`);
}
if (!/^[0-9]+$/.test(segments[2])) {
  fail(`the status id must be all digits, not "${segments[2]}"`);
}

mkdirSync(outputDir, { recursive: true });
const targetPath = join(outputDir, "POST.json");
copyFileSync(postPath, targetPath);

// Read the copy back and hold it against the original: the gate trusts
// whatever lands in the output directory, so a copy that differs from
// the repository's POST.json must fail loudly instead of passing silently.
if (readFileSync(targetPath, "utf8") !== readFileSync(postPath, "utf8")) {
  fail("the copied POST.json differs from the one in the bot directory");
}
