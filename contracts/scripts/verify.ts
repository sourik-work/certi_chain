import { run } from "hardhat";

async function main() {
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
