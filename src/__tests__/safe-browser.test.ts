import { describe, expect, it } from "vitest";
import { validateBrowserUrl } from "../browser/safe-fetch.js";

describe("safe browser URL validation", () => {
  it("accepts public http/https URLs", () => {
    expect(validateBrowserUrl("https://example.com/path").hostname).toBe("example.com");
    expect(validateBrowserUrl("http://example.org").protocol).toBe("http:");
  });

  it("blocks local and private destinations", () => {
    expect(() => validateBrowserUrl("http://localhost:3000")).toThrow();
    expect(() => validateBrowserUrl("http://127.0.0.1")).toThrow();
    expect(() => validateBrowserUrl("http://10.0.0.5")).toThrow();
    expect(() => validateBrowserUrl("http://192.168.1.10")).toThrow();
    expect(() => validateBrowserUrl("http://172.16.4.2")).toThrow();
    expect(() => validateBrowserUrl("http://[::1]")).toThrow();
  });

  it("blocks non-web protocols and embedded credentials", () => {
    expect(() => validateBrowserUrl("file:///etc/passwd")).toThrow();
    expect(() => validateBrowserUrl("ftp://example.com/file")).toThrow();
    expect(() => validateBrowserUrl("https://user:pass@example.com")).toThrow();
  });
});
