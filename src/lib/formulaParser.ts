// Extremely simple boolean expression parser for screener
// Supports: >, <, >=, <=, =, AND, OR
// e.g. "peRatio < 20 AND roe > 15"

export function evaluateFormula(formula: string, data: Record<string, any>): boolean {
  if (!formula || formula.trim() === '') return true;

  try {
    // 1. Tokenize keeping AND/OR as split points
    // First we evaluate AND, then OR (OR has lowest precedence)
    
    // We'll just do a very simple split by OR, then by AND
    const orParts = formula.split(/\s+OR\s+/i);
    
    // An OR part is true if ANY of its AND sub-parts are all true
    for (const orPart of orParts) {
      const andParts = orPart.split(/\s+AND\s+/i);
      
      let andResult = true;
      for (const condition of andParts) {
        if (!evaluateCondition(condition.trim(), data)) {
          andResult = false;
          break;
        }
      }
      
      if (andResult) return true; // If one OR branch is true, the whole formula is true
    }
    
    return false;
  } catch (err) {
    return false; // Fail safe
  }
}

function evaluateCondition(condition: string, data: Record<string, any>): boolean {
  // Regex to match: [key] [operator] [value]
  const match = condition.match(/^([a-zA-Z0-9_]+)\s*(>=|<=|>|<|==|=|!=)\s*([0-9.-]+)$/);
  if (!match) return false; // Invalid condition format

  const [, key, operator, valueStr] = match;
  const value = parseFloat(valueStr);
  const dataValue = data[key];

  if (dataValue === undefined || dataValue === null) return false;

  const dataNum = parseFloat(dataValue);
  if (isNaN(dataNum)) return false;

  switch (operator) {
    case '>': return dataNum > value;
    case '<': return dataNum < value;
    case '>=': return dataNum >= value;
    case '<=': return dataNum <= value;
    case '=': 
    case '==': return dataNum === value;
    case '!=': return dataNum !== value;
    default: return false;
  }
}
