// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * Hyperlane Mailbox interface (Receiver side)
 */
interface IMailbox {
    function localDomain() external view returns (uint32);
}

contract PigVerifier {
    // ----------------------------------
    // Storage
    // ----------------------------------

    address public owner;
    address public mailbox; // Hyperlane Mailbox on BSC
    uint32 public polygonDomain; // Hyperlane domain for Polygon
    bytes32 public polygonSender; // PigLifecycle address (bytes32)

    // Replay protection
    mapping(bytes32 => bool) public processedMessages;
    mapping(uint256 => bool) public processedNonces;

    struct CrossChainRecord {
        uint256 nonce;
        string action;
        bytes32 dataHash;
        bytes32 ipfsCidHash;
        bytes32 polygonTxHash;
        uint256 timestamp;
        bool exists;
    }

    mapping(uint256 => CrossChainRecord) public pigRecords;

    // Track all pigs that have been verified
    uint256[] public verifiedPigIds;
    mapping(uint256 => bool) public isPigVerified;

    // ----------------------------------
    // Events
    // ----------------------------------

    event MessageVerified(
        uint32 origin,
        uint256 nonce,
        uint256 pigId,
        string action,
        bytes32 dataHash,
        bytes32 polygonTxHash
    );

    event ConfigurationUpdated(
        address indexed updatedBy,
        string parameterName,
        bytes32 newValue
    );

    // ----------------------------------
    // Constructor
    // ----------------------------------

    constructor(address _mailbox, uint32 _polygonDomain, bytes32 _polygonSender) {
        require(_mailbox != address(0), "Invalid mailbox address");
        require(_polygonDomain > 0, "Invalid polygon domain");
        require(_polygonSender != bytes32(0), "Invalid polygon sender");

        owner = msg.sender;
        mailbox = _mailbox;
        polygonDomain = _polygonDomain;
        polygonSender = _polygonSender;
    }

    // ----------------------------------
    // Modifiers
    // ----------------------------------

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    // ----------------------------------
    // Hyperlane entrypoint
    // ----------------------------------

    /**
     * @notice Handle incoming cross-chain messages from Hyperlane
     * @dev This is called by the Hyperlane Mailbox contract
     * @param _origin The domain ID of the origin chain (Polygon)
     * @param _sender The sender address (PigLifecycle contract) as bytes32
     * @param _message The encoded message data
     */
    function handle(uint32 _origin, bytes32 _sender, bytes calldata _message) external {
        // 1️⃣ Only Hyperlane mailbox can call
        require(msg.sender == mailbox, "Unauthorized: Only mailbox can call");

        // 2️⃣ Origin must be Polygon
        require(_origin == polygonDomain, "Invalid origin domain");

        // 3️⃣ Sender must be PigLifecycle (Polygon)
        require(_sender == polygonSender, "Invalid origin sender");

        // 4️⃣ Replay protection - check message hash
        bytes32 messageHash = keccak256(_message);
        require(!processedMessages[messageHash], "Message already processed");
        processedMessages[messageHash] = true;

        // 5️⃣ Decode message
        // Format: (uint256 nonce, string action, uint256 pigId, bytes32 dataHash, string ipfsCid, bytes32 polygonTxHash, uint256 timestamp)
        (
            uint256 nonce,
            string memory action,
            uint256 pigId,
            bytes32 dataHash,
            string memory ipfsCid,
            bytes32 polygonTxHash,
            uint256 timestamp
        ) = abi.decode(_message, (uint256, string, uint256, bytes32, string, bytes32, uint256));

        // 6️⃣ Replay protection - check nonce
        require(!processedNonces[nonce], "Nonce already processed");
        processedNonces[nonce] = true;

        // 7️⃣ Validate timestamp (not too old - within 30 days)
        require(timestamp <= block.timestamp, "Future timestamp not allowed");
        require(block.timestamp - timestamp <= 30 days, "Message expired");

        // 8️⃣ Store verification record
        pigRecords[pigId] = CrossChainRecord({
            nonce: nonce,
            action: action,
            dataHash: dataHash,
            ipfsCidHash: keccak256(bytes(ipfsCid)),
            polygonTxHash: polygonTxHash,
            timestamp: timestamp,
            exists: true
        });

        // 9️⃣ Track verified pigs
        if (!isPigVerified[pigId]) {
            verifiedPigIds.push(pigId);
            isPigVerified[pigId] = true;
        }

        emit MessageVerified(_origin, nonce, pigId, action, dataHash, polygonTxHash);
    }

    // ----------------------------------
    // Admin Functions
    // ----------------------------------

    /**
     * @notice Update the Polygon sender address
     * @param _newSender New PigLifecycle contract address (as bytes32)
     */
    function updatePolygonSender(bytes32 _newSender) external onlyOwner {
        require(_newSender != bytes32(0), "Invalid sender address");
        polygonSender = _newSender;
        emit ConfigurationUpdated(msg.sender, "polygonSender", _newSender);
    }

    /**
     * @notice Update the Polygon domain ID
     * @param _newDomain New Polygon domain ID
     */
    function updatePolygonDomain(uint32 _newDomain) external onlyOwner {
        require(_newDomain > 0, "Invalid domain");
        polygonDomain = _newDomain;
        emit ConfigurationUpdated(msg.sender, "polygonDomain", bytes32(uint256(_newDomain)));
    }

    /**
     * @notice Update the Hyperlane mailbox address
     * @param _newMailbox New mailbox address
     */
    function updateMailbox(address _newMailbox) external onlyOwner {
        require(_newMailbox != address(0), "Invalid mailbox address");
        mailbox = _newMailbox;
        emit ConfigurationUpdated(
            msg.sender,
            "mailbox",
            bytes32(uint256(uint160(_newMailbox)))
        );
    }

    /**
     * @notice Transfer ownership
     * @param _newOwner New owner address
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner address");
        owner = _newOwner;
    }

    // ----------------------------------
    // Query Functions
    // ----------------------------------

    /**
     * @notice Verify if a pig's data matches the stored record
     * @param pigId The pig ID to verify
     * @param expectedDataHash The expected data hash (merkle root)
     * @return isValid Whether the data matches
     * @return storedHash The stored hash
     * @return action The action that was recorded
     */
    function verifyPig(uint256 pigId, bytes32 expectedDataHash)
        external
        view
        returns (bool isValid, bytes32 storedHash, string memory action)
    {
        CrossChainRecord memory record = pigRecords[pigId];
        require(record.exists, "Pig record not found");

        return (record.dataHash == expectedDataHash, record.dataHash, record.action);
    }

    /**
     * @notice Get the complete record for a pig
     * @param pigId The pig ID
     * @return record The complete cross-chain record
     */
    function getPigRecord(uint256 pigId) external view returns (CrossChainRecord memory) {
        require(pigRecords[pigId].exists, "Pig record not found");
        return pigRecords[pigId];
    }

    /**
     * @notice Check if a pig has been verified on BSC
     * @param pigId The pig ID
     * @return exists Whether the pig exists in records
     */
    function hasPigRecord(uint256 pigId) external view returns (bool) {
        return pigRecords[pigId].exists;
    }

    /**
     * @notice Get total number of verified pigs
     * @return count The total count
     */
    function getVerifiedPigCount() external view returns (uint256) {
        return verifiedPigIds.length;
    }

    /**
     * @notice Get verified pig IDs with pagination
     * @param offset Starting index
     * @param limit Number of records to return
     * @return pigIds Array of pig IDs
     */
    function getVerifiedPigs(uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory pigIds)
    {
        require(offset < verifiedPigIds.length, "Offset out of bounds");

        uint256 end = offset + limit;
        if (end > verifiedPigIds.length) {
            end = verifiedPigIds.length;
        }

        uint256 resultLength = end - offset;
        pigIds = new uint256[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            pigIds[i] = verifiedPigIds[offset + i];
        }

        return pigIds;
    }

    /**
     * @notice Batch verify multiple pigs
     * @param pigIds Array of pig IDs
     * @param expectedHashes Array of expected data hashes
     * @return results Array of boolean results
     */
    function batchVerifyPigs(uint256[] calldata pigIds, bytes32[] calldata expectedHashes)
        external
        view
        returns (bool[] memory results)
    {
        require(pigIds.length == expectedHashes.length, "Array length mismatch");

        results = new bool[](pigIds.length);

        for (uint256 i = 0; i < pigIds.length; i++) {
            CrossChainRecord memory record = pigRecords[pigIds[i]];
            if (record.exists) {
                results[i] = (record.dataHash == expectedHashes[i]);
            } else {
                results[i] = false;
            }
        }

        return results;
    }

    /**
     * @notice Get Polygon transaction hash for a pig
     * @param pigId The pig ID
     * @return txHash The Polygon transaction hash
     */
    function getPolygonTxHash(uint256 pigId) external view returns (bytes32) {
        require(pigRecords[pigId].exists, "Pig record not found");
        return pigRecords[pigId].polygonTxHash;
    }
}