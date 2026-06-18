export type Provider = 'openai' | 'gemini' | 'anthropic';
export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';
export type SensitivityLevel = 'high' | 'medium' | 'low';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: Provider;
  model?: string;
  blocked?: boolean;
  findings?: Finding[];
  timestamp: number;
}

export interface Finding {
  type: string;
  severity: Severity;
  description: string;
}

export interface ModelInfo {
  id: string;
  label: string;
}

export interface Config {
  providers: Provider[];
  models: Record<Provider, ModelInfo[]>;
  defaultModels: Record<Provider, string>;
  sensitivity: SensitivityLevel;
  forbiddenKeywords: string[];
}
