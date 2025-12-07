import Web3 from "web3";
import dotenv from "dotenv";

dotenv.config();

const web3 = new Web3("https://data-seed-prebsc-1-s1.binance.org:8545/");
const BSC_VERIFIER_ADDRESS = process.env.BSC_VERIFIER_ADDRESS || "0xddBdDd0bCD61eF1210aDB67ec04fA893F5003c14";


const PIG_VERIFIER_ABI = [
  {
    inputs: [],
    name: "mailbox",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "polygonDomain",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "polygonSender",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "pigRecords",
    outputs: [
      { internalType: "string", name: "action", type: "string" },
      { internalType: "bytes32", name: "dataHash", type: "bytes32" },
      { internalType: "bytes32", name: "ipfsCidHash", type: "bytes32" },
      { internalType: "bytes32", name: "polygonTxHash", type: "bytes32" },
      { internalType: "uint256", name: "timestamp", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    name: "processedMessages",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint32", name: "origin", type: "uint32" },
      { indexed: false, internalType: "uint256", name: "pigId", type: "uint256" },
      { indexed: false, internalType: "string", name: "action", type: "string" },
      { indexed: false, internalType: "bytes32", name: "dataHash", type: "bytes32" }
    ],
    name: "MessageVerified",
    type: "event"
  }
];

const contract = new web3.eth.Contract(PIG_VERIFIER_ABI, BSC_VERIFIER_ADDRESS);

async function verifyPigOnBSC(pigId) {
  try {
    console.log(`\n🔍 Checking Pig ${pigId} on BSC Testnet`);
    console.log(`Contract: ${BSC_VERIFIER_ADDRESS}\n`);

  
    console.log("📋 Contract Configuration:");
    try {
      const mailbox = await contract.methods.mailbox().call();
      const polygonDomain = await contract.methods.polygonDomain().call();
      const polygonSender = await contract.methods.polygonSender().call();
      
      console.log("  Mailbox:", mailbox);
      console.log("  Polygon Domain:", polygonDomain.toString());
      console.log("  Polygon Sender:", polygonSender);
      console.log();
    } catch (err) {
      console.log("  ⚠️  Could not read config:", err.message, "\n");
    }

   
    console.log(`🐷 Checking Pig Record for ID ${pigId}:`);
    try {
      const record = await contract.methods.pigRecords(pigId).call();
      
     
      if (!record.action || record.action === "") {
        console.log("  ❌ No record found for this pig");
        console.log("  ⏳ Message may still be in transit from Polygon\n");
        
        console.log("💡 What to do:");
        console.log("  1. Wait 5-10 more minutes for Hyperlane relayer");
        console.log("  2. Check Hyperlane Explorer:");
        console.log("     https://explorer.hyperlane.xyz/");
        console.log("  3. Check BSCScan for incoming transactions:");
        console.log(`     https://testnet.bscscan.com/address/${BSC_VERIFIER_ADDRESS}`);
        return false;
      }
      
      // Record exists!
      console.log("  ✅ RECORD FOUND!");
      console.log("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("  Action:", record.action);
      console.log("  Data Hash:", record.dataHash);
      console.log("  IPFS CID Hash:", record.ipfsCidHash);
      console.log("  Polygon Tx Hash:", record.polygonTxHash);
      console.log("  Timestamp:", new Date(Number(record.timestamp) * 1000).toLocaleString());
      console.log("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      
      console.log("🎉 SUCCESS! Cross-chain verification complete!");
      return true;
      
    } catch (err) {
      console.log("  ❌ Error reading pig record:", err.message);
      return false;
    }

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    return false;
  }
}


async function checkRecentEvents() {
  try {
    const latestBlock = await web3.eth.getBlockNumber();
    const fromBlock = Number(latestBlock) - 5000n;
    
    console.log("📡 Checking Recent Events (last 5000 blocks)...\n");
    
    const events = await contract.getPastEvents('MessageVerified', {
      fromBlock: fromBlock.toString(),
      toBlock: 'latest'
    });
    
    if (events.length === 0) {
      console.log("❌ No MessageVerified events found");
      console.log("⏳ Hyperlane message hasn't been delivered yet\n");
    } else {
      console.log(`✅ Found ${events.length} MessageVerified event(s):\n`);
      events.forEach((event, index) => {
        console.log(`Event ${index + 1}:`);
        console.log("  Pig ID:", event.returnValues.pigId);
        console.log("  Action:", event.returnValues.action);
        console.log("  Origin Domain:", event.returnValues.origin);
        console.log("  Data Hash:", event.returnValues.dataHash);
        console.log("  Block:", event.blockNumber.toString());
        console.log("  Tx Hash:", event.transactionHash);
        console.log("---");
      });
      console.log();
    }
  } catch (err) {
    console.log("⚠️  Could not fetch events:", err.message, "\n");
  }
}


const PIG_ID = process.argv[2] || 256;

(async () => {
 
  await checkRecentEvents();
  
  
  await verifyPigOnBSC(PIG_ID);
  
  console.log("\n🔗 Useful Links:");
  console.log(`  BSCScan: https://testnet.bscscan.com/address/${BSC_VERIFIER_ADDRESS}`);
  console.log(`  Hyperlane Explorer: https://explorer.hyperlane.xyz/`);
})();