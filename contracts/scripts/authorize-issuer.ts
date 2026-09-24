import { ethers } from "hardhat";

async function main() {
  const targetIssuer = process.env.ISSUER_ADDRESS || process.argv[2];

  if (!targetIssuer || !ethers.isAddress(targetIssuer)) {
    console.error("Please provide a valid Ethereum address to authorize.");
    console.error("Usage: ISSUER_ADDRESS=0x... npx hardhat run scripts/authorize-issuer.ts --network localhost");
    process.exit(1);
  }

  const [owner] = await ethers.getSigners();
  console.log(`Connecting as Owner: ${owner.address}`);

  const registryAddress = process.env.VITE_REGISTRY_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const registry = await ethers.getContractAt("CertificateRegistry", registryAddress, owner);

  const alreadyAuth = await registry.isIssuerAuthorized(targetIssuer);
  if (alreadyAuth) {
    console.log(`Address ${targetIssuer} is ALREADY an authorized issuer.`);
    return;
  }

  console.log(`Authorizing address: ${targetIssuer}...`);
  const tx = await registry.addIssuer(targetIssuer);
  await tx.wait();

  console.log(`Successfully authorized ${targetIssuer} as an issuer!`);
}

main().catch((err) => {
  console.error("Failed to authorize issuer:", err);
  process.exit(1);
});
