import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const localIpfsStore = new Map<string, any>();
const DEV_IPFS_DIR = path.resolve(process.cwd(), ".devipfs");
if (!fs.existsSync(DEV_IPFS_DIR)) {
  try {
    fs.mkdirSync(DEV_IPFS_DIR, { recursive: true });
  } catch {}
}

function devIpfsPlugin(envVars: Record<string, string>): Plugin {
  return {
    name: "dev-ipfs-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Dev proxy for /api/pinFile (binary pinning & diagnostics)
        if (req.url?.startsWith("/api/pinFile")) {
          if (req.method === "GET") {
            const pinataJwt = envVars.PINATA_JWT || process.env.PINATA_JWT;
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                status: "ok",
                diagnostics: {
                  hasPinataJwt: Boolean(pinataJwt && pinataJwt.trim()),
                  hasSessionSecret: Boolean(envVars.SESSION_SECRET || process.env.SESSION_SECRET),
                  hasRpcUrl: Boolean(envVars.SEPOLIA_RPC_URL || process.env.SEPOLIA_RPC_URL),
                  maxSizeBytes: 4.5 * 1024 * 1024,
                },
              })
            );
            return;
          }

          if (req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => {
              body += chunk;
            });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body);
                const { fileBase64, fileName = "template-file", mimeType = "image/png", expectedHash } = parsed;
                const pinataJwt = envVars.PINATA_JWT || process.env.PINATA_JWT;

                const base64Data = (fileBase64 || "").replace(/^data:[^;]+;base64,/, "");
                const buffer = Buffer.from(base64Data, "base64");

                if (buffer.length > 4.5 * 1024 * 1024) {
                  res.writeHead(413, { "Content-Type": "application/json" });
                  res.end(
                    JSON.stringify({
                      error: "File size exceeds 4.5 MB serverless limit.",
                      code: "PIN_PAYLOAD_TOO_LARGE",
                    })
                  );
                  return;
                }

                const computedHash = `0x${crypto.createHash("sha256").update(buffer).digest("hex")}`;

                if (pinataJwt && pinataJwt.trim()) {
                  try {
                    const formData = new FormData();
                    const blob = new Blob([buffer], { type: mimeType });
                    formData.append("file", blob, fileName);
                    formData.append(
                      "pinataMetadata",
                      JSON.stringify({ name: `certichain-template-${fileName}-${Date.now()}` })
                    );

                    const controller = new AbortController();
                    const tid = setTimeout(() => controller.abort(), 10000);
                    const pinRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${pinataJwt.trim()}` },
                      body: formData,
                      signal: controller.signal,
                    });
                    clearTimeout(tid);

                    if (pinRes.ok) {
                      const data = await pinRes.json();
                      const ipfsHash = data.IpfsHash || data.ipfsHash;
                      localIpfsStore.set(ipfsHash, buffer);
                      try {
                        fs.writeFileSync(path.join(DEV_IPFS_DIR, `${ipfsHash}.bin`), buffer);
                      } catch {}

                      res.writeHead(200, { "Content-Type": "application/json" });
                      res.end(JSON.stringify({ ...data, sha256: computedHash }));
                      return;
                    }
                  } catch (pErr) {
                    console.warn("[vite-dev] Pinata pinFile failed, falling back to simulated CID:", pErr);
                  }
                }

                // Deterministic local simulation CID
                const simulatedCid = `QmSim${computedHash.slice(2, 42)}`;
                localIpfsStore.set(simulatedCid, buffer);
                try {
                  fs.writeFileSync(path.join(DEV_IPFS_DIR, `${simulatedCid}.bin`), buffer);
                } catch {}

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    IpfsHash: simulatedCid,
                    PinSize: buffer.length,
                    Timestamp: new Date().toISOString(),
                    sha256: computedHash,
                  })
                );
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Error processing pinFile request";
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: msg, code: "PIN_UPSTREAM_FAILED" }));
              }
            });
            return;
          }
        }

        // Dev proxy for /api/pinJson and /api/pinJson-dev
        if ((req.url === "/api/pinJson" || req.url === "/api/pinJson-dev") && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const jsonContent = JSON.parse(body);
              const pinataJwt = envVars.PINATA_JWT || process.env.PINATA_JWT;

              if (pinataJwt && pinataJwt.trim()) {
                try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 8000);

                  const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${pinataJwt.trim()}`,
                    },
                    body: JSON.stringify({
                      pinataContent: jsonContent,
                      pinataMetadata: {
                        name: `certichain-${jsonContent.certificateTitle || jsonContent.name || "credential"}-${Date.now()}`,
                      },
                    }),
                    signal: controller.signal,
                  });
                  clearTimeout(timeoutId);

                  if (pinataRes.ok) {
                    const data = await pinataRes.json();
                    const ipfsHash = data.IpfsHash || data.ipfsHash;
                    // Also mirror to local dev store for offline resilience
                    localIpfsStore.set(ipfsHash, jsonContent);
                    try {
                      fs.writeFileSync(path.join(DEV_IPFS_DIR, `${ipfsHash}.json`), JSON.stringify(jsonContent));
                    } catch {}

                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(data));
                    return;
                  }
                } catch (pinErr) {
                  console.warn("Pinata upload attempt failed or timed out, falling back to local simulation:", pinErr);
                }
              }

              // Local dev simulation fallback: generate deterministic Qm hash based on content sha256
              const hash = crypto.createHash("sha256").update(JSON.stringify(jsonContent)).digest("hex");
              const simulatedCid = `Qm${hash.slice(0, 44)}`;
              localIpfsStore.set(simulatedCid, jsonContent);
              try {
                fs.writeFileSync(path.join(DEV_IPFS_DIR, `${simulatedCid}.json`), JSON.stringify(jsonContent));
              } catch {}

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  IpfsHash: simulatedCid,
                  PinSize: Buffer.byteLength(body),
                  Timestamp: new Date().toISOString(),
                })
              );
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Error parsing request";
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: msg }));
            }
          });
          return;
        }

        // Dev handler for /api/analyzeTemplate
        if (req.url === "/api/analyzeTemplate" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const parsedBody = JSON.parse(body);
              const { imageDataUrl, width, height } = parsedBody;

              const geminiKey = envVars.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
              const anthropicKey = envVars.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
              const provider = envVars.TEMPLATE_AI_PROVIDER || process.env.TEMPLATE_AI_PROVIDER || "gemini";

              if (provider === "gemini" && geminiKey) {
                const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                  const mimeType = match[1];
                  const base64Data = match[2];

                  const VISION_PROMPT = `You are analysing a certificate image to turn it into a reusable template. Transcribe every piece of TEXT you can see. For each text block return: bbox as normalised [x0,y0,x1,y1] in 0..1 of the image; the exact text; guessed font family (sans/serif/mono + closest common Google font name); weight (300-800); approximate font size as a fraction of image height; colour hex; alignment; and 'role': 'fixed' if the text would be identical on every certificate issued by this organisation (institution names, headings like CERTIFICATE, signatory names, fixed labels) or 'variable' if it is specific to one recipient or event (recipient name, certificate number, course or event name, dates, grade, role verb, certificate type like 'OF PARTICIPATION'). For paragraphs that mix fixed and variable parts, return the text with variable parts wrapped as {{snake_case_key}} and list each key with a human label, a type (text|date|number|textarea|select) and the original sample value. Do not invent text. Do not include logos, seals or signatures as text. Return JSON matching the provided schema and nothing else.`;

                  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
                  const payload = {
                    contents: [
                      {
                        parts: [
                          { text: VISION_PROMPT },
                          { inlineData: { mimeType, data: base64Data } },
                        ],
                      },
                    ],
                    generationConfig: {
                      responseMimeType: "application/json",
                      temperature: 0.1,
                    },
                  };

                  const resp = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });

                  if (resp.ok) {
                    const result = await resp.json();
                    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                      const resJson = JSON.parse(text);
                      res.writeHead(200, { "Content-Type": "application/json" });
                      res.end(JSON.stringify({ engine: "vision", ...resJson, canvas: { width, height } }));
                      return;
                    }
                  }
                }
              }

              // Fallback to OCR / manual response
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Vision API not configured", fallbackToOcr: true }));
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Analyze failed";
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: msg, fallbackToOcr: true }));
            }
          });
          return;
        }

        // Dev handler for /api/figmaProxy
        if (req.url?.startsWith("/api/figmaProxy") && req.method === "GET") {
          try {
            const urlObj = new URL(req.url, "http://localhost:5173");
            const targetUrl = urlObj.searchParams.get("url");
            const figmaToken = req.headers["x-figma-token"] as string;

            if (!targetUrl || !figmaToken) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing url or x-figma-token header" }));
              return;
            }

            fetch(targetUrl, {
              headers: {
                "X-Figma-Token": figmaToken,
                "Content-Type": "application/json",
              },
            })
              .then(async (fRes) => {
                const data = await fRes.json();
                res.writeHead(fRes.status, { "Content-Type": "application/json" });
                res.end(JSON.stringify(data));
              })
              .catch((err) => {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: err.message || "Figma fetch failed" }));
              });
            return;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Figma proxy failed";
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: msg }));
            return;
          }
        }

        // Dev handler for /api/ipfs
        if (req.url?.startsWith("/api/ipfs") && req.method === "GET") {
          try {
            const urlObj = new URL(req.url, "http://localhost:5173");
            const cid = urlObj.searchParams.get("cid");
            if (!cid) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing CID parameter" }));
              return;
            }

            const cleanCid = cid
              .replace(/^https?:\/\/[^/]+\/ipfs\//, "")
              .replace("ipfs://", "")
              .replace(/^ipfs\//, "")
              .split("?")[0]
              .split("#")[0]
              .trim();

            if (localIpfsStore.has(cleanCid)) {
              const val = localIpfsStore.get(cleanCid);
              if (Buffer.isBuffer(val)) {
                res.writeHead(200, { "Content-Type": "image/png" });
                res.end(val);
              } else {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(val));
              }
              return;
            }

            // Check .devipfs on disk
            const binPath = path.join(DEV_IPFS_DIR, `${cleanCid}.bin`);
            if (fs.existsSync(binPath)) {
              const buf = fs.readFileSync(binPath);
              res.writeHead(200, { "Content-Type": "image/png" });
              res.end(buf);
              return;
            }

            const jsonPath = path.join(DEV_IPFS_DIR, `${cleanCid}.json`);
            if (fs.existsSync(jsonPath)) {
              const jsonBuf = fs.readFileSync(jsonPath);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(jsonBuf);
              return;
            }

            // Try upstream gateways
            const pinataJwt = envVars.PINATA_JWT || process.env.PINATA_JWT;
            const gateways = [
              `https://gateway.pinata.cloud/ipfs/${cleanCid}`,
              `https://cloudflare-ipfs.com/ipfs/${cleanCid}`,
              `https://ipfs.io/ipfs/${cleanCid}`,
              `https://dweb.link/ipfs/${cleanCid}`,
            ];

            (async () => {
              for (const gwUrl of gateways) {
                try {
                  const headers: Record<string, string> = {};
                  if (pinataJwt && gwUrl.includes("pinata")) {
                    headers["Authorization"] = `Bearer ${pinataJwt.trim()}`;
                  }
                  const ctrl = new AbortController();
                  const tid = setTimeout(() => ctrl.abort(), 4000);
                  const upstream = await fetch(gwUrl, { headers, signal: ctrl.signal });
                  clearTimeout(tid);
                  if (upstream.ok) {
                    const cType = upstream.headers.get("content-type") || "application/octet-stream";
                    const arrayBuf = await upstream.arrayBuffer();
                    const buf = Buffer.from(arrayBuf);
                    localIpfsStore.set(cleanCid, buf);
                    res.writeHead(200, { "Content-Type": cType });
                    res.end(buf);
                    return;
                  }
                } catch {}
              }
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: `CID ${cleanCid} not found across gateways.` }));
            })();
            return;
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "IPFS proxy failed";
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: msg }));
            return;
          }
        }

        // Mock gateway resolution in dev for simulated CIDs
        if (req.url?.startsWith("/ipfs/") || req.url?.includes("/ipfs/Qm")) {
          const cid = req.url.split("/ipfs/")[1]?.split("?")[0];
          if (cid) {
            if (localIpfsStore.has(cid)) {
              const val = localIpfsStore.get(cid);
              if (Buffer.isBuffer(val)) {
                res.writeHead(200, { "Content-Type": "image/png" });
                res.end(val);
              } else {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(val));
              }
              return;
            }
            const binPath = path.join(DEV_IPFS_DIR, `${cid}.bin`);
            if (fs.existsSync(binPath)) {
              res.writeHead(200, { "Content-Type": "image/png" });
              res.end(fs.readFileSync(binPath));
              return;
            }
            const jsonPath = path.join(DEV_IPFS_DIR, `${cid}.json`);
            if (fs.existsSync(jsonPath)) {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(fs.readFileSync(jsonPath));
              return;
            }
          }
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), devIpfsPlugin(env)],
    server: {
      port: 5173,
      host: true,
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
    },
  };
});
