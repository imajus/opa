import { Contract } from 'ethers';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function nonces(address) view returns (uint256)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
  'function version() view returns (string)',
];

/**
 * Create an ERC20 contract instance
 *
 * @param {string} address - Address of the ERC20 contract
 * @param {import('ethers').Signer} [signer] - Signer to use for the contract
 *
 * @returns {import('ethers').Contract} ERC20 contract instance
 */
export default function createERC20Contract(address, signer = null) {
  return new Contract(address, ERC20_ABI, signer);
}
