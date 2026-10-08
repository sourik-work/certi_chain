import { ethers } from "hardhat";

async function main() {
  const txHash = process.env.TX_HASH || process.argv[2] || "0x1e31121a4242";
  console.log("==================================================");
  console.log(`CertiChain — Transaction & Contract Inspector`);
  console.log(`Network: ${ethers.provider._network?.name || "Sepolia"}`);
  console.log(`Target Tx Hash: ${txHash}`);
  console.log("==================================================");

  if (!txHash || txHash === "0x1e31121a4242") {
    console.log("Usage: npx hardhat run scripts/inspect-tx.ts --network sepolia <TX_HASH>");
    console.log("Or set TX_HASH=0x... in your environment.");
    return;
  }

  const receipt = await ethers.provider.getTransactionReceipt(txHash);
  if (!receipt) {
    console.error(`❌ Transaction not found or pending on Sepolia for hash: ${txHash}`);
    return;
  }

  console.log(`✅ Transaction Found in Block: ${receipt.blockNumber}`);
  console.log(`Status: ${receipt.status === 1 ? "SUCCESS (1)" : "REVERTED (0)"}`);
  console.log(`Interacted With Contract Address (receipt.to): ${receipt.to}`);
  console.log(`Gas Used: ${receipt.gasUsed.toString()}`);

  const targetAddress = receipt.to;
  if (targetAddress) {
    const code = await ethers.provider.getCode(targetAddress);
    const codeLength = (code.length - 2) / 2;
    console.log(`Smart Contract Bytecode: ${codeLength > 0 ? `Active (${codeLength} bytes)` : "EMPTY (0 bytes)"}`);

    // Parse logs
    const iface = new ethers.Interface([
      "event CertificateIssued(bytes32 indexed certId, address indexed issuer, address indexed recipient, bytes32 proofHash, string metadataUrl, uint256 timestamp)",
      "event CertificateRevoked(bytes32 indexed certId, address indexed issuer, uint256 timestamp, string reason)",
      "event IssuerAuthorized(address indexed issuer)",
      "event IssuerDeauthorized(address indexed issuer)"
    ]);

    console.log(`\nLogs Emitted (${receipt.logs.length}):`);
    for (const [index, log] of receipt.logs.entries()) {
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed) {
          console.log(`  [Log #${index}] Event: ${parsed.name}`);
          console.log(`    - certId: ${parsed.args[0]}`);
          console.log(`    - issuer: ${parsed.args[1]}`);
          console.log(`    - recipient: ${parsed.args[2]}`);
          console.log(`    - proofHash: ${parsed.args[3]}`);
          console.log(`    - metadataUrl: ${parsed.args[4]}`);
          console.log(`    - timestamp: ${parsed.args[5]?.toString()}`);
        }
      } catch {
        console.log(`  [Log #${index}] Address: ${log.address} (Unparsed)`);
      }
    }

    console.log("==================================================");
    console.log(`\n👉 Put this in frontend/.env:\nVITE_REGISTRY_ADDRESS_11155111=${targetAddress}\nVITE_REGISTRY_ADDRESS=${targetAddress}\n`);
    console.log("==================================================");
  }
}

main().catch((err) => {
  console.error("Inspection error:", err);
  process.exitCode = 1;
});
