import dns from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 5;
const DEFAULT_MAX_BYTES = 1_000_000;
const DEFAULT_TIMEOUT_MS = 20_000;

export interface SafeFetchResult {
  url: string;
  status: number;
  contentType: string;
  body: string;
  truncated: boolean;
}

export function validateBrowserUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Blocked URL protocol: ${url.protocol}`);
  }

  if (url.username || url.password) {
    throw new Error("Credential-bearing URLs are blocked");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0"
  ) {
    throw new Error(`Blocked local/private hostname: ${url.hostname}`);
  }

  if (net.isIP(host) && isPrivateAddress(host)) {
    throw new Error(`Blocked local/private address: ${host}`);
  }

  return url;
}

export async function safeBrowserFetch(
  input: string,
  options: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<SafeFetchResult> {
  const maxBytes = Math.max(1, options.maxBytes ?? DEFAULT_MAX_BYTES);
  const timeoutMs = Math.max(1000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let current = validateBrowserUrl(input);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    await assertPublicHost(current.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "Automaton-SafeBrowser/1.0",
          Accept: "text/html,text/plain,application/json,application/xml;q=0.9,*/*;q=0.1",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error(`Redirect ${response.status} missing Location header`);
        }
        if (redirect === MAX_REDIRECTS) {
          throw new Error("Too many redirects");
        }
        current = validateBrowserUrl(new URL(location, current).toString());
        continue;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!isTextualContentType(contentType)) {
        throw new Error(
          `Blocked non-text response type: ${contentType || "unknown"}`,
        );
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      const truncated = bytes.byteLength > maxBytes;
      const body = new TextDecoder("utf-8", { fatal: false }).decode(
        bytes.subarray(0, maxBytes),
      );

      return {
        url: current.toString(),
        status: response.status,
        contentType,
        body,
        truncated,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Unable to fetch URL");
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new Error(`Blocked local/private address: ${host}`);
    }
    return;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`DNS lookup failed for ${host}: ${message}`);
  }

  if (addresses.length === 0) {
    throw new Error(`DNS lookup returned no addresses for ${host}`);
  }

  for (const entry of addresses) {
    if (isPrivateAddress(entry.address)) {
      throw new Error(
        `Blocked hostname resolving to local/private address: ${host} -> ${entry.address}`,
      );
    }
  }
}

function isTextualContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return (
    normalized.startsWith("text/") ||
    normalized.includes("application/json") ||
    normalized.includes("application/xml") ||
    normalized.includes("application/xhtml+xml") ||
    normalized.includes("application/rss+xml") ||
    normalized.includes("application/atom+xml") ||
    normalized === ""
  );
}

function isPrivateAddress(address: string): boolean {
  if (address.includes(":")) {
    const value = address.toLowerCase();
    return (
      value === "::" ||
      value === "::1" ||
      value.startsWith("fe80:") ||
      value.startsWith("fc") ||
      value.startsWith("fd")
    );
  }

  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}
