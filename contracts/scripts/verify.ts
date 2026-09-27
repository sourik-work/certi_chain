/**
 * @file verify.ts
 * @description Script to verify deployed smart contract bytecode and source code on Etherscan/Blockscout.
 * 
 * Usage:
 * CONTRACT_ADDRESS=0x... INITIAL_OWNER=0x... npx hardhat run scripts/verify.ts --network sepolia
 */

import { run } from "hardhat";

async function main() {
  // Step 1: Extract environment variables for contract address and constructor arguments
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const initialOwner = process.env.INITIAL_OWNER;

  if (!contractAddress) {
    throw new Error("Please set CONTRACT_ADDRESS in environment or command line");
  }
  if (!initialOwner) {
    throw new Error("Please set INITIAL_OWNER in environment or command line");
  }

  console.log(`Verifying CertificateRegistry at ${contractAddress} with initialOwner ${initialOwner}...`);

  try {
    // Step 2: Trigger Hardhat Etherscan plugin with matching constructor arguments
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [initialOwner],
    });
    console.log("Contract verified successfully on Etherscan!");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Already Verified")) {
      console.log("Contract is already verified!");
    } else {
      console.error("Verification failed:", error);
    }
  }
}

// Execute verification and catch unhandled rejections
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

