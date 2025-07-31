/**
 * 1Inch API TypeScript Definitions
 * Based on OpenAPI specifications for Token and Balance APIs
 */

// ============================================================================
// Common Types
// ============================================================================

interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}

// ============================================================================
// Token API Types (based on Token API OpenAPI spec)
// ============================================================================

interface TagDto {
  provider: string;
  value: string;
}

interface VersionDto {
  major: number;
  minor: number;
  patch: number;
}

interface TokenInfoDto {
  address: string;
  chainId: number;
  decimals: number;
  extensions?: Record<string, any>;
  logoURI: string;
  name: string;
  symbol: string;
  tags: string[];
}

interface ProviderTokenDto {
  chainId: number;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  providers: string[];
  eip2612?: boolean;
  isFoT?: boolean;
  displayedSymbol?: string;
  tags: string[];
}

interface TokenDto {
  chainId: number;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  logoURI?: string;
  rating: number;
  eip2612?: boolean;
  isFoT?: boolean;
  tags: TagDto[];
  providers: string[];
}

interface TokenListResponseDto {
  keywords: string[];
  logoURI: string;
  name: string;
  tags: Record<string, TagDto>;
  tags_order: string[];
  timestamp: string;
  tokens: TokenInfoDto[];
  version: VersionDto;
}

// Token API method options
interface TokenApiOptions {
  provider?: string;
  country?: string;
  cfIpCountry?: string;
}

interface SearchTokenOptions extends TokenApiOptions {
  query?: string;
  ignoreListed?: boolean;
  onlyPositiveRating?: boolean;
  limit?: number;
}

interface MultiChainSearchOptions extends SearchTokenOptions {
  country: string; // Required for multi-chain search
  onlyPositiveRating: boolean; // Required for multi-chain search
}

// Token API return types
type TokensMap = Record<string, ProviderTokenDto>;
type CustomTokensMap = Record<string, TokenInfoDto>;

// ============================================================================
// Balance API Types (based on Balance API OpenAPI spec)
// ============================================================================

interface CustomTokensRequest {
  tokens: string[];
}

interface CustomTokensAndWalletsRequest {
  tokens: string[];
  wallets: string[];
}

interface TokenBalance {
  balance: string;
  allowance: string;
}

interface AggregatedBalancesAndAllowancesResponse {
  decimals: number;
  symbol: string;
  tags: string[];
  address: string;
  name: string;
  logoURI: string;
  isCustom: boolean;
  wallets: Record<string, any>;
  type: string;
  tracked?: boolean;
}

// Balance API method options
interface AggregatedBalancesOptions {
  wallets: string[];
  filterEmpty?: boolean;
}

interface WalletOverview {
  balances: Record<string, string>;
  allowances: Record<string, string>;
  walletAddress: string;
  spender: string;
}

// Balance API return types
type BalancesMap = Record<string, string>;
type AllowancesMap = Record<string, string>;
type BalancesAndAllowancesMap = Record<string, TokenBalance>;
type MultiWalletBalancesMap = Record<string, BalancesMap>;

// ============================================================================
// Price API Types (based on Price API OpenAPI spec)
// ============================================================================

type SupportedCurrency =
  | 'USD'
  | 'AED'
  | 'ARS'
  | 'AUD'
  | 'BDT'
  | 'BHD'
  | 'BMD'
  | 'BRL'
  | 'CAD'
  | 'CHF'
  | 'CLP'
  | 'CNY'
  | 'CZK'
  | 'DKK'
  | 'EUR'
  | 'GBP'
  | 'HKD'
  | 'HUF'
  | 'IDR'
  | 'ILS'
  | 'INR'
  | 'JPY'
  | 'KRW'
  | 'KWD'
  | 'LKR'
  | 'MMK'
  | 'MXN'
  | 'MYR'
  | 'NGN'
  | 'NOK'
  | 'NZD'
  | 'PHP'
  | 'PKR'
  | 'PLN'
  | 'RUB'
  | 'SAR'
  | 'SEK'
  | 'SGD'
  | 'THB'
  | 'TRY'
  | 'TWD'
  | 'UAH'
  | 'VEF'
  | 'VND'
  | 'ZAR';

interface GetPricesRequestDto {
  tokens: string[];
  currency?: SupportedCurrency;
}

interface CurrenciesResponseDto {
  codes: string[];
}

interface PriceErrorMeta {
  type: string;
  value: string;
}

interface PriceError {
  error: 'Bad Request';
  description: string;
  statusCode: 400;
  meta: PriceErrorMeta[];
}

// Price API method options
interface PriceApiOptions {
  currency?: SupportedCurrency;
}

// Price API return types
type PricesMap = Record<string, string>;

// ============================================================================
// Domains API Types (based on Domains API OpenAPI spec)
// ============================================================================

interface ProviderResponse {
  protocol: string;
  address: string;
  checkUrl: string;
}

interface ResponseV2Dto {
  result: ProviderResponse;
}

interface ProviderReverseResponse {
  protocol: string;
  domain: string;
  checkUrl: string;
}

interface ResponseReverseV2Dto {
  result: ProviderReverseResponse;
}

interface ResponseBatchV2ReturnTypeDto {
  [address: string]: ProviderReverseResponse[];
}

interface ProviderResponseWithAvatar {
  protocol: string;
  domain: string;
  address: string;
  avatar: any | null;
}

interface AvatarsResponse {
  result: ProviderResponseWithAvatar;
}

// Domains API return types
type DomainLookupResult = ResponseV2Dto;
type ReverseLookupResult = ResponseReverseV2Dto;
type BatchReverseLookupResult = ResponseBatchV2ReturnTypeDto;
type AvatarResult = AvatarsResponse;

// ============================================================================
// Token Details API Types (based on Token Details API OpenAPI spec)
// ============================================================================

type ChartProvider = 'coinmarketcap' | 'coingecko' | 'quantor';
type TimeInterval =
  | '5m'
  | '10m'
  | '15m'
  | '30m'
  | '50m'
  | '1h'
  | '2h'
  | '3h'
  | '4h'
  | '6h'
  | '12h'
  | '24h'
  | '2d'
  | '3d'
  | '7d'
  | '14d'
  | '15d'
  | '30d'
  | '60d'
  | '90d'
  | '365d'
  | 'max';

interface SocialLink {
  name: string;
  url: string;
  handle: string;
}

interface AssetsResponse {
  name: string;
  website: string;
  sourceCode: string;
  whitePaper: string;
  description: string;
  shortDescription: string;
  research: string;
  explorer: string;
  social_links: SocialLink;
}

interface DetailsResponse {
  provider: string;
  providerURL: string;
  vol24: number;
  marketCap: number;
  circulatingSupply: number;
  totalSupply: number;
}

interface InfoDataResponse {
  assets: AssetsResponse;
  details: DetailsResponse;
}

interface ChartPointResponse {
  t: number; // unix time at sec
  v: number; // price at usd
}

interface ChartDataResponse {
  d: ChartPointResponse[]; // Chart data
  p: string; // Chart provider (optional)
}

interface TokenPriceChangeResponseDto {
  inUSD: number;
  inPercent: number;
}

interface GetTokenListPriceRequestDto {
  tokenAddresses: string[];
  interval: TimeInterval;
}

interface TokenListPriceChangeResponseDto {
  tokenAddress: string;
  inUSD: number;
  inPercent: number;
}

// Token Details API method options
interface TokenDetailsOptions {
  provider?: ChartProvider;
}

interface ChartRangeOptions extends TokenDetailsOptions {
  from: number; // unix time at sec
  to: number; // unix time at sec
  fromTime?: number; // from time (optional)
}

interface ChartIntervalOptions extends TokenDetailsOptions {
  interval: TimeInterval;
  fromTime?: number; // from time (optional)
}

// Token Details API return types
type TokenDetailsResult = InfoDataResponse;
type ChartDataResult = ChartDataResponse;
type PriceChangeResult = TokenPriceChangeResponseDto;
type TokenListPriceChangeResult = TokenListPriceChangeResponseDto[];

// ============================================================================
// API Call Types
// ============================================================================

interface ApiCallOptions {
  params?: Record<string, any>;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
}

// ============================================================================
// Utility Types
// ============================================================================

type ChainId = number;
type Address = string;
type TokenAddress = string;
type WalletAddress = string;
type SpenderAddress = string;
