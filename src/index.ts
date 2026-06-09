import 'dotenv/config';
import { createPublicClient, http, formatEther, isAddress } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://ethereum-rpc.publicnode.com'),
});

const WALLETS = [
  { label: 'vitalik.eth' },
  { label: 'binance7.eth' },
  { label: '0x00000000219ab540356cBB839Cbe05303d7705Fa' },
];

async function fetchEthPrice(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    );
    if (!res.ok) return null;
    const data = await res.json() as { ethereum?: { usd?: number } };
    return data.ethereum?.usd ?? null;
  } catch {
    return null;
  }
}

async function resolveAddress(label: string): Promise<`0x${string}` | null> {
  if (isAddress(label)) return label as `0x${string}`;
  try {
    return await client.getEnsAddress({ name: label });
  } catch {
    return null;
  }
}

interface WalletResult {
  label: string;
  address: string;
  balance: number | null;
  error?: string;
}

async function fetchWallet(label: string): Promise<WalletResult> {
  const address = await resolveAddress(label);
  if (!address) return { label, address: '—', balance: null, error: 'ENS resolution failed' };

  try {
    const balanceWei = await client.getBalance({ address });
    return { label, address, balance: parseFloat(formatEther(balanceWei)) };
  } catch {
    return { label, address, balance: null, error: 'balance fetch failed' };
  }
}

function padL(s: string, n: number) { return s.padStart(n); }
function padR(s: string, n: number) { return s.padEnd(n); }

async function main() {
  const [results, ethPrice] = await Promise.all([
    Promise.all(WALLETS.map(w => fetchWallet(w.label))),
    fetchEthPrice(),
  ]);

  const colLabel   = Math.max(11, ...results.map(r => r.label.length));
  const colAddress = 42;
  const colBalance = 16;
  const colValue   = 20;

  const inner = colLabel + colAddress + colBalance + colValue + 3 * 3 + 2; // 3 separators + 2 padding
  const sep = '─'.repeat(inner);

  const row = (label: string, address: string, balance: string, value: string) =>
    `│ ${padR(label, colLabel)} │ ${padR(address, colAddress)} │ ${padL(balance, colBalance)} │ ${padL(value, colValue)} │`;

  const divider = `├─${sep}─┤`;

  console.log(`╭─${sep}─╮`);
  console.log(row('Wallet', 'Address', 'Balance (ETH)', 'Value (USD)'));
  console.log(divider);

  for (const r of results) {
    let balanceStr: string;
    let valueStr: string;

    if (r.error) {
      balanceStr = `[${r.error}]`;
      valueStr = '—';
    } else {
      balanceStr = r.balance!.toFixed(4);
      valueStr = ethPrice !== null
        ? `~ $${(r.balance! * ethPrice).toFixed(2)}`
        : 'N/A';
    }

    console.log(row(r.label, r.address, balanceStr, valueStr));
  }

  console.log(`╰─${sep}─╯`);

  if (ethPrice === null) {
    console.log('\n  (price feed unavailable — running without network access to price API)');
  }
}

main().catch(console.error);
