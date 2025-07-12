const fs = require('fs');
const path = require('path');

async function generateABI() {
  console.log('🔍 Generating ABI files...');
  
  // Check if artifacts exist
  const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'DarkPoolDEX.sol', 'DarkPoolDEX.json');
  
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    
    // Create contracts directory if it doesn't exist
    const contractsDir = path.join(__dirname, '..', 'src', 'contracts');
    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir, { recursive: true });
    }
    
    // Generate ABI file
    const abiPath = path.join(contractsDir, 'DarkPoolDEX.json');
    const abiData = {
      abi: artifact.abi,
      bytecode: artifact.bytecode
    };
    
    fs.writeFileSync(abiPath, JSON.stringify(abiData, null, 2));
    
    console.log('✅ DarkPoolDEX ABI file generated at:', abiPath);
    
    // Check if calculateCommitment function exists in ABI
    const calculateCommitmentFunction = artifact.abi.find(
      item => item.type === 'function' && item.name === 'calculateCommitment'
    );
    
    if (calculateCommitmentFunction) {
      console.log('✅ calculateCommitment function found in ABI');
      console.log('   Inputs:', calculateCommitmentFunction.inputs.map(i => `${i.name}: ${i.type}`));
    } else {
      console.log('❌ calculateCommitment function NOT found in ABI');
    }
    
  } else {
    console.error('❌ Contract artifact not found at:', artifactPath);
    console.log('💡 Run: npx hardhat compile');
  }
}

generateABI().catch(console.error);