import Web3 from "web3";
import dotenv from "dotenv";
import winston from "winston";

dotenv.config();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: "crosschain.log" })
  ]
});

const web3 = new Web3(
  process.env.POLYGON_RPC || "https://rpc-amoy.polygon.technology/"
);

const MAILBOX_ADDRESS = process.env.HYPERLANE_MAILBOX_ADDRESS;
const IGP_ADDRESS = process.env.HYPERLANE_IGP_ADDRESS || "0x0000000000000000000000000000000000000000"; // Optional
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BSC_VERIFIER_ADDRESS = process.env.BSC_VERIFIER_ADDRESS;


if (!MAILBOX_ADDRESS || !WALLET_ADDRESS || !PRIVATE_KEY || !BSC_VERIFIER_ADDRESS) {
  logger.error("❌ Missing required environment variables");
  logger.error("Required: HYPERLANE_MAILBOX_ADDRESS, WALLET_ADDRESS, PRIVATE_KEY, BSC_VERIFIER_ADDRESS");
  throw new Error("❌ Missing required environment variables");
}


const BSC_TESTNET_DOMAIN = 97;


const MAILBOX_ABI = [
  {
    inputs: [
      { internalType: "uint32", name: "_destinationDomain", type: "uint32" },
      { internalType: "bytes32", name: "_recipientAddress", type: "bytes32" },
      { internalType: "bytes", name: "_messageBody", type: "bytes" }
    ],
    name: "dispatch",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "payable",
    type: "function"
  }
];


const IGP_ABI = [
  {
    inputs: [
      { internalType: "uint32", name: "destinationDomain", type: "uint32" },
      { internalType: "uint256", name: "gasAmount", type: "uint256" }
    ],
    name: "quoteGasPayment",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
];

const mailbox = new web3.eth.Contract(MAILBOX_ABI, MAILBOX_ADDRESS);
let igp = null;


if (IGP_ADDRESS && IGP_ADDRESS !== "0x0000000000000000000000000000000000000000") {
  igp = new web3.eth.Contract(IGP_ABI, IGP_ADDRESS);
}


let messageNonce = Date.now(); 

/**
 * Convert Ethereum address to bytes32 format (left-padded)
 * @param {string} address - Ethereum address
 * @returns {string} bytes32 formatted address
 */
function addressToBytes32(address) {
  if (typeof address !== "string") {
    throw new Error(`Address must be string, got ${typeof address}`);
  }
  if (!web3.utils.isAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
  return web3.utils.padLeft(address.toLowerCase(), 64);
}

/**
 * Get dispatch fee from IGP or use fallback
 * @param {number} gasAmount - Estimated gas for destination chain
 * @returns {Promise<string>} Fee in wei
 */
async function getDispatchFee(gasAmount = 300000) {
  if (igp) {
    try {
      const fee = await igp.methods.quoteGasPayment(BSC_TESTNET_DOMAIN, gasAmount).call();
      logger.info(`IGP quoted fee: ${web3.utils.fromWei(fee, "ether")} MATIC`);
      return fee;
    } catch (error) {
      logger.warn(`IGP quote failed: ${error.message}, using fallback`);
    }
  }


  const fallbackFee = web3.utils.toWei("0.001", "ether");
  logger.info(`💰 Using fallback fee: ${web3.utils.fromWei(fallbackFee, "ether")} MATIC`);
  return fallbackFee;
}

/**
 * Dispatch a cross-chain message to BSC via Hyperlane
 * @param {Object} receipt - Polygon transaction receipt
 * @param {string} action - Action type (e.g., "PIG_REGISTERED", "VACCINE_ADDED")
 * @param {number|string} pigId - Pig ID
 * @param {string} merkleRoot - Data hash (merkle root)
 * @param {string} ipfsCid - IPFS CID
 * @param {string} bscVerifierAddress - BSC PigVerifier contract address
 * @returns {Promise<Object>} Dispatch transaction receipt
 */
export async function dispatchCrossChainMessageToBSC(
  receipt,
  action,
  pigId,
  merkleRoot,
  ipfsCid,
  bscVerifierAddress
) {
  try {
    logger.info("============================================");
    logger.info("Dispatching cross-chain message to BSC...");
    logger.info(`   Action: ${action}`);
    logger.info(`   Pig ID: ${pigId}`);
    logger.info(`   Merkle Root: ${merkleRoot}`);
    logger.info(`   IPFS CID: ${ipfsCid}`);
    logger.info(`   BSC Verifier: ${bscVerifierAddress}`);

    // Increment nonce for each message
    messageNonce++;

    const polygonTxHash = receipt.transactionHash;
    const timestamp = Math.floor(Date.now() / 1000);

    
    const message = web3.eth.abi.encodeParameters(
      ["uint256", "string", "uint256", "bytes32", "string", "bytes32", "uint256"],
      [
        messageNonce.toString(),
        action,
        pigId.toString(),
        merkleRoot,
        ipfsCid,
        polygonTxHash,
        timestamp.toString()
      ]
    );

    logger.info(`   Message Nonce: ${messageNonce}`);
    logger.info(`   Timestamp: ${timestamp}`);
    logger.info(`   Polygon Tx: ${polygonTxHash}`);

    
    const recipientBytes32 = addressToBytes32(bscVerifierAddress);
    logger.info(`   Recipient (bytes32): ${recipientBytes32}`);

   
    const dispatchFee = await getDispatchFee();

   
    const balance = await web3.eth.getBalance(WALLET_ADDRESS);
    const balanceInMatic = web3.utils.fromWei(balance, "ether");
    logger.info(`   Wallet Balance: ${balanceInMatic} MATIC`);

    if (BigInt(balance) < BigInt(dispatchFee)) {
      throw new Error(
        `Insufficient balance. Need ${web3.utils.fromWei(dispatchFee, "ether")} MATIC, have ${balanceInMatic} MATIC`
      );
    }

   
    const tx = mailbox.methods.dispatch(BSC_TESTNET_DOMAIN, recipientBytes32, message);

    const gasPrice = await web3.eth.getGasPrice();
    const nonce = await web3.eth.getTransactionCount(WALLET_ADDRESS, "pending");

   
    let gasEstimate;
    try {
      gasEstimate = await tx.estimateGas({
        from: WALLET_ADDRESS,
        value: dispatchFee
      });
      logger.info(`   Gas Estimate: ${gasEstimate}`);
    } catch (gasError) {
      logger.warn("Gas estimation failed, using default (300,000)");
      logger.warn(`   Error: ${gasError.message}`);
      gasEstimate = 300000;
    }

   
    const gasLimit = Math.floor(Number(gasEstimate) * 1.3);
    logger.info(`   Gas Limit (with buffer): ${gasLimit}`);
    logger.info(`   Gas Price: ${web3.utils.fromWei(gasPrice, "gwei")} Gwei`);

    const txObject = {
      to: MAILBOX_ADDRESS,
      data: tx.encodeABI(),
      gas: gasLimit,
      gasPrice: gasPrice.toString(),
      nonce: Number(nonce),
      value: dispatchFee
    };

   
    logger.info("✍️  Signing transaction...");
    const signedTx = await web3.eth.accounts.signTransaction(txObject, PRIVATE_KEY);

   
    logger.info("📡 Sending transaction...");
    const txReceipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);


    const gasCostWei = BigInt(txReceipt.gasUsed) * BigInt(gasPrice);
    const totalCostWei = gasCostWei + BigInt(dispatchFee);
    const totalCostMatic = web3.utils.fromWei(totalCostWei.toString(), "ether");

    logger.info("✅ ============================================");
    logger.info("✅ Cross-chain message dispatched successfully!");
    logger.info(`   Tx Hash: ${txReceipt.transactionHash}`);
    logger.info(`   Gas Used: ${txReceipt.gasUsed}`);
    logger.info(`   Total Cost: ${totalCostMatic} MATIC`);
    logger.info(`   Block: ${txReceipt.blockNumber}`);
    logger.info(`   Status: ${txReceipt.status ? "Success" : "Failed"}`);
    logger.info("   🔗 View on Polygon:");
    logger.info(`   https://amoy.polygonscan.com/tx/${txReceipt.transactionHash}`);
    logger.info("   ⏳ Message will arrive on BSC in ~5-10 minutes");
    logger.info("============================================");

    return txReceipt;
  } catch (err) {
    logger.error("❌ ============================================");
    logger.error("❌ Cross-chain dispatch FAILED!");
    logger.error(`   Error: ${err.message}`);

    
    if (err.message.includes("insufficient funds")) {
      logger.error("💡 Solution: Add more MATIC to wallet:", WALLET_ADDRESS);
      logger.error("   Get testnet MATIC: https://faucet.polygon.technology/");
    } else if (err.message.includes("invalid address")) {
      logger.error("💡 Solution: Check HYPERLANE_MAILBOX_ADDRESS in .env");
      logger.error("   Expected:", MAILBOX_ADDRESS);
    } else if (err.message.includes("revert")) {
      logger.error("💡 Solution: Contract may have issues");
      logger.error("   1. Verify Mailbox address is correct");
      logger.error("   2. Check if wallet has MATIC for gas");
    } else if (err.message.includes("nonce")) {
      logger.error("💡 Solution: Nonce conflict detected");
      logger.error("   Wait a moment and try again");
    }

    logger.error("============================================");
    throw err;
  }
}

/**
 * Batch dispatch multiple messages (more efficient)
 * @param {Object} receipt - Polygon transaction receipt
 * @param {string} action - Action type
 * @param {Array} dataArray - Array of {pigId, merkleRoot, ipfsCid}
 * @param {string} bscVerifierAddress - BSC PigVerifier contract address
 * @returns {Promise<Array>} Array of dispatch receipts
 */
export async function dispatchBatchToBSC(receipt, action, dataArray, bscVerifierAddress) {
  logger.info(`Batch dispatching ${dataArray.length} messages...`);

  const results = [];
  const errors = [];

  for (let i = 0; i < dataArray.length; i++) {
    const { pigId, merkleRoot, ipfsCid } = dataArray[i];

    try {
      logger.info(`Dispatching ${i + 1}/${dataArray.length}...`);
      const result = await dispatchCrossChainMessageToBSC(
        receipt,
        action,
        pigId,
        merkleRoot,
        ipfsCid,
        bscVerifierAddress
      );
      results.push({ pigId, success: true, txHash: result.transactionHash });

     
      if (i < dataArray.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      logger.error(`❌ Failed to dispatch for pig ${pigId}: ${error.message}`);
      errors.push({ pigId, success: false, error: error.message });
      results.push({ pigId, success: false, error: error.message });
    }
  }

  logger.info(`Batch dispatch complete: ${results.length - errors.length}/${dataArray.length} successful`);

  if (errors.length > 0) {
    logger.warn(`${errors.length} messages failed to dispatch`);
  }

  return results;
}

/**
 * Test function to verify configuration
 * @returns {Promise<boolean>} True if configuration is valid
 */
export async function testConfiguration() {
  try {
    logger.info("Testing Hyperlane configuration...");

   
    const balance = await web3.eth.getBalance(WALLET_ADDRESS);
    logger.info(`✅ Wallet: ${WALLET_ADDRESS}`);
    logger.info(`   Balance: ${web3.utils.fromWei(balance, "ether")} MATIC`);

  
    const code = await web3.eth.getCode(MAILBOX_ADDRESS);
    if (code === "0x") {
      throw new Error("Mailbox address has no contract code");
    }
    logger.info(`✅ Mailbox: ${MAILBOX_ADDRESS}`);

    
    if (!web3.utils.isAddress(BSC_VERIFIER_ADDRESS)) {
      throw new Error("Invalid BSC verifier address");
    }
    logger.info(`✅ BSC Verifier: ${BSC_VERIFIER_ADDRESS}`);
    logger.info(`   As bytes32: ${addressToBytes32(BSC_VERIFIER_ADDRESS)}`);

    logger.info("✅ Configuration test passed!");
    return true;
  } catch (error) {
    logger.error(`❌ Configuration test failed: ${error.message}`);
    return false;
  }
}


export { addressToBytes32, getDispatchFee };