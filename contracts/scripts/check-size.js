const { ethers } = require("hardhat");

async function checkContractSizes() {
  console.log("📏 Checking Contract Sizes...\n");
  
  // Compile contracts
  await hre.run("compile");
  
  const artifacts = await hre.artifacts.getAllFullyQualifiedNames();
  const maxSize = 24576; // 24KB limit
  
  console.log(`Contract Size Limit: ${maxSize} bytes (24KB)\n`);
  
  for (const artifactName of artifacts) {
    if (artifactName.includes("Mock") || artifactName.includes("@")) continue;
    
    try {
      const artifact = await hre.artifacts.readArtifact(artifactName);
      const bytecode = artifact.bytecode;
      
      if (bytecode && bytecode !== "0x") {
        const size = (bytecode.length - 2) / 2; // Remove 0x and convert hex to bytes
        const status = size > maxSize ? "❌ TOO LARGE" : "✅ OK";
        const percentage = ((size / maxSize) * 100).toFixed(1);
        
        console.log(`${status} ${artifactName}`);
        console.log(`   Size: ${size} bytes (${percentage}% of limit)`);
        
        if (size > maxSize) {
          console.log(`   Overage: ${size - maxSize} bytes`);
        }
        console.log();
      }
    } catch (error) {
      // Skip artifacts that can't be read
    }
  }
}

checkContractSizes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });