// PKR currency formatting
export const formatPKR = (amount: number): string => {
  const n = Number(amount);
  return `₨ ${(isNaN(n) ? 0 : n).toLocaleString('en-PK')}`;
};

// CNIC auto-format: XXXXX-XXXXXXX-X
export const formatCNIC = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
};

export const validateCNIC = (cnic: string): boolean => {
  return /^\d{5}-\d{7}-\d{1}$/.test(cnic);
};

// Phone auto-format: 03XX-XXXXXXX
export const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

export const validatePhone = (phone: string): boolean => {
  return /^03\d{2}-\d{7}$/.test(phone);
};

// Date formatting
export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
};
