/**
 * @file authorize-issuer.ts
 * @description Admin helper script to authorize a secondary Ethereum address as a verified Certificate Issuer.
 * 
 * Usage:
 * - Localhost: npx hardhat run scripts/authorize-issuer.ts --network localhost <ISSUER_ADDRESS>
 * - Sepolia:   npx hardhat run scripts/authorize-issuer.ts --network sepolia <ISSUER_ADDRESS>
 */

import { ethers } from "hardhat";

async function main() {
  // Step 1: Read target issuer address from environment variable or command-line arguments
  const targetIssuer = process.env.ISSUER_ADDRESS || process.argv[2];

  // Validate that the provided string is a valid Ethereum checksummed or unchecksummed address
  if (!targetIssuer || !ethers.isAddress(targetIssuer)) {
    console.error("Please provide a valid Ethereum address to authorize.");
    console.error("Usage: ISSUER_ADDRESS=0x... npx hardhat run scripts/authorize-issuer.ts --network localhost");
    process.exit(1);
  }

  // Step 2: Retrieve the contract owner signer (must match the owner() of the CertificateRegistry)
  const [owner] = await ethers.getSigners();
  console.log(`Connecting as Owner: ${owner.address}`);

  // Step 3: Resolve the target CertificateRegistry address
  const registryAddress = process.env.VITE_REGISTRY_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const registry = await ethers.getContractAt("CertificateRegistry", registryAddress, owner);

  // Step 4: Check if the address is already authorized to avoid redundant gas costs
  const alreadyAuth = await registry.isIssuerAuthorized(targetIssuer);
  if (alreadyAuth) {
    console.log(`Address ${targetIssuer} is ALREADY an authorized issuer.`);
    return;
  }

  // Step 5: Submit the `addIssuer` transaction signed by the owner
  console.log(`Authorizing address: ${targetIssuer}...`);
  const tx = await registry.addIssuer(targetIssuer);
  
  // Step 6: Wait for block inclusion
  await tx.wait();

  console.log(`Successfully authorized ${targetIssuer} as an issuer!`);
}

// Handle top-level execution errors
main().catch((err) => {
  console.error("Failed to authorize issuer:", err);
  process.exit(1);
});

