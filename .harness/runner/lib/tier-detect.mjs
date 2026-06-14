export function detectTier(requirement, config) {
  const rules = config.tier_detection?.rules || [];
  for (const rule of rules) {
    for (const pattern of rule.patterns || []) {
      if (requirement.includes(pattern)) return rule.tier;
    }
  }
  return config.tier_detection?.default || 'M';
}
