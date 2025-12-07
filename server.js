import { dispatchCrossChainMessageToBSC } from './crossChainDispatcher.js';
import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import pg from 'pg';
import Web3 from 'web3';
import axios from 'axios';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import winston from 'winston';
import Redis from 'ioredis'; 

const { Pool } = pg;
dotenv.config();
const app = express();
app.use(express.json());
const redisClient = new Redis(); 


const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'server.log' })
    ]
});

const pinata_api = process.env.PINATA_API_KEY;
const pinata_secret = process.env.PINATA_API_SECRET;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});


const web3 = new Web3('https://rpc-amoy.polygon.technology/');
const contractABI =[
	
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint8",
				"name": "action",
				"type": "uint8"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "pigId",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "bytes32",
				"name": "dataHash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "bytes32",
				"name": "ipfsCidHash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "blockNumber",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			}
		],
		"name": "CrossChainDispatched",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "pig_id",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "bytes32",
				"name": "pig_hash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "ipfs_cid",
				"type": "string"
			}
		],
		"name": "PigRegistered",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "pig_id",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "bytes32",
				"name": "qr_hash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "ipfs_cid",
				"type": "string"
			}
		],
		"name": "QRCodeGenerated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "pig_id",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "bytes32",
				"name": "sales_hash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "ipfs_cid",
				"type": "string"
			}
		],
		"name": "SaleRecorded",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "pig_id",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "bytes32",
				"name": "vaccine_hash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "ipfs_cid",
				"type": "string"
			}
		],
		"name": "VaccinationAdded",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "uint256[]",
				"name": "pig_id",
				"type": "uint256[]"
			},
			{
				"internalType": "bytes32[]",
				"name": "vaccine_hash",
				"type": "bytes32[]"
			},
			{
				"internalType": "string[]",
				"name": "ipfs_cid",
				"type": "string[]"
			}
		],
		"name": "addVaccination",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "bscDomain",
		"outputs": [
			{
				"internalType": "uint32",
				"name": "",
				"type": "uint32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "bscReceiver",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "pig_id",
				"type": "uint256"
			},
			{
				"internalType": "bytes32",
				"name": "qr_hash",
				"type": "bytes32"
			},
			{
				"internalType": "string",
				"name": "ipfs_cid",
				"type": "string"
			}
		],
		"name": "generateQRCode",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "pig_id",
				"type": "uint256"
			}
		],
		"name": "getPigData",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			},
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "pig_id",
				"type": "uint256"
			}
		],
		"name": "getQRData",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			},
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "pig_id",
				"type": "uint256"
			}
		],
		"name": "getSalesData",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			},
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "pig_id",
				"type": "uint256"
			}
		],
		"name": "getVaccinationData",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			},
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "mailbox",
		"outputs": [
			{
				"internalType": "contract IMailbox",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "pigData",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "pig_id",
				"type": "uint256"
			},
			{
				"internalType": "bytes32",
				"name": "pig_hash",
				"type": "bytes32"
			},
			{
				"internalType": "string",
				"name": "ipfs_cid",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "qrData",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "pig_id",
				"type": "uint256"
			},
			{
				"internalType": "bytes32",
				"name": "qr_hash",
				"type": "bytes32"
			},
			{
				"internalType": "string",
				"name": "ipfs_cid",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256[]",
				"name": "pig_id",
				"type": "uint256[]"
			},
			{
				"internalType": "bytes32[]",
				"name": "sales_hash",
				"type": "bytes32[]"
			},
			{
				"internalType": "string[]",
				"name": "ipfs_cid",
				"type": "string[]"
			}
		],
		"name": "recordSale",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256[]",
				"name": "pig_ids",
				"type": "uint256[]"
			},
			{
				"internalType": "bytes32[]",
				"name": "pig_hashes",
				"type": "bytes32[]"
			},
			{
				"internalType": "string[]",
				"name": "ipfs_cids",
				"type": "string[]"
			}
		],
		"name": "registerPig",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "salesData",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "pig_id",
				"type": "uint256"
			},
			{
				"internalType": "bytes32",
				"name": "sales_hash",
				"type": "bytes32"
			},
			{
				"internalType": "string",
				"name": "ipfs_cid",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_mailbox",
				"type": "address"
			},
			{
				"internalType": "uint32",
				"name": "_bscDomain",
				"type": "uint32"
			},
			{
				"internalType": "bytes32",
				"name": "_bscReceiver",
				"type": "bytes32"
			}
		],
		"name": "setHyperlane",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "vaccinationData",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "pig_id",
				"type": "uint256"
			},
			{
				"internalType": "bytes32",
				"name": "vaccine_hash",
				"type": "bytes32"
			},
			{
				"internalType": "string",
				"name": "ipfs_cid",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}

];
  
const contractAddress = process.env.CONTRACT_ADDRESS;
const contract = new web3.eth.Contract(contractABI, contractAddress);
const privateKey = process.env.PRIVATE_KEY;
const walletAddress = process.env.WALLET_ADDRESS;

function hashWithSalt(value) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = keccak256(salt + value).toString('hex');
    return { salt, hash };
}

async function uploadToIPFS(data, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', data, {
                headers: {
                    pinata_api_key: pinata_api,
                    pinata_secret_api_key: pinata_secret,
                },
            });
            return response.data.IpfsHash;
        } catch (error) {
            logger.error(`Attempt ${i + 1} failed to upload to IPFS: ${error.message}`);
        }
    }
    throw new Error("Failed to upload data to IPFS");
}

async function getMaticPriceInINR() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=inr');
        return response.data['matic-network'].inr;
    } catch (error) {
        logger.error(`Error fetching MATIC price: ${error.message}`);
        throw error;
    }
}

async function sendBlockchainTransaction(method, params) {
    try {
        const txData = method(...params).encodeABI();
        const gasEstimate = await method(...params).estimateGas({ from: walletAddress });
        const gasPriceWei = await web3.eth.getGasPrice();
        const gasPriceBigInt = BigInt(gasPriceWei);

        const nonce = await web3.eth.getTransactionCount(walletAddress);

        const txObject = {
            to: contractAddress,
            data: txData,
            gas: Math.floor(Number(gasEstimate) * 1.2),  
            gasPrice: gasPriceBigInt.toString(), 
            nonce: Number(nonce), 
        };

        const signedTx = await web3.eth.accounts.signTransaction(txObject, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

         //******************************Calculate gas cost in MATIC*********************//
         const gasCostWei = BigInt(txObject.gas) * BigInt(txObject.gasPrice);
         const gasCostMatic = web3.utils.fromWei(gasCostWei.toString(), 'ether');
 
         //*****************************Get MATIC price in INR**************************//
         const maticPriceInINR = await getMaticPriceInINR();
 
         //***************************Calculate total cost in INR************************//
         const totalCostINR = parseFloat(gasCostMatic) * maticPriceInINR;
         console.log(`Total cost in INR: ₹${totalCostINR.toFixed(2)}`);

        return receipt;
    } catch (error) {
        logger.error(`Blockchain transaction failed: ${error.message}`);
        throw error;
    }
}

app.post('/api/pigs', async function (req, res) {
    const client = await pool.connect();
    try {
        const pigsData = req.body; 
        if (!Array.isArray(pigsData) || pigsData.length === 0) {
            return res.status(400).send("Invalid input: Expected an array of pig details");
        }

        const pigIds = [];
        const pigHashes = [];
        const ipfsCids = [];

        logger.info("Processing batch of pigs");

        await client.query('BEGIN'); 

        for (const pig of pigsData) {
            const { pigId, birthDate, soldAt, breed, geneticLineage, birthWeight, earTag, sex, status, farmId } = pig;
        
            const saltedHashes = [pigId, birthDate, soldAt, breed, geneticLineage, birthWeight, earTag, sex, status, farmId].map(hashWithSalt);
            const salts = saltedHashes.map(hash => hash.salt);
            const leaves = saltedHashes.map(hash => hash.hash);

            const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
            const merkleroot = "0x" + tree.getRoot().toString("hex");

            const qrCodeBase64 = Buffer.from(pigId.toString()).toString('base64');

            const ipfsData = { pigId, birthDate, soldAt, breed, geneticLineage, birthWeight, earTag, sex, status, farmId };
            const ipfs_cid = await uploadToIPFS(ipfsData);
            logger.info(`Data for pig ${pigId} added to IPFS`);

            pigIds.push(pigId);
            pigHashes.push(merkleroot);
            ipfsCids.push(ipfs_cid);

            const insertQuery = `INSERT INTO pig_profiles (pig_id, birth_date, sold_at, breed, genetic_lineage, birth_weight, ear_tag, sex, status, farm_id, salt1, salt2, salt3, salt4, salt5, salt6, salt7, salt8, salt9, salt10) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`;
            const insertValues = [pigId, birthDate, soldAt, breed, geneticLineage, birthWeight, earTag, sex, status, farmId, ...salts];

            logger.info(`Inserting Data for pig ${pigId} into DB`);
            await client.query(insertQuery, insertValues); 

            const insertQr = `INSERT INTO qr_codes (pig_id, qr_code_data) VALUES ($1, $2)`;
            const insertQrValues = [pigId, qrCodeBase64];
            await client.query(insertQr, insertQrValues); 
        }

       const receipt = await sendBlockchainTransaction(contract.methods.registerPig, [pigIds, pigHashes, ipfsCids]);
logger.info(`Batch transaction successful with hash: ${receipt.transactionHash}`);

// dispatch messages to BSC for each pig (non-blocking per-pig; await to ensure success if you want)
for (let i = 0; i < pigIds.length; i++) {
    try {
        await dispatchCrossChainMessageToBSC(
            receipt,
            "PIG_REGISTERED",
            pigIds[i],
            pigHashes[i],
            ipfsCids[i],
            process.env.BSC_VERIFIER_ADDRESS
        );
        logger.info(`Dispatched cross-chain message for pig ${pigIds[i]}`);
    } catch (err) {
        logger.error(`Failed to dispatch cross-chain message for pig ${pigIds[i]}: ${err.message}`);
        // decide: continue dispatching other pigs or throw to rollback. Here we continue.
    }
}
	

        await client.query('COMMIT'); 
        res.send("Batch data added successfully");
        logger.info(`Batch processed: ${pigIds.length} pigs added`);
    } catch (error) {
        await client.query('ROLLBACK'); 
        logger.error(`Error: ${error.message}`);
        res.status(500).send("Error adding batch data");
    } finally {
        client.release(); 
    }
});
export { app, pool };

app.post('/api/vaccination', async function (req, res) {
    try {
        const vaccinationsData = req.body;
        if (!Array.isArray(vaccinationsData) || vaccinationsData.length === 0) {
            return res.status(400).send("Invalid input: Expected an array of vaccination details");
        }

        const pigIds = [];
        const vaccinationHashes = [];
        const ipfsCids = [];
        const dbInsertions = [];

        logger.info("Processing batch of vaccinations");

        for (const vaccination of vaccinationsData) {
            const { vaccinationId, pigId, vaccineName, batchNumber, administeredBy, adminDate, nextDueDate } = vaccination;
            
            const saltedHashes = [vaccinationId, pigId, vaccineName, batchNumber, administeredBy, adminDate, nextDueDate].map(hashWithSalt);
            const salts = saltedHashes.map(hash => hash.salt);
            const leaves = saltedHashes.map(hash => hash.hash);

            const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
            const merkleroot = "0x" + tree.getRoot().toString("hex");

            const ipfsData = { vaccinationId, pigId, vaccineName, batchNumber, administeredBy, adminDate, nextDueDate };
            const ipfs_cid = await uploadToIPFS(ipfsData);
            logger.info(`Data added to IPFS`);

            pigIds.push(pigId);
            vaccinationHashes.push(merkleroot);
            ipfsCids.push(ipfs_cid);

            const insertQuery = `INSERT INTO vaccination_logs (vaccination_id, pig_id, vaccine_name, batch_number, administered_by, admin_date, next_due_date, vsalt1, vsalt2, vsalt3, vsalt4, vsalt5, vsalt6, vsalt7) 
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`;
            const insertValues = [vaccinationId, pigId, vaccineName, batchNumber, administeredBy, adminDate, nextDueDate, ...salts];
            
            logger.info(`Inserting vaccination data into DB`);
            dbInsertions.push(pool.query(insertQuery, insertValues));
        }

        const receipt = await sendBlockchainTransaction(contract.methods.addVaccination, [pigIds, vaccinationHashes, ipfsCids]);
logger.info(`Batch transaction successful with hash: ${receipt.transactionHash}`);

for (let i = 0; i < pigIds.length; i++) {
    try {
        await dispatchCrossChainMessageToBSC(
            receipt,
            "VACCINE_ADDED",
            pigIds[i],
            vaccinationHashes[i],
            ipfsCids[i],
            process.env.BSC_VERIFIER_ADDRESS
        );
        logger.info(`Dispatched cross-chain vaccination message for pig ${pigIds[i]}`);
    } catch (err) {
        logger.error(`Failed to dispatch cross-chain vaccination message for pig ${pigIds[i]}: ${err.message}`);
    }
}


        await Promise.all(dbInsertions);

        res.send("Batch vaccination data added successfully");
        logger.info(`Batch processed: ${vaccinationsData.length} vaccinations added`);
    } catch (error) {
        logger.error(`Error: ${error.message}`);
        res.status(500).send("Error adding batch vaccination data");
    }
});



app.post('/api/sales', async function (req, res) {
    try {
        const salesData = req.body;
        if (!Array.isArray(salesData) || salesData.length === 0) {
            return res.status(400).send("Invalid input: Expected an array of vaccination details");
        }

        const pigIds = [];
        const salesHashes = [];
        const ipfsCids = [];
        const dbInsertions = [];

        logger.info("Processing batch of Sales Data");

        for (const sales of salesData) {
            const { saleId, pigId, saleDate, finalWeight, buyerName, buyerContact, price } = sales;
            
            const saltedHashes = [saleId, pigId, saleDate, finalWeight, buyerName, buyerContact, price].map(hashWithSalt);
            const salts = saltedHashes.map(hash => hash.salt);
            const leaves = saltedHashes.map(hash => hash.hash);

            const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
            const merkleroot = "0x" + tree.getRoot().toString("hex");

            const ipfsData = { saleId, pigId, saleDate, finalWeight, buyerName, buyerContact, price };
            const ipfs_cid = await uploadToIPFS(ipfsData);
            logger.info(`Data added to IPFS`);

            pigIds.push(pigId);
            salesHashes.push(merkleroot);
            ipfsCids.push(ipfs_cid);

            const insertQuery = `INSERT INTO sales (sale_id, pig_id, sale_date, final_weight, buyer_name, buyer_contact, price, ssalt1, ssalt2, ssalt3, ssalt4, ssalt5, ssalt6, ssalt7) VALUES ($1, $2, $3, $4, $5, $6, $7, $8 ,$9, $10, $11, $12, $13, $14)`;
            const insertValues = [saleId, pigId, saleDate, finalWeight, buyerName, buyerContact, price , ...salts];
            
            logger.info(`Inserting sales data into DB`);
            dbInsertions.push(pool.query(insertQuery, insertValues));
        }

        const receipt = await sendBlockchainTransaction(contract.methods.recordSale, [pigIds, salesHashes, ipfsCids]);
logger.info(`Batch transaction successful with hash: ${receipt.transactionHash}`);

for (let i = 0; i < pigIds.length; i++) {
    try {
        await dispatchCrossChainMessageToBSC(
            receipt,
            "SALE_RECORDED",
            pigIds[i],
            salesHashes[i],
            ipfsCids[i],
            process.env.BSC_VERIFIER_ADDRESS
        );
        logger.info(`Dispatched cross-chain sale message for pig ${pigIds[i]}`);
    } catch (err) {
        logger.error(`Failed to dispatch cross-chain sale message for pig ${pigIds[i]}: ${err.message}`);
    }
}


        await Promise.all(dbInsertions);

        res.send("Batch sales data added successfully");
        logger.info(`Batch processed: ${salesData.length} Sales Record added`);
    } catch (error) {
        logger.error(`Error: ${error.message}`);
        res.status(500).send("Error adding batch sales data");
    }
});



app.post("/api/verify/pig", async function(req,res)
{
    const{p_qr_code} = req.body;
    try
    {
        logger.info("Please wait while we verify Pig details...")
        const decodePigId = Buffer.from(p_qr_code, 'base64').toString();
        const cacheKey = `pig:${decodePigId}`;
        let cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
        const verifyResult = JSON.parse(cachedData);
        logger.info("Pig Details Verified (Hit Cache):", verifyResult);
        return res.json(verifyResult);
    }

    const data = await contract.methods.getPigData(decodePigId).call();
        
        if (!data || data.length === 0)
        {
            return res.status(404).json({ message: 'Product not found' });
        }

    const pig_block_merkle_root = data[1]; 
    const pig_p_ipfs_hash = data[2];

    const query = `SELECT * FROM pig_profiles WHERE pig_id = $1`;
    const result = await pool.query(query, [decodePigId]);

    if (result.rows.length === 0) {
        logger.warn("Product not found in database");
        return res.status(404).json({ message: 'Product not found in database' });
    }
    
    const { salt1, salt2, salt3, salt4, salt5, salt6, salt7, salt8, salt9, salt10 } = result.rows[0];
    const url = `https://gateway.pinata.cloud/ipfs/${pig_p_ipfs_hash}`;
    const response = await axios.get(url);
    const jsonData = response.data;

    const leaves = [decodePigId, jsonData.birthDate, jsonData.soldAt, jsonData.breed, jsonData.geneticLineage, jsonData.birthWeight, jsonData.earTag, jsonData.sex, jsonData.status, jsonData.farmId]
        .map((value, index) => keccak256([salt1, salt2, salt3, salt4, salt5, salt6, salt7, salt8, salt9, salt10][index] + value).toString('hex'));

    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const pigVerifyMerkleRoot = "0x" + tree.getRoot().toString("hex");

    logger.info(`Blockchain Merkle Root: ${pig_block_merkle_root}, Calculated Merkle Root: ${pigVerifyMerkleRoot}`);
    const isPigVerificationValid = (pig_block_merkle_root === pigVerifyMerkleRoot);

    if (isPigVerificationValid) {
        const verifyResult = { message: "Pig Data is Authentic", status: "Verified" };
        logger.info("Pig Verified: Authentic");
        await redisClient.set(cacheKey, JSON.stringify(verifyResult), 'EX', 3600); 
        return res.json(verifyResult);
    } 
    else 
    {
        const verificationResult = { message: "Pig data is tampered", status: "Tampered" };
        logger.warn("Pig Verification Failed: Data Tampered");
        await redisClient.set(cacheKey, JSON.stringify(verificationResult), 'EX', 600); 
        return res.json(verificationResult);
    }
        

    }
    catch (error)
    {
        logger.error(`Error: ${error.message}`);
    res.status(500).send("Error verifying data");
    }
});



app.post("/api/verify/vaccination", async function(req,res)
{
    const{p_qr_code} = req.body;
    try
    {
        logger.info("Please wait while we verify Vaccination details...")
        const decodePigId = Buffer.from(p_qr_code, 'base64').toString();
        const cacheKey = `vaccine:${decodePigId}`;
        let cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
        const verifyResult = JSON.parse(cachedData);
        logger.info("Vaccination Details Verified (Hit Cache):", verifyResult);
        return res.json(verifyResult);
    }

    const data = await contract.methods.getVaccinationData(decodePigId).call();
        
        if (!data || data.length === 0)
        {
            return res.status(404).json({ message: 'Details not found' });
        }

    const vaccine_block_merkle_root = data[1]; 
    const vaccine_ipfs_hash = data[2];

    const query = `SELECT * FROM vaccination_logs WHERE pig_id = $1`;
    const result = await pool.query(query, [decodePigId]);

    if (result.rows.length === 0) {
        logger.warn("Product not found in database");
        return res.status(404).json({ message: 'Product not found in database' });
    }
    
    const { vsalt1, vsalt2, vsalt3, vsalt4, vsalt5, vsalt6, vsalt7} = result.rows[0];
    const url = `https://gateway.pinata.cloud/ipfs/${vaccine_ipfs_hash}`;
    const response = await axios.get(url);
    const jsonData = response.data;

    const leaves = [jsonData.vaccinationId, decodePigId, jsonData.vaccineName, jsonData.batchNumber, jsonData.administeredBy, jsonData.adminDate, jsonData.nextDueDate]
        .map((value, index) => keccak256([vsalt1, vsalt2, vsalt3, vsalt4, vsalt5, vsalt6, vsalt7][index] + value).toString('hex'));

    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const vaccineVerifyMerkleRoot = "0x" + tree.getRoot().toString("hex");

    logger.info(`Blockchain Merkle Root: ${vaccine_block_merkle_root}, Calculated Merkle Root: ${vaccineVerifyMerkleRoot}`);
    const isvaccineVerificationValid = (vaccine_block_merkle_root === vaccineVerifyMerkleRoot);

    if (isvaccineVerificationValid) {
        const verifyResult = { message: "Vaccination Data is Authentic", status: "Verified" };
        logger.info("Vaccination Details Verified: Authentic");
        await redisClient.set(cacheKey, JSON.stringify(verifyResult), 'EX', 3600); 
        return res.json(verifyResult);
    } 
    else 
    {
        const verificationResult = { message: "Vaccination data is tampered", status: "Tampered" };
        logger.warn("Vaccination Verification Failed: Data Tampered");
        await redisClient.set(cacheKey, JSON.stringify(verificationResult), 'EX', 600); 
        return res.json(verificationResult);
    }
        

    }
    catch (error)
    {
        logger.error(`Error: ${error.message}`);
    res.status(500).send("Error verifying data");
    }
});


app.post("/api/verify/sales", async function(req,res)
{
    const{p_qr_code} = req.body;
    try
    {
        logger.info("Please wait while we verify Sales Record...")
        const decodePigId = Buffer.from(p_qr_code, 'base64').toString();
        const cacheKey = `sales:${decodePigId}`;
        let cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
        const verifyResult = JSON.parse(cachedData);
        logger.info("Sales Record Verified (Hit Cache):", verifyResult);
        return res.json(verifyResult);
    }

    const data = await contract.methods.getSalesData(decodePigId).call();
        
        if (!data || data.length === 0)
        {
            return res.status(404).json({ message: 'Details not found' });
        }

    const sales_block_merkle_root = data[1]; 
    const sales_ipfs_hash = data[2];

    const query = `SELECT * FROM sales WHERE pig_id = $1`;
    const result = await pool.query(query, [decodePigId]);

    if (result.rows.length === 0) {
        logger.warn("Product not found in database");
        return res.status(404).json({ message: 'Product not found in database' });
    }
    
    const { ssalt1, ssalt2, ssalt3, ssalt4, ssalt5, ssalt6, ssalt7} = result.rows[0];
    const url = `https://gateway.pinata.cloud/ipfs/${sales_ipfs_hash}`;
    const response = await axios.get(url);
    const jsonData = response.data;

    const leaves = [jsonData.saleId, decodePigId, jsonData.saleDate, jsonData.finalWeight, jsonData.buyerName, jsonData.buyerContact, jsonData.price]
        .map((value, index) => keccak256([ssalt1, ssalt2, ssalt3, ssalt4, ssalt5, ssalt6, ssalt7][index] + value).toString('hex'));

    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const salesVerifyMerkleRoot = "0x" + tree.getRoot().toString("hex");

    logger.info(`Blockchain Merkle Root: ${sales_block_merkle_root}, Calculated Merkle Root: ${salesVerifyMerkleRoot}`);
    const issalesVerificationValid = (sales_block_merkle_root === salesVerifyMerkleRoot);

    if (issalesVerificationValid) {
        const verifyResult = { message: "Sales Record is Authentic", status: "Verified" };
        logger.info("Sales Record Verified: Authentic");
        await redisClient.set(cacheKey, JSON.stringify(verifyResult), 'EX', 3600); 
        return res.json(verifyResult);
    } 
    else 
    {
        const verificationResult = { message: "Sales Record is tampered", status: "Tampered" };
        logger.warn("Sales Record Verification Failed: Data Tampered");
        await redisClient.set(cacheKey, JSON.stringify(verificationResult), 'EX', 600); 
        return res.json(verificationResult);
    }
        

    }
    catch (error)
    {
        logger.error(`Error: ${error.message}`);
    res.status(500).send("Error verifying data");
    }
});



app.post("/api/verify", async function(req,res)
{
  const {qrCode} = req.body;
  try
  {
    logger.info("Please wait while we verify your product...")
    const decodedPigId = Buffer.from(qrCode, 'base64').toString();
    const cacheKey = `product:${decodedPigId}`;
    let cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
        const verificationResult = JSON.parse(cachedData);
        logger.info("Product Verified (Hit Cache):", verificationResult);
        return res.json(verificationResult);
    }

    const data = await contract.methods.getPigData(decodedPigId).call();
        
        if (!data || data.length === 0)
        {
            return res.status(404).json({ message: 'Product not found' });
        }

    const pig_block_merkle = data[1]; 
    const pig_p_cid = data[2];

    const query = `SELECT * FROM pig_profiles WHERE pig_id = $1`;
    const result = await pool.query(query, [decodedPigId]);

    if (result.rows.length === 0) {
        logger.warn("Product not found in database");
        return res.status(404).json({ message: 'Product not found in database' });
    }
    
    const { salt1, salt2, salt3, salt4, salt5, salt6, salt7, salt8, salt9, salt10 } = result.rows[0];
    const url = `https://gateway.pinata.cloud/ipfs/${pig_p_cid}`;
    const response = await axios.get(url);
    const jsonData = response.data;

    const leaves = [decodedPigId, jsonData.birthDate, jsonData.soldAt, jsonData.breed, jsonData.geneticLineage, jsonData.birthWeight, jsonData.earTag, jsonData.sex, jsonData.status, jsonData.farmId]
        .map((value, index) => keccak256([salt1, salt2, salt3, salt4, salt5, salt6, salt7, salt8, salt9, salt10][index] + value).toString('hex'));

    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const verifyPigMerkleRoot = "0x" + tree.getRoot().toString("hex");

    logger.info(`Blockchain Merkle Root: ${pig_block_merkle}, Calculated Merkle Root: ${verifyPigMerkleRoot}`);
    const isPigValid = (pig_block_merkle === verifyPigMerkleRoot);
   //###################################################################################################################################################

    const vaccination_data = await contract.methods.getVaccinationData(decodedPigId).call();
    const vaccine_block_merkle = vaccination_data[1];
    const vaccine_cid = vaccination_data[2];

    const query1 = `SELECT * FROM vaccination_logs WHERE pig_id = $1`;
    const result1 = await pool.query(query1, [decodedPigId]);

    if (result1.rows.length === 0) {
        logger.warn("Product not found in database");
        return res.status(404).json({ message: 'Product not found in database' });
    }
    
    const { vsalt1, vsalt2, vsalt3, vsalt4, vsalt5, vsalt6, vsalt7 } = result1.rows[0];
    const vurl = `https://gateway.pinata.cloud/ipfs/${vaccine_cid}`;
    const vresponse = await axios.get(vurl);
    const vjsonData = vresponse.data;

    const vleaves = [vjsonData.vaccinationId, vjsonData.pigId, vjsonData.vaccineName, vjsonData.batchNumber, vjsonData.administeredBy, vjsonData.adminDate, vjsonData.nextDueDate]
        .map((value, index) => keccak256([vsalt1, vsalt2, vsalt3, vsalt4, vsalt5, vsalt6, vsalt7][index] + value).toString('hex'));

    const vtree = new MerkleTree(vleaves, keccak256, { sortPairs: true });
    const vverifyVaccineMerkleRoot = "0x" + vtree.getRoot().toString("hex");

    logger.info(`Blockchain Merkle Root: ${vaccine_block_merkle}, Calculated Merkle Root: ${vverifyVaccineMerkleRoot}`);
    const isVaccineValid = (vaccine_block_merkle === vverifyVaccineMerkleRoot);
	//###########################################################################################################################################################

	const sales_data = await contract.methods.getSalesData(decodedPigId).call();
    const sales_block_merkle = sales_data[1];
    const sales_cid = sales_data[2];

    const query2 = `SELECT * FROM sales WHERE pig_id = $1`;
    const result2 = await pool.query(query2, [decodedPigId]);

    if (result2.rows.length === 0) {
        logger.warn("Product not found in database");
        return res.status(404).json({ message: 'Product not found in database' });
    }
    
    const { ssalt1, ssalt2, ssalt3, ssalt4, ssalt5, ssalt6, ssalt7 } = result2.rows[0];
    const surl = `https://gateway.pinata.cloud/ipfs/${sales_cid}`;
    const sresponse = await axios.get(surl);
    const sjsonData = sresponse.data;

    const sleaves = [sjsonData.saleId, decodedPigId, sjsonData.saleDate, sjsonData.finalWeight, sjsonData.buyerName, sjsonData.buyerContact, sjsonData.price]
        .map((value, index) => keccak256([ssalt1, ssalt2, ssalt3, ssalt4, ssalt5, ssalt6, ssalt7][index] + value).toString('hex'));

    const stree = new MerkleTree(sleaves, keccak256, { sortPairs: true });
    const sverifySalesMerkleRoot = "0x" + stree.getRoot().toString("hex");

    logger.info(`Blockchain Merkle Root: ${sales_block_merkle}, Calculated Merkle Root: ${sverifySalesMerkleRoot}`);
    const isSaleValid = (sales_block_merkle === sverifySalesMerkleRoot);

    
    
    if (isPigValid && isVaccineValid && isSaleValid) {
        const verificationResult = { message: "Product is Authentic", status: "Verified" };
        logger.info("Product Verified: Authentic");
        await redisClient.set(cacheKey, JSON.stringify(verificationResult), 'EX', 3600); 
        return res.json(verificationResult);
    } 
    else 
    {
        const verificationResult = { message: "Product data is tampered", status: "Tampered" };
        logger.warn("Product Verification Failed: Data Tampered");
        await redisClient.set(cacheKey, JSON.stringify(verificationResult), 'EX', 600); 
        return res.json(verificationResult);
    }
} 
catch (error) 
{
    logger.error(`Error: ${error.message}`);
    res.status(500).send("Error verifying data");
}
});



app.use((err, req, res, next) => {
    logger.error(`Server error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});

export default app;