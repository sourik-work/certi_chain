/**
 * @file deploy.ts
 * @description Hardhat deployment script for the CertiChain CertificateRegistry contract.
 * 
 * Workflow:
 * 1. Fetches the active deployer signer from Hardhat environment (Sepolia / Localhost).
 * 2. Checks and logs the deployer's ETH balance to ensure sufficient funds for gas.
 * 3. Deploys the `CertificateRegistry` smart contract, passing the deployer address as initial owner.
 * 4. Waits for block confirmations and retrieves the deployed contract address.
 * 5. Verifies initial ownership and authorization state.
 * 6. Automatically synchronizes the new address into `frontend/.env` (VITE_REGISTRY_ADDRESS).
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Step 1: Obtain deployer account signer configured in hardhat.config.ts
  const [deployer] = await ethers.getSigners();
  console.log("--------------------------------------------------");
  console.log("CertiChain Ledger — Contract Deployment");
  console.log(`Deploying contracts with account: ${deployer.address}`);

  // Step 2: Query deployer's balance to ensure sufficient ETH for gas fees
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);

  // Step 3: Get the compiled bytecode & ABI factory for CertificateRegistry
  const CertificateRegistryFactory = await ethers.getContractFactory("CertificateRegistry");
  
  // Step 4: Deploy the contract passing the deployer as initial owner to Ownable2Step constructor
  const registry = await CertificateRegistryFactory.deploy(deployer.address);

  // Step 5: Wait for the deployment transaction to be mined on-chain
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`CertificateRegistry successfully deployed to: ${address}`);

  // Step 6: Verify on-chain contract state (Owner and default issuer authorization)
  const owner = await registry.owner();
  const isAuth = await registry.isIssuerAuthorized(deployer.address);
  console.log(`Contract Owner: ${owner}`);
  console.log(`Deployer isAuthorizedIssuer: ${isAuth}`);

  // Step 7: Automatically update frontend/.env with the deployed contract address
  const frontendEnvPath = path.resolve(__dirname, "../../frontend/.env");
  if (fs.existsSync(frontendEnvPath)) {
    let content = fs.readFileSync(frontendEnvPath, "utf-8");
    if (content.includes("VITE_REGISTRY_ADDRESS=")) {
      content = content.replace(/VITE_REGISTRY_ADDRESS=.*/, `VITE_REGISTRY_ADDRESS=${address}`);
    } else {
      content += `\nVITE_REGISTRY_ADDRESS=${address}\n`;
    }
    fs.writeFileSync(frontendEnvPath, content);
    console.log(`Updated ${frontendEnvPath} with VITE_REGISTRY_ADDRESS=${address}`);
  }

  console.log("--------------------------------------------------");
}

// Execute deployment and handle any unexpected execution errors
main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});

