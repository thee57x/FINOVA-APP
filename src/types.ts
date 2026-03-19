export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt: string;
  currency?: string;
}

export interface Currency {
  code: string;
  symbol: string;
  rate: number; // Rate relative to Naira (NGN)
}

export const CURRENCIES: Currency[] = [
  { code: 'NGN', symbol: '₦', rate: 1 },
  { code: 'USD', symbol: '$', rate: 0.00067 }, // Example rate
  { code: 'GBP', symbol: '£', rate: 0.00053 }, // Example rate
  { code: 'EUR', symbol: '€', rate: 0.00062 }, // Example rate
];

export interface Expense {
  id: string;
  userId: string;
  amount: number;
  category: string;
  date: string;
  description: string;
  aiCategorized: boolean;
}

export interface Budget {
  id: string;
  userId: string;
  category: string;
  limit: number;
  month: number;
  year: number;
}

export interface Income {
  id: string;
  userId: string;
  amount: number;
  source: string;
  date: string;
  description: string;
}

export const CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Health & Fitness',
  'Bills & Utilities',
  'Travel',
  'Education',
  'Gifts & Donations',
  'Investments',
  'Others'
];

export const INCOME_SOURCES = [
  'Salary',
  'Freelance',
  'Investment',
  'Gift',
  'Business',
  'Other'
];
