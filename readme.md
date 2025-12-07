# Blockchain-Based-Comprehensive-Pig-Lifecycle-Tracking

This system provides a blockchain-based solution for tracking pigs through their entire lifecycle (birth, vaccination, sales) with data integrity verification using Merkle Trees and IPFS for decentralized storage. The system allows for:

- Recording pig, vaccination, sales records/profiles
- Tracking Lifecycle
- Verifying data authenticity at any point in the supply chain

---

## Clone this repository:

```
git clone https://github.com/sanket-phadtare/Blockchain-Based-Comprehensive-Pig-Lifecycle-Tracking-Application
```
---
## Install dependencies:
```
npm install express dotenv pg web3 axios merkletreejs keccak256 winston ioredis crypto
```

### Start the server:
```
node server.js
```
---

## Setup Instructions

### Environment Setup


Create a `.env` file in your project root with the following variables:

```env
DB_USER=your_postgres_username
DB_HOST=localhost
DB_NAME=pig_supply_chain
DB_PASSWORD=your_postgres_password
DB_PORT=5432

PINATA_API_KEY=your_pinata_key
PINATA_API_SECRET=your_pinata_secret

CONTRACT_ADDRESS=your_contract_address
PRIVATE_KEY=your_wallet_private_key
WALLET_ADDRESS=your_wallet_address
CONTRACT_ABI=your_contract_abi_json

PORT=6000
```

---
## Database Setup

### Create the database and tables with the following SQL commands:

#### Pig Profiles Table
```
CREATE TABLE pig_profiles (
    pig_id VARCHAR(255) PRIMARY KEY,
    birth_date DATE,
    sold_at DATE,
    breed VARCHAR(100),
    genetic_lineage VARCHAR(255),
    birth_weight DECIMAL(10,2),
    ear_tag VARCHAR(100),
    sex VARCHAR(10),
    status VARCHAR(50),
    farm_id VARCHAR(255),
    salt1 VARCHAR(255),
    salt2 VARCHAR(255),
    salt3 VARCHAR(255),
    salt4 VARCHAR(255),
    salt5 VARCHAR(255),
    salt6 VARCHAR(255),
    salt7 VARCHAR(255),
    salt8 VARCHAR(255),
    salt9 VARCHAR(255),
    salt10 VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
#### QR Codes Table
```
CREATE TABLE qr_codes (
    id SERIAL PRIMARY KEY,
    pig_id VARCHAR(255) REFERENCES pig_profiles(pig_id),
    qr_code_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
#### Vaccination Logs Table
```
CREATE TABLE vaccination_logs (
    vaccination_id VARCHAR(255) PRIMARY KEY,
    pig_id VARCHAR(255) REFERENCES pig_profiles(pig_id),
    vaccine_name VARCHAR(100),
    batch_number VARCHAR(100),
    administered_by VARCHAR(255),
    admin_date DATE,
    next_due_date DATE,
    vsalt1 VARCHAR(255),
    vsalt2 VARCHAR(255),
    vsalt3 VARCHAR(255),
    vsalt4 VARCHAR(255),
    vsalt5 VARCHAR(255),
    vsalt6 VARCHAR(255),
    vsalt7 VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
#### Sales Table
```
CREATE TABLE sales (
    sale_id VARCHAR(255) PRIMARY KEY,
    pig_id VARCHAR(255) REFERENCES pig_profiles(pig_id),
    sale_date DATE,
    final_weight DECIMAL(10,2),
    buyer_name VARCHAR(255),
    buyer_contact VARCHAR(100),
    price DECIMAL(10,2),
    ssalt1 VARCHAR(255),
    ssalt2 VARCHAR(255),
    ssalt3 VARCHAR(255),
    ssalt4 VARCHAR(255),
    ssalt5 VARCHAR(255),
    ssalt6 VARCHAR(255),
    ssalt7 VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---
## Smart Contract Setup

- Write Smart Contract in Remix-IDE
- Compile Smart Contract
- Copy the ABI, which will be later used to copy in Code
- Deploy the Smart Contract
- Contract Address will be generated which will get stored in .env file

---

## API Documentation
### 1. Register Pig 
#### Endpoint: ```POST /api/pigs```
#### Request Body:
```
[
  {
    "pigId": "PIG001",
    "birthDate": "2023-01-15",
    "soldAt": null,
    "breed": "Large White",
    "geneticLineage": "LW-1234",
    "birthWeight": 1.5,
    "earTag": "ET001",
    "sex": "Male",
    "status": "Active",
    "farmId": "FARM001"
  }
]
```
#### Response:
```
"Batch data added successfully"
```
---
### 2. Add Vaccinations
#### Endpoint: ```POST /api/vaccination```
Description: Record vaccinations for pigs
Request Body:
```
[
  {
    "vaccinationId": "VAC001",
    "pigId": "PIG001",
    "vaccineName": "Porcine Circovirus",
    "batchNumber": "BATCH123",
    "administeredBy": "Dr. Smith",
    "adminDate": "2023-02-15",
    "nextDueDate": "2023-05-15"
  }
]
```
Response:
```
"Batch vaccination data added successfully"
```
---
### 3. Record Sales
#### Endpoint: ```POST /api/sales```
Description: Record sales of pigs
Request Body:
```
[
  {
    "saleId": "SALE001",
    "pigId": "PIG001",
    "saleDate": "2023-06-01",
    "finalWeight": 120.5,
    "buyerName": "ABC Meat Co.",
    "buyerContact": "contact@abcmeat.com",
    "price": 15000.00
  }
]
```
Response:
```
"Batch sales data added successfully"
```
---
### 4. Verify Pig Data
#### Endpoint: ```POST /api/verify/pig```
Description: Verify the authenticity of pig data
Request Body:
```
{
  "p_qr_code": "base64_encoded_qr_code"
}
```
Response:
```
{
  "message": "Pig Data is Authentic",
  "status": "Verified"
}
```
---
### 5. Verify Vaccination Data
#### Endpoint: ```POST /api/verify/vaccination```
Description: Verify the authenticity of vaccination data
Request Body:
```
{
  "p_qr_code": "base64_encoded_qr_code"
}
```
Response:
```
{
  "message": "Vaccination Data is Authentic",
  "status": "Verified"
}
```
---
### 6. Verify Sales Data
#### Endpoint: ```POST /api/verify/sales```
Description: Verify the authenticity of sales data
Request Body:
```
{
  "p_qr_code": "base64_encoded_qr_code"
}
```
Response:
```
{
  "message": "Sales Record is Authentic",
  "status": "Verified"
}
```
---
### 7. Comprehensive Verification
#### Endpoint: ```POST /api/verify```
Description: Verify all data (pig, vaccination, sales) for a product
Request Body:
```
{
  "qrCode": "base64_encoded_qr_code"
}
```
Response:
```
{
  "message": "Product is Authentic",
  "status": "Verified"
}
```

---
## INR Estimation for Adding Pig Profile into Blockchain

- On an average, it cost ₹0.22 for adding one Pig Profile into Blockchain
- It also depends on amount/size of details being stored on Blockchain
- Matic price for a single matic in INR fluctuates between ₹18 to ₹23
- Real time INR calculation is done by fetching real time price of MATIC TOKEN from GoinGeko API 
---
## Code Explanation
### Key Components

#### 1. Merkle Tree Verification:

Each data record is hashed with a unique salt.
Hashes are used to create a Merkle Tree.
The Merkle Root is stored on-chain.
Verification recalculates the Merkle Root and compares with the blockchain.

#### 2. IPFS Storage:

Data is stored on IPFS via Pinata.
Only the IPFS CID (Content Identifier) is stored on-chain.
Data can be retrieved from IPFS for verification.
Caching with Redis:

Verification results are cached to improve performance.
Positive verifications are cached longer (1 hour).
Negative verifications are cached shorter (10 minutes).

#### 3. Blockchain Integration:

Uses Polygon Mumbai Testnet for low-cost transactions.
Supports batch operations for efficiency.
Calculates gas costs in INR (via integration if needed).

#### 4. Error Handling:

Logging with Winston.
Database transactions with rollback on error.
Retry mechanisms for IPFS uploads.
Full Code

#### 5. The complete code includes:

Express server setup
PostgreSQL connection pooling
Web3.js blockchain interaction
Pinata IPFS upload functions
Merkle Tree generation and verification
Redis caching implementation
Error handling and logging

---
## 6. IPFS Upload Issues:

- Verify your Pinata API keys.
Check your network connection.
The code includes retry logic (3 attempts).
Blockchain Transaction Failures:

- Ensure you have test MATIC in your wallet.
Check that the contract address and ABI are correct.
Verify you're connected to Polygon Mumbai Testnet.
Database Connection Problems:

- Verify PostgreSQL is running.
Check connection credentials in .env.
Ensure tables are created with correct schema.
Verification Failures:

- Check that all data was properly recorded.
Verify the QR code contains the correct pig ID.
Ensure the smart contract was deployed correctly.



