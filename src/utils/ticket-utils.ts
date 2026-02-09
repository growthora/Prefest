export const normalizeTicketCode = (code: string): string => {
  if (!code) return '';
  // Remove all whitespace (including non-breaking spaces), convert to uppercase
  return code.toString().trim().toUpperCase().replace(/\s+/g, '');
};

export const validateTicketCodeFormat = (code: string): boolean => {
  const normalized = normalizeTicketCode(code);
  // Format: PF-XXXX-XXXX (PF prefix, followed by two groups of 4 alphanumeric chars)
  const regex = /^PF-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return regex.test(normalized);
};

export const extractQrCodeValue = (detectedCodes: any[]): string | null => {
  if (!detectedCodes || detectedCodes.length === 0) return null;
  
  const codeObj = detectedCodes[0];
  
  // Try different properties that might exist depending on the scanner library version/platform
  const value = codeObj.rawValue || codeObj.text || (typeof codeObj === 'string' ? codeObj : null);
  
  return value ? value.toString() : null;
};
