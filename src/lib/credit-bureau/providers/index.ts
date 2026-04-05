/**
 * Credit Bureau Provider Factory
 * Manages credit bureau provider instances and selection
 */

import type {
  ICreditBureauProvider,
  CreditBureauProviderConfig,
  BureauName
} from '../types';
import { MockCreditBureauProvider } from './mock-provider';

// Provider registry
const providers: Map<string, ICreditBureauProvider> = new Map();

/**
 * Get or create a provider instance
 */
export function getProvider(
  config: CreditBureauProviderConfig
): ICreditBureauProvider {
  const key = `${config.provider_code}-${config.is_mock ? 'mock' : 'real'}`;

  if (providers.has(key)) {
    return providers.get(key)!;
  }

  let provider: ICreditBureauProvider;

  if (config.is_mock) {
    // Use mock provider
    provider = new MockCreditBureauProvider(config.provider_code as BureauName);
  } else {
    // TODO: Implement real providers when APIs are available
    // For now, fall back to mock
    console.warn(
      `Real provider for ${config.provider_code} not implemented, using mock`
    );
    provider = new MockCreditBureauProvider(config.provider_code as BureauName);
  }

  providers.set(key, provider);
  return provider;
}

/**
 * Get all available mock providers for testing
 */
export function getAllMockProviders(): ICreditBureauProvider[] {
  return [
    new MockCreditBureauProvider('CIBIL'),
    new MockCreditBureauProvider('EXPERIAN'),
    new MockCreditBureauProvider('EQUIFAX'),
    new MockCreditBureauProvider('CRIF')
  ];
}

/**
 * Create a default mock config for testing
 */
export function createMockProviderConfig(
  bureauName: BureauName = 'CIBIL'
): CreditBureauProviderConfig {
  return {
    id: `mock-${bureauName.toLowerCase()}`,
    provider_code: bureauName,
    provider_type: 'CREDIT_BUREAU',
    provider_name: `${bureauName} (Mock)`,
    api_endpoint: null,
    api_key_encrypted: null,
    api_secret_encrypted: null,
    config_json: { is_mock: true },
    is_active: true,
    is_mock: true,
    priority: 1,
    rate_limit_per_minute: 60,
    rate_limit_per_day: 1000,
    cost_per_call: 0
  };
}

export { MockCreditBureauProvider };
