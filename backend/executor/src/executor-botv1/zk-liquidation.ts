// ====================================================================
// 🚀 HACKATHON: MINIMAL ZK LIQUIDATION SYSTEM
// ====================================================================

import { prove } from "@zk-kit/groth16";
import { resolve } from "path";
import { database, Position } from './database';
import { merkleTree } from './merkle';
import { contractManager } from './contracts';
import { closeExecutor } from './close-executor';

// ====================================================================
// TYPES
// ====================================================================

export interface LiquidationData {
  trader: string;
  assetId: number;
  position: Position;
  currentPrice: bigint;
  healthFactor: number;
  liquidatable: boolean;
  unrealizedPnL: bigint;
  marginAfterPnL: bigint;
  minCollateral: bigint;
}

export interface ZKProof {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
  input: string[];
}

export interface LiquidationResult {
  success: boolean;
  txHash?: string;
  liquidationData?: LiquidationData;
  error?: string;
}

// ====================================================================
// ZK LIQUIDATION SERVICE - MINIMAL VERSION
// ====================================================================

export class ZKLiquidationService {
  
  // Field modulus for ZK circuits (handle negative numbers)
  private readonly FIELD_MODULUS = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
  
  // Liquidation threshold (10% collateral ratio)
  private readonly LIQUIDATION_THRESHOLD = 0.1; // 10%
  
  constructor() {
    console.log('🗲 ZK Liquidation Service initialized (hackathon minimal version)');
  }

  // ====================================================================
  // 🚀 HACKATHON: CORE LIQUIDATION FUNCTIONS
  // ====================================================================

  /**
   * Check if a position is liquidatable
   */
  async checkLiquidatable(trader: string, assetId: number): Promise<LiquidationData | null> {
    try {
      console.log(`🔍 Checking liquidation status: ${trader} asset ${assetId}`);
      
      // Get position
      const position = database.getPosition(trader, assetId);
      if (!position) {
        console.log(`❌ Position not found`);
        return null;
      }
      
      // Get current price
      const currentPrice = await contractManager.getCurrentPrice(assetId);
      
      // Calculate PnL and health
      const pnlData = await closeExecutor.calculatePositionPnL(position);
      
      // Calculate health factor
      const marginAfterPnL = position.margin + pnlData.unrealizedPnL;
      const absSize = position.size > 0n ? position.size : -position.size;
      const minCollateral = (absSize * BigInt(Math.floor(this.LIQUIDATION_THRESHOLD * 1e6))) / BigInt(1e6);
      const healthFactor = Number(marginAfterPnL) / Number(minCollateral);
      
      const liquidatable = healthFactor < 1.0;
      
      const liquidationData: LiquidationData = {
        trader,
        assetId,
        position,
        currentPrice,
        healthFactor,
        liquidatable,
        unrealizedPnL: pnlData.unrealizedPnL,
        marginAfterPnL,
        minCollateral
      };
      
      console.log(`📊 Liquidation check result:`);
      console.log(`   Health factor: ${healthFactor.toFixed(3)}`);
      console.log(`   Liquidatable: ${liquidatable ? '✅ YES' : '❌ NO'}`);
      console.log(`   Margin after PnL: $${Number(marginAfterPnL)/1e6}`);
      console.log(`   Min collateral: $${Number(minCollateral)/1e6}`);
      
      return liquidationData;
      
    } catch (error) {
      console.error(`❌ Failed to check liquidation status:`, error);
      return null;
    }
  }

  /**
   * Generate ZK proof for liquidation
   */
  async generateLiquidationProof(liquidationData: LiquidationData): Promise<ZKProof | null> {
    try {
      console.log(`🔐 Generating ZK liquidation proof for ${liquidationData.trader} asset ${liquidationData.assetId}`);
      
      // Get circuit input data from merkle tree
      const circuitData = merkleTree.getCircuitInputData(liquidationData.trader, liquidationData.assetId);
      if (!circuitData) {
        throw new Error('Failed to get circuit input data');
      }
      
      // Prepare circuit inputs (minimal version - no funding fields)
      const input = {
        oldRoot: circuitData.root,
        newRoot: circuitData.root, // Same for verification
        trader: this.addressToBigInt(liquidationData.trader).toString(),
        assetId: liquidationData.assetId.toString(),
        size: liquidationData.position.size.toString(),
        margin: this.handleFieldModulus(liquidationData.position.margin).toString(),
        entryPrice: liquidationData.position.entryPrice.toString(),
        lastUpdate: liquidationData.position.lastUpdate.toString(),
        currentPrice: liquidationData.currentPrice.toString(),
        pathElements: circuitData.pathElements,
        pathIndices: circuitData.pathIndices
      };
      
      console.log(`🔧 Circuit inputs prepared:`);
      console.log(`   Root: ${input.oldRoot}`);
      console.log(`   Size: ${input.size}`);
      console.log(`   Margin: ${input.margin}`);
      console.log(`   Current price: ${input.currentPrice}`);
      
      // Generate proof using circuit files
      const wasmPath = this.getWasmPath();
      const zkeyPath = this.getZkeyPath();
      
      console.log(`📁 Using circuit files:`);
      console.log(`   WASM: ${wasmPath}`);
      console.log(`   ZKEY: ${zkeyPath}`);
      
      const { proof, publicSignals } = await prove(input, wasmPath, zkeyPath);
      
      // Format proof for Solidity
      const formattedProof = this.formatProofForSolidity(proof, publicSignals);
      
      console.log(`✅ ZK proof generated successfully`);
      console.log(`   Public signals: [${publicSignals.slice(0, 3).join(', ')}...]`);
      
      return formattedProof;
      
    } catch (error) {
      console.error(`❌ ZK proof generation failed:`, error);
      return null;
    }
  }

  /**
   * Execute liquidation with ZK proof
   */
  async executeLiquidation(trader: string, assetId: number): Promise<LiquidationResult> {
    try {
      console.log(`🗲 Executing liquidation: ${trader} asset ${assetId}`);
      
      // Step 1: Check if liquidatable
      const liquidationData = await this.checkLiquidatable(trader, assetId);
      if (!liquidationData) {
        return { success: false, error: 'Position not found' };
      }
      
      if (!liquidationData.liquidatable) {
        return { 
          success: false, 
          error: `Position not liquidatable (health factor: ${liquidationData.healthFactor.toFixed(3)})`,
          liquidationData 
        };
      }
      
      // Step 2: Generate ZK proof
      const proof = await this.generateLiquidationProof(liquidationData);
      if (!proof) {
        return { success: false, error: 'Failed to generate ZK proof', liquidationData };
      }
      
      // Step 3: Submit to contract
      const txHash = await contractManager.verifyAndLiquidate(
        assetId,
        merkleTree.getCurrentRootHex(),
        merkleTree.getCurrentRootHex(), // Same root for verification
        trader,
        liquidationData.position.size,
        liquidationData.position.margin,
        proof
      );
      
      // Step 4: Update local state
      this.updateStateAfterLiquidation(liquidationData);
      
      console.log(`✅ Liquidation executed successfully: ${txHash}`);
      
      return {
        success: true,
        txHash,
        liquidationData
      };
      
    } catch (error) {
      console.error(`❌ Liquidation execution failed:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // ====================================================================
  // 🚀 HACKATHON: UTILITY FUNCTIONS
  // ====================================================================

  /**
   * Handle negative values for ZK field arithmetic
   */
  private handleFieldModulus(value: bigint): bigint {
    if (value >= 0n) {
      return value;
    }
    // Convert negative to positive in field
    return value + this.FIELD_MODULUS;
  }

  /**
   * Convert Ethereum address to bigint
   */
  private addressToBigInt(address: string): bigint {
    const hex = address.replace('0x', '');
    return BigInt('0x' + hex);
  }

  /**
   * Format ZK proof for Solidity contract
   */
  private formatProofForSolidity(proof: any, publicSignals: string[] | number[]): ZKProof {
    return {
      a: [proof.pi_a[0].toString(), proof.pi_a[1].toString()],
      b: [
        [proof.pi_b[0][1].toString(), proof.pi_b[0][0].toString()],
        [proof.pi_b[1][1].toString(), proof.pi_b[1][0].toString()]
      ],
      c: [proof.pi_c[0].toString(), proof.pi_c[1].toString()],
      input: publicSignals.map(x => x.toString())
    };
  }

  /**
   * Get WASM file path (update this to your actual path)
   */
  private getWasmPath(): string {
    // 🚨 UPDATE THIS PATH to your actual .wasm file location
    return resolve(__dirname, "../../../circuits-synth/outputs/liquidate_js/liquidate.wasm");
  }

  /**
   * Get ZKEY file path (update this to your actual path)
   */
  private getZkeyPath(): string {
    // 🚨 UPDATE THIS PATH to your actual .zkey file location  
    return resolve(__dirname, "../../../circuits-synth/outputs/liquidate_final.zkey");
  }

  /**
   * Update local state after successful liquidation
   */
  private updateStateAfterLiquidation(liquidationData: LiquidationData): void {
    try {
      console.log(`🔄 Updating state after liquidation...`);
      
      // Remove position from database
      const key = `${liquidationData.trader.toLowerCase()}-${liquidationData.assetId}`;
      const dbData = (database as any).data;
      if (dbData.positions[key]) {
        delete dbData.positions[key];
        (database as any).saveToBackup();
        console.log(`🗑️ Position removed from database`);
      }
      
      // Remove from merkle tree
      merkleTree.removePosition(liquidationData.trader, liquidationData.assetId);
      console.log(`🌳 Position removed from merkle tree`);
      
      // Update user balance (liquidation penalty already handled by contract)
      console.log(`✅ State updated successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to update state after liquidation:`, error);
    }
  }

  // ====================================================================
  // 🚀 HACKATHON: PUBLIC QUERY FUNCTIONS  
  // ====================================================================

  /**
   * Scan all positions for liquidations (minimal version)
   */
  async scanAllLiquidations(): Promise<LiquidationData[]> {
    try {
      console.log(`🔍 Scanning all positions for liquidations...`);
      
      const allPositions = database.getAllPositions();
      const liquidatable: LiquidationData[] = [];
      
      for (const position of allPositions) {
        try {
          const liquidationData = await this.checkLiquidatable(position.trader, position.assetId);
          if (liquidationData && liquidationData.liquidatable) {
            liquidatable.push(liquidationData);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to check position ${position.trader}-${position.assetId}:`, error);
        }
      }
      
      console.log(`📊 Scan complete: ${liquidatable.length} liquidatable positions found`);
      return liquidatable;
      
    } catch (error) {
      console.error(`❌ Failed to scan for liquidations:`, error);
      return [];
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    ready: boolean;
    circuitFilesFound: boolean;
    totalPositions: number;
    liquidationThreshold: string;
  } {
    try {
      const wasmExists = require('fs').existsSync(this.getWasmPath());
      const zkeyExists = require('fs').existsSync(this.getZkeyPath());
      
      return {
        ready: wasmExists && zkeyExists,
        circuitFilesFound: wasmExists && zkeyExists,
        totalPositions: database.getAllPositions().length,
        liquidationThreshold: `${this.LIQUIDATION_THRESHOLD * 100}%`
      };
    } catch (error) {
      return {
        ready: false,
        circuitFilesFound: false,
        totalPositions: 0,
        liquidationThreshold: `${this.LIQUIDATION_THRESHOLD * 100}%`
      };
    }
  }
}

// Export singleton instance
export const zkLiquidation = new ZKLiquidationService();