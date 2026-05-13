/**
 * Centralized type exports
 */

export * from './DAO';
export * from './Proposal';
export * from './Org';
export * from './Raise';
export * from './RaiseView';
export * from './display';

/**
 * Common token display info for inputs/selectors.
 */
export interface Token {
  name: string;
  symbol: string;
  coinType?: string;
  image: string;
  balance: number;
}

/**
 * Coin metadata display info (derived from DAO coin metadata).
 */
export interface TokenInfo {
  type: string;
  symbol: string;
  decimals: number;
}
