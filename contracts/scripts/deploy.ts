import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("--------------------------------------------------");
  console.log("CertiChain Ledger — Contract Deployment");
  console.log(`Deploying contracts with account: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);

  const CertificateRegistryFactory = await ethers.getContractFactory("CertificateRegistry");
  const registry = await CertificateRegistryFactory.deploy(deployer.address);

  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`CertificateRegistry successfully deployed to: ${address}`);

  // Check and display owner/auth status
  const owner = await registry.owner();
  const isAuth = await registry.isIssuerAuthorized(deployer.address);
  console.log(`Contract Owner: ${owner}`);
  console.log(`Deployer isAuthorizedIssuer: ${isAuth}`);

  // Optionally update frontend .env file with new registry address
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
