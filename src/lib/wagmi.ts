import { createConfig, http, fallback } from 'wagmi';
import { monad } from 'viem/chains';
import { injected, walletConnect } from 'wagmi/connectors';

export const CHOG_NFT = (process.env.NEXT_PUBLIC_CHOG_NFT_ADDRESS || '0xc96d31F8626c6D03Fae5dCD3d61e3FB9F4a73763') as `0x${string}`;
export const CHOG_TOKEN = (process.env.NEXT_PUBLIC_CHOG_TOKEN_ADDRESS || '0x350035555E10d9AfAF1566AaebfCeD5BA6C27777') as `0x${string}`;
export const SHOP_ADDRESS = (process.env.NEXT_PUBLIC_SHOP_ADDRESS || '') as `0x${string}` | '';
export const SEASONS_ADDRESS = (process.env.NEXT_PUBLIC_SEASONS_ADDRESS || '') as `0x${string}` | '';
const WC_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';
const RPC = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://rpc.monad.xyz';

export const wagmiConfig = createConfig({
  chains: [monad],
  connectors: [
    injected({ shimDisconnect: true }),
    ...(WC_ID ? [walletConnect({ projectId: WC_ID, showQrModal: true, metadata: { name: 'Chog Arena', description: 'Your Chog is your fighter.', url: 'https://chogarena.xyz', icons: [] } })] : []),
  ],
  transports: { [monad.id]: fallback([http(RPC), http('https://rpc.monad.xyz')]) },
  ssr: true,
});

export const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }, { name: 's', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 's', type: 'address' }, { name: 'v', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

export const shopAbi = [
  { type: 'function', name: 'buy', stateMutability: 'nonpayable', inputs: [{ name: 'itemId', type: 'uint256' }, { name: 'quantity', type: 'uint32' }, { name: 'maxTotal', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'items', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ name: 'price', type: 'uint128' }, { name: 'supply', type: 'uint32' }, { name: 'sold', type: 'uint32' }, { name: 'maxPerWallet', type: 'uint32' }, { name: 'active', type: 'bool' }, { name: 'botId', type: 'uint256' }] },
] as const;

export const seasonsAbi = [
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [{ name: 'seasonId', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }], outputs: [] },
  { type: 'function', name: 'hasClaimed', stateMutability: 'view', inputs: [{ name: 's', type: 'uint256' }, { name: 'a', type: 'address' }], outputs: [{ type: 'bool' }] },
  {
    type: 'function', name: 'seasons', stateMutability: 'view', inputs: [{ name: 's', type: 'uint256' }],
    outputs: [{ name: 'start', type: 'uint64' }, { name: 'end', type: 'uint64' }, { name: 'claimDeadline', type: 'uint64' }, { name: 'prizeRoot', type: 'bytes32' }, { name: 'prizePool', type: 'uint128' }, { name: 'claimed', type: 'uint128' }],
  },
  {
    type: 'function', name: 'recordMatch', stateMutability: 'nonpayable',
    inputs: [
      { name: 'r', type: 'tuple', components: [
        { name: 'seasonId', type: 'uint256' }, { name: 'tokenId', type: 'uint256' }, { name: 'player', type: 'address' }, { name: 'won', type: 'bool' },
        { name: 'score', type: 'uint32' }, { name: 'matchId', type: 'bytes32' }, { name: 'deadline', type: 'uint64' },
      ] },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;
