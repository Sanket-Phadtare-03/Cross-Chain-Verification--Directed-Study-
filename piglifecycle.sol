// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// @notice Minimal Hyperlane Mailbox interface (dispatch)
interface IMailbox {
    function dispatch(
        uint32 _destinationDomain,
        bytes32 _recipientAddress,
        bytes calldata _message
    ) external payable returns (bytes32);
}

/// @notice Minimal Hyperlane IGP interface for gas payment
interface IInterchainGasPaymaster {
    function payForGas(
        bytes32 _messageId,
        uint32 _destinationDomain,
        uint256 _gasAmount,
        address _refundAddress
    ) external payable;
}

contract PigLifecycle {
    struct PigData {
        uint256 pig_id;
        bytes32 pig_hash;
        string ipfs_cid;
    }
    struct VaccinationData {
        uint256 pig_id;
        bytes32 vaccine_hash;
        string ipfs_cid;
    }
    struct SalesData {
        uint256 pig_id;
        bytes32 sales_hash;
        string ipfs_cid;
    }
    struct QRData {
        uint256 pig_id;
        bytes32 qr_hash;
        string ipfs_cid;
    }

    mapping(uint256 => PigData) public pigData;
    mapping(uint256 => VaccinationData) public vaccinationData;
    mapping(uint256 => SalesData) public salesData;
    mapping(uint256 => QRData) public qrData;

    address public owner;

    // Hyperlane fields
    IMailbox public mailbox;
    IInterchainGasPaymaster public igp;
    uint32 public bscDomain;
    bytes32 public bscReceiver;

    // Message nonce for replay protection
    uint256 public messageNonce;

    // Gas amount to quote for destination chain execution
    uint256 public destinationGasAmount = 300000;

    // Events (original)
    event PigRegistered(uint256 pig_id, bytes32 pig_hash, string ipfs_cid);
    event VaccinationAdded(uint256 pig_id, bytes32 vaccine_hash, string ipfs_cid);
    event SaleRecorded(uint256 pig_id, bytes32 sales_hash, string ipfs_cid);
    event QRCodeGenerated(uint256 pig_id, bytes32 qr_hash, string ipfs_cid);

    // New event for cross-chain
    event CrossChainDispatched(
        bytes32 messageId,
        uint256 nonce,
        string action,
        uint256 pigId,
        bytes32 dataHash,
        string ipfsCid
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Unauthorized: Only owner can call this function");
        _;
    }

    // ---------------- Hyperlane admin ----------------
    /// @notice Configure mailbox, IGP, and BSC destination. Call once after deployment (owner only).
    function setHyperlane(
        address _mailbox,
        address _igp,
        uint32 _bscDomain,
        bytes32 _bscReceiver
    ) external onlyOwner {
        require(_mailbox != address(0), "invalid mailbox");
        require(_bscReceiver != bytes32(0), "invalid receiver");
        mailbox = IMailbox(_mailbox);
        igp = IInterchainGasPaymaster(_igp);
        bscDomain = _bscDomain;
        bscReceiver = _bscReceiver;
    }

    /// @notice Update destination gas amount for IGP quote
    function setDestinationGasAmount(uint256 _gasAmount) external onlyOwner {
        require(_gasAmount > 0, "Gas amount must be positive");
        destinationGasAmount = _gasAmount;
    }

    /// @notice Update BSC receiver address
    function updateBscReceiver(bytes32 _newReceiver) external onlyOwner {
        require(_newReceiver != bytes32(0), "Invalid receiver");
        bscReceiver = _newReceiver;
    }
    // ------------------------------------------------

    // ---------------- core functions ----------------
    function registerPig(
        uint256[] memory pig_ids,
        bytes32[] memory pig_hashes,
        string[] memory ipfs_cids
    ) public onlyOwner {
        require(
            pig_ids.length == pig_hashes.length && pig_ids.length == ipfs_cids.length,
            "Input array lengths must match"
        );

        for (uint256 i = 0; i < pig_ids.length; i++) {
            require(pigData[pig_ids[i]].pig_id == 0, "Pig already registered");
            pigData[pig_ids[i]] = PigData(pig_ids[i], pig_hashes[i], ipfs_cids[i]);
            emit PigRegistered(pig_ids[i], pig_hashes[i], ipfs_cids[i]);

            // DO NOT dispatch here - server will handle it
            // This prevents double dispatching
        }
    }

    function addVaccination(
        uint256[] memory pig_id,
        bytes32[] memory vaccine_hash,
        string[] memory ipfs_cid
    ) public onlyOwner {
        require(
            pig_id.length == vaccine_hash.length && pig_id.length == ipfs_cid.length,
            "Input array lengths must match"
        );
        for (uint256 i = 0; i < pig_id.length; i++) {
            require(vaccinationData[pig_id[i]].pig_id == 0, "Vaccine already recorded");
            vaccinationData[pig_id[i]] = VaccinationData(pig_id[i], vaccine_hash[i], ipfs_cid[i]);
            emit VaccinationAdded(pig_id[i], vaccine_hash[i], ipfs_cid[i]);

            // DO NOT dispatch here - server will handle it
        }
    }

    function recordSale(
        uint256[] memory pig_id,
        bytes32[] memory sales_hash,
        string[] memory ipfs_cid
    ) public onlyOwner {
        require(
            pig_id.length == sales_hash.length && pig_id.length == ipfs_cid.length,
            "Input array lengths must match"
        );
        for (uint256 i = 0; i < pig_id.length; i++) {
            require(salesData[pig_id[i]].pig_id == 0, "Sales Data already recorded");
            salesData[pig_id[i]] = SalesData(pig_id[i], sales_hash[i], ipfs_cid[i]);
            emit SaleRecorded(pig_id[i], sales_hash[i], ipfs_cid[i]);

            // DO NOT dispatch here - server will handle it
        }
    }

    function generateQRCode(uint256 pig_id, bytes32 qr_hash, string memory ipfs_cid)
        public
        onlyOwner
    {
        require(qrData[pig_id].pig_id == 0, "QR code already generated");
        qrData[pig_id] = QRData(pig_id, qr_hash, ipfs_cid);
        emit QRCodeGenerated(pig_id, qr_hash, ipfs_cid);

        // DO NOT dispatch here - server will handle it
    }
    // ------------------------------------------------

    // ---------------- getters (unchanged) ----------------
    function getPigData(uint256 pig_id) external view returns (uint256, bytes32, string memory) {
        require(pigData[pig_id].pig_id != 0, "Pig ID does not exist");
        return (pigData[pig_id].pig_id, pigData[pig_id].pig_hash, pigData[pig_id].ipfs_cid);
    }

    function getVaccinationData(uint256 pig_id)
        external
        view
        returns (uint256, bytes32, string memory)
    {
        require(vaccinationData[pig_id].pig_id != 0, "Pig ID does not exist");
        return (
            vaccinationData[pig_id].pig_id,
            vaccinationData[pig_id].vaccine_hash,
            vaccinationData[pig_id].ipfs_cid
        );
    }

    function getSalesData(uint256 pig_id) external view returns (uint256, bytes32, string memory) {
        require(salesData[pig_id].pig_id != 0, "Pig ID does not exist");
        return (salesData[pig_id].pig_id, salesData[pig_id].sales_hash, salesData[pig_id].ipfs_cid);
    }

    function getQRData(uint256 pig_id) external view returns (uint256, bytes32, string memory) {
        require(qrData[pig_id].pig_id != 0, "Pig ID does not exist");
        return (qrData[pig_id].pig_id, qrData[pig_id].qr_hash, qrData[pig_id].ipfs_cid);
    }
    // -----------------------------------------------------

    // Allow contract to receive ETH for gas payments
    receive() external payable {}

    // Withdraw function for owner
    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}