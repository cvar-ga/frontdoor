export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Finding {
  type: string;
  severity: Severity;
  description: string;
}

export interface ScanResult {
  clean: boolean;
  findings: Finding[];
}

interface Rule {
  type: string;
  severity: Severity;
  description: string;
  pattern: RegExp;
  validate?: (match: string) => boolean;
}

const RULES: Rule[] = [
  // ── HIGH severity ───────────────────────────────────────────────────────────
  {
    type: 'PRIVATE_KEY',
    severity: 'HIGH',
    description: 'PEM private key',
    pattern: /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE KEY-----/i,
  },
  {
    type: 'SSN',
    severity: 'HIGH',
    description: 'US Social Security Number',
    // Require surrounding non-digit context to reduce false positives
    pattern: /(?<!\d)(?:ssn|social security)?[\s:]*\b([0-9]{3})[-\s]([0-9]{2})[-\s]([0-9]{4})\b(?!\d)/i,
    validate: (m) => {
      // Reject obvious test values like 000-00-0000, 123-45-6789
      const digits = m.replace(/\D/g, '');
      if (/^0{9}$/.test(digits)) return false;
      if (digits === '123456789') return false;
      if (/^(\d)\1{8}$/.test(digits)) return false;
      return true;
    },
  },
  {
    type: 'CREDIT_CARD',
    severity: 'HIGH',
    description: 'Credit / debit card number',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/,
    validate: luhn,
  },
  {
    type: 'AWS_SECRET_KEY',
    severity: 'HIGH',
    description: 'AWS secret access key',
    pattern: /(?:aws.{0,20})?(?:secret.{0,10})?["\s]?([A-Za-z0-9/+=]{40})["\s]?/,
    // Pair check: only flag when AWS key ID is nearby
    validate: (_m, ctx) => /AKIA[0-9A-Z]{16}/.test(ctx),
  },

  // ── MEDIUM severity ─────────────────────────────────────────────────────────
  {
    type: 'AWS_ACCESS_KEY_ID',
    severity: 'MEDIUM',
    description: 'AWS access key ID',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    type: 'OPENAI_KEY',
    severity: 'MEDIUM',
    description: 'OpenAI API key',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9]{32,}\b/,
  },
  {
    type: 'ANTHROPIC_KEY',
    severity: 'MEDIUM',
    description: 'Anthropic API key',
    pattern: /\bsk-ant-[A-Za-z0-9\-_]{32,}\b/,
  },
  {
    type: 'GOOGLE_API_KEY',
    severity: 'MEDIUM',
    description: 'Google API key',
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/,
  },
  {
    type: 'GENERIC_SECRET',
    severity: 'MEDIUM',
    description: 'Inline password or secret assignment',
    pattern: /(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S{8,}/i,
  },
  {
    type: 'JWT',
    severity: 'MEDIUM',
    description: 'JSON Web Token',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    type: 'PRIVATE_IP',
    severity: 'MEDIUM',
    description: 'Internal RFC-1918 IP address',
    pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/,
  },

  // ── LOW severity ─────────────────────────────────────────────────────────────
  {
    type: 'PHONE_NUMBER',
    severity: 'LOW',
    description: 'US phone number',
    pattern: /(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)/,
  },
  {
    type: 'EMAIL_ADDRESS',
    severity: 'LOW',
    description: 'Email address',
    pattern: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/,
  },
];

function luhn(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function severityValue(s: Severity): number {
  return s === 'HIGH' ? 3 : s === 'MEDIUM' ? 2 : 1;
}

export function scan(
  text: string,
  sensitivity: Severity,
  customKeywords: string[],
): ScanResult {
  const threshold = severityValue(sensitivity);
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    if (severityValue(rule.severity) < threshold) continue;
    const match = rule.pattern.exec(text);
    if (!match) continue;
    if (rule.validate && !rule.validate(match[0], text)) continue;
    if (!seen.has(rule.type)) {
      seen.add(rule.type);
      findings.push({
        type: rule.type,
        severity: rule.severity,
        description: rule.description,
      });
    }
  }

  for (const kw of customKeywords) {
    if (!kw.trim()) continue;
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(text) && !seen.has(`KEYWORD:${kw}`)) {
      seen.add(`KEYWORD:${kw}`);
      findings.push({
        type: 'FORBIDDEN_KEYWORD',
        severity: 'HIGH',
        description: `Forbidden keyword matched: "${kw}"`,
      });
    }
  }

  return { clean: findings.length === 0, findings };
}
