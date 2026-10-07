// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CertificateRegistry
 * @notice Decentralized credential registry managing lifecycle of certificates anchored to SHA-256 proof hashes.
 * @dev Implements gas-packed storage, checks-effects-interactions, OZ v5 Ownable2Step & Pausable, and custom errors.
 */
contract CertificateRegistry is Ownable2Step, Pausable {
    // --- 1. State Variables ---

    /**
     * @notice Struct representing an on-chain certificate record.
     * @dev Optimized storage packing into 4 storage slots.
     */
    struct Certificate {
        address issuer;      // slot 0: 20 bytes
        uint64  issuedAt;    // slot 0: +8 bytes  (fits comfortably until year 584942)
        bool    revoked;     // slot 0: +1 byte   = 29/32 bytes used
        address recipient;   // slot 1: 20 bytes  (optional off-chain or on-chain wallet)
        uint64  revokedAt;   // slot 1: +8 bytes  = 28/32 bytes used
        bytes32 proofHash;   // slot 2: 32 bytes  (SHA-256 proof hash, identity with certId)
        string  metadataUrl; // slot 3(+): dynamic IPFS URI
    }

    /// @dev Mapping from certificate ID (proofHash) to Certificate struct.
    mapping(bytes32 => Certificate) private _certificates;

    /// @dev Whitelist mapping for authorized issuer addresses.
    mapping(address => bool) private _authorizedIssuers;

    // --- 2. Events ---

    /**
     * @notice Emitted when a new certificate is issued on-chain.
     * @param certId Unique identifier (identity with proofHash).
     * @param issuer Address of the issuing entity.
     * @param recipient Address of the certificate recipient (may be address(0)).
     * @param proofHash SHA-256 proof hash of canonicalized metadata.
     * @param metadataUrl IPFS URI pointing to pinned certificate metadata.
     * @param timestamp Block timestamp at issuance.
     */
    event CertificateIssued(
        bytes32 indexed certId,
        address indexed issuer,
        address indexed recipient,
        bytes32 proofHash,
        string metadataUrl,
        uint256 timestamp
    );

    /**
     * @notice Emitted when an existing certificate is revoked.
     * @param certId Unique identifier of revoked certificate.
     * @param issuer Address that initiated the revocation (issuer or contract owner).
     * @param timestamp Block timestamp at revocation.
     * @param reason Human-readable reason for revocation.
     */
    event CertificateRevoked(
        bytes32 indexed certId,
        address indexed issuer,
        uint256 timestamp,
        string reason
    );

    /**
     * @notice Emitted when an issuer is added to the authorized whitelist.
     * @param issuer Address authorized to issue certificates.
     */
    event IssuerAuthorized(address indexed issuer);

    /**
     * @notice Emitted when an issuer is removed from the authorized whitelist.
     * @param issuer Address deauthorized from issuing certificates.
     */
    event IssuerDeauthorized(address indexed issuer);

    // --- 3. Custom Errors ---

    /// @notice Reverted when caller is not an authorized issuer.
    error NotAuthorizedIssuer(address caller);

    /// @notice Reverted when certificate with given ID already exists.
    error CertificateAlreadyExists(bytes32 certId);

    /// @notice Reverted when certificate with given ID does not exist.
    error CertificateNotFound(bytes32 certId);

    /// @notice Reverted when certificate is already marked revoked.
    error CertificateAlreadyRevoked(bytes32 certId);

    /// @notice Reverted when caller is neither original issuer nor contract owner.
    error NotIssuerOrOwner(address caller);

    /// @notice Reverted when proofHash is bytes32(0).
    error InvalidProofHash();

    /// @notice Reverted when metadataUrl is empty.
    error EmptyMetadataUrl();

    /// @notice Reverted when given issuer address is address(0).
    error InvalidIssuerAddress();

    // --- 4. Modifiers ---

    /**
     * @dev Throws if called by any account other than an authorized issuer.
     */
    modifier onlyAuthorizedIssuer() {
        if (!_authorizedIssuers[msg.sender]) {
            revert NotAuthorizedIssuer(msg.sender);
        }
        _;
    }

    // --- 5. Constructor ---

    /**
     * @notice Initializes the CertificateRegistry contract with initial owner.
     * @param initialOwner Address of the initial contract administrator.
     */
    constructor(address initialOwner) Ownable(initialOwner) {
        _authorizedIssuers[initialOwner] = true;
        emit IssuerAuthorized(initialOwner);
    }

    // --- 6. External Functions ---

    /**
     * @notice Issues a new certificate anchored to a SHA-256 proof hash and IPFS metadata URL.
     * @dev Enforces checks-effects-interactions, non-zero hash, non-empty URL, and duplicate prevention.
     * @param proofHash SHA-256 hash of the canonicalized certificate JSON.
     * @param metadataUrl IPFS gateway URL / URI where JSON metadata is pinned.
     * @param recipient Wallet address of recipient (or address(0) if off-chain identified).
     * @return certId Unique certificate identifier (equivalent to proofHash).
     */
    function issueCertificate(
        bytes32 proofHash,
        string calldata metadataUrl,
        address recipient
    ) external whenNotPaused onlyAuthorizedIssuer returns (bytes32 certId) {
        if (proofHash == bytes32(0)) {
            revert InvalidProofHash();
        }
        if (bytes(metadataUrl).length == 0) {
            revert EmptyMetadataUrl();
        }

        certId = proofHash;

        if (_certificates[certId].issuedAt != 0) {
            revert CertificateAlreadyExists(certId);
        }

        uint64 currentTime = uint64(block.timestamp);

        // State update
        _certificates[certId] = Certificate({
            issuer: msg.sender,
            issuedAt: currentTime,
            revoked: false,
            recipient: recipient,
            revokedAt: 0,
            proofHash: proofHash,
            metadataUrl: metadataUrl
        });

        emit CertificateIssued(
            certId,
            msg.sender,
            recipient,
            proofHash,
            metadataUrl,
            currentTime
        );

        return certId;
    }

    /**
     * @notice Revokes an existing certificate.
     * @dev Can only be called by the original issuing address or contract owner.
     * @param certId Unique identifier of certificate to revoke.
     * @param reason Human-readable justification for certificate revocation.
     */
    function revokeCertificate(
        bytes32 certId,
        string calldata reason
    ) external whenNotPaused {
        Certificate storage cert = _certificates[certId];

        if (cert.issuedAt == 0) {
            revert CertificateNotFound(certId);
        }
        if (cert.revoked) {
            revert CertificateAlreadyRevoked(certId);
        }
        if (msg.sender != cert.issuer && msg.sender != owner()) {
            revert NotIssuerOrOwner(msg.sender);
        }

        uint64 currentTime = uint64(block.timestamp);

        cert.revoked = true;
        cert.revokedAt = currentTime;

        emit CertificateRevoked(certId, msg.sender, currentTime, reason);
    }

    /**
     * @notice Authorizes an address to issue certificates.
     * @dev Restricted to contract owner (Ownable2Step).
     * @param issuer Address to grant issuance authorization.
     */
    function addIssuer(address issuer) external onlyOwner {
        if (issuer == address(0)) {
            revert InvalidIssuerAddress();
        }
        _authorizedIssuers[issuer] = true;
        emit IssuerAuthorized(issuer);
    }

    /**
     * @notice Deauthorizes an address from issuing certificates.
     * @dev Restricted to contract owner (Ownable2Step).
     * @param issuer Address to revoke issuance authorization from.
     */
    function removeIssuer(address issuer) external onlyOwner {
        _authorizedIssuers[issuer] = false;
        emit IssuerDeauthorized(issuer);
    }

    /**
     * @notice Pauses certificate issuance.
     * @dev Verification reads remain fully operational.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses certificate issuance.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // --- 7. Public Functions ---

    /**
     * @notice Verifies a certificate and retrieves its on-chain record.
     * @dev Public view function that costs zero gas when called off-chain.
     * @param certId Certificate identifier (proofHash).
     * @return issuer Address of the issuing entity.
     * @return recipient Address of recipient.
     * @return proofHash SHA-256 hash of canonicalized metadata.
     * @return metadataUrl IPFS URL where metadata is pinned.
     * @return issuedAt Block timestamp of issuance.
     * @return revoked True if certificate has been revoked.
     * @return revokedAt Block timestamp of revocation (0 if active).
     */
    function verifyCertificate(bytes32 certId)
        external
        view
        returns (
            address issuer,
            address recipient,
            bytes32 proofHash,
            string memory metadataUrl,
            uint64 issuedAt,
            bool revoked,
            uint64 revokedAt
        )
    {
        Certificate storage cert = _certificates[certId];
        return (
            cert.issuer,
            cert.recipient,
            cert.proofHash,
            cert.metadataUrl,
            cert.issuedAt,
            cert.revoked,
            cert.revokedAt
        );
    }

    /**
     * @notice Checks if an address is authorized to issue certificates.
     * @param issuer Address to check.
     * @return True if address is an authorized issuer, false otherwise.
     */
    function isIssuerAuthorized(address issuer) external view returns (bool) {
        return _authorizedIssuers[issuer];
    }
}
