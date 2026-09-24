import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import crypto from "crypto";

const localIpfsStore = new Map<string, any>();

function devIpfsPlugin(jwtToken?: string): Plugin {
  return {
    name: "dev-ipfs-proxy",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/api/pinJson" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const jsonContent = JSON.parse(body);
              const pinataJwt = jwtToken || process.env.PINATA_JWT;

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
                        name: `certichain-${jsonContent.certificateTitle || "credential"}-${Date.now()}`,
                      },
                    }),
                    signal: controller.signal,
                  });
                  clearTimeout(timeoutId);

                  if (pinataRes.ok) {
                    const data = await pinataRes.json();
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(data));
                    return;
                  } else {
                    console.warn(`Pinata responded with status ${pinataRes.status}, falling back to local store.`);
                  }
                } catch (pinErr) {
                  console.warn("Pinata upload attempt failed or timed out, falling back to local simulation:", pinErr);
                }
              }

              // Local dev simulation fallback: generate deterministic Qm hash and store in memory
              const hash = crypto.createHash("sha256").update(JSON.stringify(jsonContent)).digest("hex");
              const simulatedCid = `Qm${hash.slice(0, 44)}`;
              localIpfsStore.set(simulatedCid, jsonContent);

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

        // Mock gateway resolution in dev for simulated CIDs
        if (req.url?.startsWith("/ipfs/") || req.url?.includes("/ipfs/Qm")) {
          const cid = req.url.split("/ipfs/")[1]?.split("?")[0];
          if (cid && localIpfsStore.has(cid)) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(localIpfsStore.get(cid)));
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const jwt = env.PINATA_JWT || process.env.PINATA_JWT;

  return {
    plugins: [react(), devIpfsPlugin(jwt)],
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

