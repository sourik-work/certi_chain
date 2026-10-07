import { expect } from "chai";
import { ethers } from "hardhat";
import { CertificateRegistry } from "../../frontend/src/contracts/CertificateRegistry";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CertificateRegistry", function () {
  let registry: CertificateRegistry;
  let owner: SignerWithAddress;
  let issuer: SignerWithAddress;
  let recipient: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const sampleProofHash = ethers.keccak256(ethers.toUtf8Bytes("cert-1-metadata"));
  const sampleProofHash2 = ethers.keccak256(ethers.toUtf8Bytes("cert-2-metadata"));
  const sampleMetadataUrl = "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

  beforeEach(async function () {
    [owner, issuer, recipient, unauthorized] = await ethers.getSigners();

    const CertificateRegistryFactory = await ethers.getContractFactory("CertificateRegistry");
    registry = (await CertificateRegistryFactory.deploy(owner.address)) as unknown as CertificateRegistry;
    await registry.waitForDeployment();

    // Authorize issuer
    await registry.connect(owner).addIssuer(issuer.address);
  });

  describe("constructor", function () {
    it("succeeds and sets owner as authorized issuer", async function () {
      expect(await registry.owner()).to.equal(owner.address);
      expect(await registry.isIssuerAuthorized(owner.address)).to.be.true;
    });

    it("reverts when initialOwner is address(0)", async function () {
      const CertificateRegistryFactory = await ethers.getContractFactory("CertificateRegistry");
      await expect(
        CertificateRegistryFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(CertificateRegistryFactory, "OwnableInvalidOwner")
        .withArgs(ethers.ZeroAddress);
    });
  });

  describe("issueCertificate", function () {
    it("succeeds when called by an authorized issuer and emits CertificateIssued", async function () {
      const tx = await registry
        .connect(issuer)
        .issueCertificate(sampleProofHash, sampleMetadataUrl, recipient.address);

      await expect(tx)
        .to.emit(registry, "CertificateIssued")
        .withArgs(
          sampleProofHash,
          issuer.address,
          recipient.address,
          sampleProofHash,
          sampleMetadataUrl,
          (timestamp: bigint) => timestamp > 0n
        );

      const cert = await registry.verifyCertificate(sampleProofHash);
      expect(cert.issuer).to.equal(issuer.address);
      expect(cert.recipient).to.equal(recipient.address);
      expect(cert.proofHash).to.equal(sampleProofHash);
      expect(cert.metadataUrl).to.equal(sampleMetadataUrl);
      expect(cert.issuedAt).to.be.greaterThan(0n);
      expect(cert.revoked).to.be.false;
      expect(cert.revokedAt).to.equal(0n);
    });

    it("succeeds when recipient is address(0) for off-chain identification", async function () {
      await expect(
        registry.connect(issuer).issueCertificate(sampleProofHash, sampleMetadataUrl, ethers.ZeroAddress)
      ).to.emit(registry, "CertificateIssued");

      const cert = await registry.verifyCertificate(sampleProofHash);
      expect(cert.recipient).to.equal(ethers.ZeroAddress);
    });

    it("reverts when caller is not an authorized issuer", async function () {
      await expect(
        registry.connect(unauthorized).issueCertificate(sampleProofHash, sampleMetadataUrl, recipient.address)
      )
        .to.be.revertedWithCustomError(registry, "NotAuthorizedIssuer")
        .withArgs(unauthorized.address);
    });

    it("reverts when proofHash is bytes32(0)", async function () {
      await expect(
        registry.connect(issuer).issueCertificate(ethers.ZeroHash, sampleMetadataUrl, recipient.address)
      ).to.be.revertedWithCustomError(registry, "InvalidProofHash");
    });

    it("reverts when metadataUrl is empty", async function () {
      await expect(
        registry.connect(issuer).issueCertificate(sampleProofHash, "", recipient.address)
      ).to.be.revertedWithCustomError(registry, "EmptyMetadataUrl");
    });

    it("reverts when certificate already exists", async function () {
      await registry.connect(issuer).issueCertificate(sampleProofHash, sampleMetadataUrl, recipient.address);

      await expect(
        registry.connect(issuer).issueCertificate(sampleProofHash, sampleMetadataUrl, recipient.address)
      )
        .to.be.revertedWithCustomError(registry, "CertificateAlreadyExists")
        .withArgs(sampleProofHash);
    });

    it("reverts when contract is paused", async function () {
      await registry.connect(owner).pause();

      await expect(
        registry.connect(issuer).issueCertificate(sampleProofHash, sampleMetadataUrl, recipient.address)
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
    });
  });

  describe("revokeCertificate", function () {
    beforeEach(async function () {
      await registry.connect(issuer).issueCertificate(sampleProofHash, sampleMetadataUrl, recipient.address);
    });

    it("succeeds when called by the original issuer and emits CertificateRevoked", async function () {
      const tx = await registry.connect(issuer).revokeCertificate(sampleProofHash, "Issued in error");

      await expect(tx)
        .to.emit(registry, "CertificateRevoked")
        .withArgs(
          sampleProofHash,
          issuer.address,
          (timestamp: bigint) => timestamp > 0n,
          "Issued in error"
        );

      const cert = await registry.verifyCertificate(sampleProofHash);
      expect(cert.revoked).to.be.true;
      expect(cert.revokedAt).to.be.greaterThan(0n);
    });

    it("succeeds when called by contract owner override", async function () {
      await expect(
        registry.connect(owner).revokeCertificate(sampleProofHash, "Admin policy enforcement")
      )
        .to.emit(registry, "CertificateRevoked")
        .withArgs(
          sampleProofHash,
          owner.address,
          (timestamp: bigint) => timestamp > 0n,
          "Admin policy enforcement"
        );

      const cert = await registry.verifyCertificate(sampleProofHash);
      expect(cert.revoked).to.be.true;
    });

    it("reverts when certificate does not exist", async function () {
      await expect(
        registry.connect(issuer).revokeCertificate(sampleProofHash2, "Non-existent")
      )
        .to.be.revertedWithCustomError(registry, "CertificateNotFound")
        .withArgs(sampleProofHash2);
    });

    it("reverts when certificate is already revoked", async function () {
      await registry.connect(issuer).revokeCertificate(sampleProofHash, "First revocation");

      await expect(
        registry.connect(issuer).revokeCertificate(sampleProofHash, "Duplicate revocation")
      )
        .to.be.revertedWithCustomError(registry, "CertificateAlreadyRevoked")
        .withArgs(sampleProofHash);
    });

    it("reverts when caller is neither issuer nor owner", async function () {
      await expect(
        registry.connect(unauthorized).revokeCertificate(sampleProofHash, "Unauthorized attempt")
      )
        .to.be.revertedWithCustomError(registry, "NotIssuerOrOwner")
        .withArgs(unauthorized.address);
    });

    it("reverts when contract is paused", async function () {
      await registry.connect(owner).pause();

      await expect(
        registry.connect(issuer).revokeCertificate(sampleProofHash, "Paused attempt")
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
    });
  });

  describe("verifyCertificate", function () {
    it("returns zeroed record when certificate does not exist", async function () {
      const cert = await registry.verifyCertificate(sampleProofHash);
      expect(cert.issuedAt).to.equal(0n);
      expect(cert.issuer).to.equal(ethers.ZeroAddress);
      expect(cert.proofHash).to.equal(ethers.ZeroHash);
      expect(cert.revoked).to.be.false;
    });

    it("returns active record correctly", async function () {
      await registry.connect(issuer).issueCertificate(sampleProofHash, sampleMetadataUrl, recipient.address);
      const cert = await registry.verifyCertificate(sampleProofHash);
      expect(cert.issuer).to.equal(issuer.address);
      expect(cert.recipient).to.equal(recipient.address);
      expect(cert.proofHash).to.equal(sampleProofHash);
      expect(cert.metadataUrl).to.equal(sampleMetadataUrl);
      expect(cert.revoked).to.be.false;
    });

    it("remains readable when contract is paused (NFR-3 / FR-1.7)", async function () {
      await registry.connect(issuer).issueCertificate(sampleProofHash, sampleMetadataUrl, recipient.address);
      await registry.connect(owner).pause();

      const cert = await registry.verifyCertificate(sampleProofHash);
      expect(cert.issuer).to.equal(issuer.address);
    });
  });

  describe("addIssuer & removeIssuer", function () {
    it("succeeds when owner adds an issuer and emits IssuerAuthorized", async function () {
      await expect(registry.connect(owner).addIssuer(unauthorized.address))
        .to.emit(registry, "IssuerAuthorized")
        .withArgs(unauthorized.address);

      expect(await registry.isIssuerAuthorized(unauthorized.address)).to.be.true;
    });

    it("reverts when adding address(0)", async function () {
      await expect(
        registry.connect(owner).addIssuer(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "InvalidIssuerAddress");
    });

    it("succeeds when owner removes an issuer and emits IssuerDeauthorized", async function () {
      await expect(registry.connect(owner).removeIssuer(issuer.address))
        .to.emit(registry, "IssuerDeauthorized")
        .withArgs(issuer.address);

      expect(await registry.isIssuerAuthorized(issuer.address)).to.be.false;
    });

    it("reverts when non-owner attempts to add or remove issuer", async function () {
      await expect(
        registry.connect(unauthorized).addIssuer(unauthorized.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");

      await expect(
        registry.connect(unauthorized).removeIssuer(issuer.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("pause & unpause", function () {
    it("succeeds when owner pauses and unpauses", async function () {
      await registry.connect(owner).pause();
      expect(await registry.paused()).to.be.true;

      await registry.connect(owner).unpause();
      expect(await registry.paused()).to.be.false;
    });

    it("reverts when non-owner calls pause or unpause", async function () {
      await expect(
        registry.connect(unauthorized).pause()
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");

      await expect(
        registry.connect(unauthorized).unpause()
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });
});
