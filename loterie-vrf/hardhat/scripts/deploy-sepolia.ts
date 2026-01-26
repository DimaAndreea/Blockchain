import "dotenv/config";
import hre from "hardhat";

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function requireHexAddress(name: string, value: string): `0x${string}` {
  if (!value?.startsWith("0x") || value.length !== 42) {
    throw new Error(`${name} must be a valid address (0x + 40 hex). Got: ${value}`);
  }
  return value as `0x${string}`;
}

function requireBytes32(name: string, value: string): `0x${string}` {
  if (!value?.startsWith("0x") || value.length !== 66) {
    throw new Error(`${name} must be a valid bytes32 (0x + 64 hex). Got: ${value}`);
  }
  return value as `0x${string}`;
}

function requireUint256(name: string, value: string): bigint {
  // acceptă doar cifre (subscriptionId e un număr zecimal mare)
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a decimal uint256 string. Got: ${value}`);
  }
  return BigInt(value);
}

async function main() {
  const { viem } = await hre.network.connect();
  const [deployer] = await viem.getWalletClients();

  console.log("Deploying with:", deployer.account.address);

  // ----------------------------
  // Lottery params
  // ----------------------------
  const ticketPrice = 10_000_000_000_000_000n; // 0.01 ETH
  const interval = 120n; // 60 sec

  // ----------------------------
  // VRF params (din .env)
  // ----------------------------
  const subscriptionId = requireUint256(
    "SEPOLIA_SUBSCRIPTION_ID",
    reqEnv("SEPOLIA_SUBSCRIPTION_ID")
  );

  const vrfCoordinator = requireHexAddress(
    "SEPOLIA_VRF_COORDINATOR",
    reqEnv("SEPOLIA_VRF_COORDINATOR")
  );

  const keyHash = requireBytes32(
    "SEPOLIA_VRF_KEYHASH",
    reqEnv("SEPOLIA_VRF_KEYHASH")
  );

  console.log("VRF Coordinator:", vrfCoordinator);
  console.log("Subscription ID:", subscriptionId.toString());
  console.log("KeyHash:", keyHash);

  // ----------------------------
  // Deploy Lottery
  // ----------------------------
  const lottery = await viem.deployContract("Lottery", [
    ticketPrice,
    interval,
    vrfCoordinator,
    subscriptionId,
    keyHash,
  ]);

  console.log("Lottery deployed at:", lottery.address);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
