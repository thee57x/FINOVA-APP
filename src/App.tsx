import React, { useState, useEffect } from 'react';
import { 
  db, 
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc,
  OperationType, handleFirestoreError
} from './firebase';
import { UserProfile, Expense, Budget, Income, CATEGORIES, INCOME_SOURCES, CURRENCIES, Currency } from './types';
import { categorizeExpense, getBudgetAdvice } from './services/geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths } from 'date-fns';
import { 
  Plus, Trash2, PieChart as PieIcon, LayoutDashboard, Settings, LogOut, 
  TrendingUp, Wallet, Sparkles, ChevronRight, AlertCircle, Download, 
  ArrowUpRight, ArrowDownRight, FileText, Table, X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// --- Components ---

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
          <AlertCircle className="w-12 h-12 text-danger mb-4" />
          <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
          <p className="text-slate-500 mb-6 max-w-md">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn-primary"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const Toast: React.FC<{ message: string; type: 'error' | 'warning' | 'success'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg = type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className={`fixed bottom-4 right-4 ${bg} text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-bottom-4 z-50`}>
      {type === 'warning' ? <AlertCircle className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="hover:opacity-70">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

const Auth: React.FC<{ onLogin: (user: UserProfile) => void; setToast: (t: any) => void }> = ({ onLogin, setToast }) => {
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      const adminUser: UserProfile = {
        uid: 'admin-user',
        displayName: 'Admin User',
        email: 'admin@local.host',
        photoURL: '',
        createdAt: new Date().toISOString(),
      };
      onLogin(adminUser);
      localStorage.setItem('fintrack_user', JSON.stringify(adminUser));
    } else {
      setToast({ message: "Invalid password.", type: 'error' });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="card max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-sky-100 rounded-2xl flex items-center justify-center mx-auto">
          <Wallet className="w-10 h-10 text-sky-600" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">FINOVA</h1>
        <p className="text-slate-500">
          Take control of your finances with AI-powered categorization and real-time budget tracking.
        </p>
        
        <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="text-left">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin123"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none transition-all"
              autoFocus
            />
          </div>
          <button 
            type="submit"
            className="w-full btn-primary py-3 font-semibold shadow-lg shadow-sky-100"
          >
            Enter Application
          </button>
        </form>
      </div>
    </div>
  );
};

const Sidebar: React.FC<{ activeTab: string; setActiveTab: (tab: string) => void; user: UserProfile; currency: string; setCurrency: (c: string) => void }> = ({ activeTab, setActiveTab, user, currency, setCurrency }) => {
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'expenses', icon: TrendingUp, label: 'Expenses' },
    { id: 'income', icon: ArrowUpRight, label: 'Income' },
    { id: 'budgets', icon: Wallet, label: 'Budgets' },
    { id: 'ai', icon: Sparkles, label: 'AI Advice' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 h-screen sticky top-0 flex-col p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
          <Wallet className="w-8 h-8 text-sky-600" />
          <span className="font-bold text-xl tracking-tight">FINOVA</span>
        </div>
        
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-sky-50 text-sky-600 font-medium' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-100 space-y-4">
          <div className="px-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Currency</label>
            <select 
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full p-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold border border-slate-200">
              {user.displayName?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('fintrack_user');
              window.location.reload();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-danger transition-colors rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Wallet className="w-6 h-6 text-sky-600" />
          <span className="font-bold text-lg tracking-tight">FINOVA</span>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="p-1 text-xs border border-slate-200 rounded outline-none focus:ring-1 focus:ring-sky-500"
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
          <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold border border-slate-200 text-xs">
            {user.displayName?.charAt(0) || 'U'}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-1 flex justify-around items-center z-40">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center p-2 rounded-lg transition-all ${
              activeTab === item.id ? 'text-sky-600' : 'text-slate-400'
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] mt-1">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'warning' | 'success' } | null>(null);
  const [currencyCode, setCurrencyCode] = useState('NGN');
  const [rates, setRates] = useState<Record<string, number>>({
    NGN: 1,
    USD: 0.00067,
    GBP: 0.00053,
    EUR: 0.00062,
  });

  const currency = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];
  const currentRate = rates[currencyCode] || 1;

  const formatCurrency = (amount: number) => {
    const converted = amount * currentRate;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.code,
      currencyDisplay: 'symbol',
    }).format(converted).replace(currency.code, currency.symbol);
  };

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/NGN');
        const data = await response.json();
        if (data && data.rates) {
          setRates({
            NGN: 1,
            USD: data.rates.USD,
            GBP: data.rates.GBP,
            EUR: data.rates.EUR,
          });
        }
      } catch (error) {
        console.error("Failed to fetch exchange rates", error);
      }
    };
    fetchRates();
    // Refresh rates every hour
    const interval = setInterval(fetchRates, 3600000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('fintrack_user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      setUser(u);
      if (u.currency) setCurrencyCode(u.currency);
    }
    setLoading(false);
  }, []);

  const handleSetCurrency = async (code: string) => {
    setCurrencyCode(code);
    if (user) {
      const updatedUser = { ...user, currency: code };
      setUser(updatedUser);
      localStorage.setItem('fintrack_user', JSON.stringify(updatedUser));
      // Optionally update in Firestore if user profile doc exists
      try {
        await setDoc(doc(db, 'users', user.uid), updatedUser, { merge: true });
      } catch (e) {
        console.error("Failed to sync currency preference", e);
      }
    }
  };

  useEffect(() => {
    if (!user) return;

    const expensesQuery = query(collection(db, 'expenses'), where('userId', '==', user.uid));
    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      setExpenses(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenses'));

    const budgetsQuery = query(collection(db, 'budgets'), where('userId', '==', user.uid));
    const unsubscribeBudgets = onSnapshot(budgetsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget));
      setBudgets(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'budgets'));

    const incomesQuery = query(collection(db, 'incomes'), where('userId', '==', user.uid));
    const unsubscribeIncomes = onSnapshot(incomesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Income));
      setIncomes(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'incomes'));

    return () => {
      unsubscribeExpenses();
      unsubscribeBudgets();
      unsubscribeIncomes();
    };
  }, [user]);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Auth onLogin={setUser} setToast={setToast} />;

  return (
    <ErrorBoundary>
      <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} currency={currencyCode} setCurrency={handleSetCurrency} />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0 pb-20 md:pb-8">
          {activeTab === 'dashboard' && <Dashboard expenses={expenses} budgets={budgets} incomes={incomes} formatCurrency={formatCurrency} />}
          {activeTab === 'expenses' && <ExpensesView expenses={expenses} userId={user.uid} budgets={budgets} setToast={setToast} formatCurrency={formatCurrency} />}
          {activeTab === 'income' && <IncomeView incomes={incomes} userId={user.uid} formatCurrency={formatCurrency} />}
          {activeTab === 'budgets' && <BudgetsView budgets={budgets} userId={user.uid} formatCurrency={formatCurrency} />}
          {activeTab === 'ai' && <AIAdviceView expenses={expenses} budgets={budgets} currencyCode={currencyCode} currencySymbol={currency.symbol} />}
        </main>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </ErrorBoundary>
  );
}

// --- Views ---

const Dashboard: React.FC<{ expenses: Expense[]; budgets: Budget[]; incomes: Income[]; formatCurrency: (amount: number) => string }> = ({ expenses, budgets, incomes, formatCurrency }) => {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const monthlyExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });

  const monthlyIncomes = incomes.filter(i => {
    const d = new Date(i.date);
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  });

  const totalSpent = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = monthlyIncomes.reduce((sum, i) => sum + i.amount, 0);
  const totalBudget = budgets
    .filter(b => b.month === currentMonth && b.year === currentYear)
    .reduce((sum, b) => sum + b.limit, 0);

  const categoryData = CATEGORIES.map(cat => {
    const spent = monthlyExpenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
    const budget = budgets.find(b => b.category === cat && b.month === currentMonth && b.year === currentYear)?.limit || 0;
    return { name: cat, spent, budget };
  }).filter(d => d.spent > 0 || d.budget > 0);

  // Budget Alerts
  const alerts = categoryData.filter(d => d.budget > 0 && d.spent > d.budget);

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Category/Source', 'Description', 'Amount'];
    const expenseRows = expenses.map(e => [format(new Date(e.date), 'yyyy-MM-dd'), 'Expense', e.category, e.description, e.amount]);
    const incomeRows = incomes.map(i => [format(new Date(i.date), 'yyyy-MM-dd'), 'Income', i.source, i.description, i.amount]);
    
    const csvContent = [headers, ...expenseRows, ...incomeRows]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `FINOVA_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text('FINOVA - Financial Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 22);

    const tableData = [
      ...expenses.map(e => [format(new Date(e.date), 'yyyy-MM-dd'), 'Expense', e.category, e.description, formatCurrency(e.amount)]),
      ...incomes.map(i => [format(new Date(i.date), 'yyyy-MM-dd'), 'Income', i.source, i.description, formatCurrency(i.amount)])
    ];

    (doc as any).autoTable({
      head: [['Date', 'Type', 'Category', 'Description', 'Amount']],
      body: tableData,
      startY: 30,
    });

    doc.save(`FINOVA_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Financial Overview</h1>
          <p className="text-slate-500">{format(new Date(), 'MMMM yyyy')}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={exportToCSV} className="flex-1 sm:flex-none btn-secondary flex items-center justify-center gap-2">
            <Table className="w-4 h-4" />
            CSV
          </button>
          <button onClick={exportToPDF} className="flex-1 sm:flex-none btn-secondary flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" />
            PDF
          </button>
        </div>
      </header>

      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-700 font-semibold">
            <AlertCircle className="w-5 h-5" />
            Budget Alerts
          </div>
          <ul className="text-sm text-red-600 space-y-1">
            {alerts.map(alert => (
              <li key={alert.name}>
                You've exceeded your <strong>{alert.name}</strong> budget by <strong>{formatCurrency(alert.spent - alert.budget)}</strong>.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="card border-l-4 border-emerald-500">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Monthly Income</p>
          <p className="text-xl md:text-2xl font-bold mt-1 text-emerald-600">+{formatCurrency(totalIncome)}</p>
        </div>
        <div className="card border-l-4 border-rose-500">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Monthly Spent</p>
          <p className="text-xl md:text-2xl font-bold mt-1 text-rose-600">-{formatCurrency(totalSpent)}</p>
        </div>
        <div className="card border-l-4 border-sky-500">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Net Balance</p>
          <p className={`text-xl md:text-2xl font-bold mt-1 ${totalIncome - totalSpent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatCurrency(totalIncome - totalSpent)}
          </p>
        </div>
        <div className="card border-l-4 border-amber-500">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Budget Status</p>
          <p className="text-xl md:text-2xl font-bold mt-1">
            {totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}%` : 'N/A'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <div className="card">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-500" />
            Spending vs Budget
          </h3>
          <div className="h-64 md:h-80 w-full relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="spent" fill="#0ea5e9" name="Spent" radius={[4, 4, 0, 0]} />
                <Bar dataKey="budget" fill="#e2e8f0" name="Budget" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-emerald-500" />
            Expense Distribution
          </h3>
          <div className="h-64 md:h-80 w-full relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="spent"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExpensesView: React.FC<{ expenses: Expense[]; userId: string; budgets: Budget[]; setToast: (t: any) => void; formatCurrency: (amount: number) => string }> = ({ expenses, userId, budgets, setToast, formatCurrency }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    try {
      const expenseAmount = parseFloat(amount);
      
      // Check budget before adding
      const catBudget = budgets.find(b => b.category === category && b.month === currentMonth && b.year === currentYear);
      const catSpent = expenses
        .filter(ex => ex.category === category && new Date(ex.date).getMonth() + 1 === currentMonth)
        .reduce((sum, ex) => sum + ex.amount, 0);

      if (catBudget && (catSpent + expenseAmount > catBudget.limit)) {
        setToast({ message: `Budget Alert: Exceeded ${category} limit!`, type: 'warning' });
      }

      await addDoc(collection(db, 'expenses'), {
        userId,
        description,
        amount: expenseAmount,
        category,
        date: new Date().toISOString(),
        aiCategorized: false
      });
      setDescription('');
      setAmount('');
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    }
  };

  const handleAiCategorize = async () => {
    if (!description || !amount) return;
    setIsAiLoading(true);
    const cat = await categorizeExpense(description, parseFloat(amount));
    setCategory(cat);
    setIsAiLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'expenses');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Expenses</h1>
        <button onClick={() => setIsAdding(!isAdding)} className="w-full sm:w-auto btn-primary flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      {isAdding && (
        <div className="card border-2 border-sky-100 animate-in fade-in slide-in-from-top-4">
          <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Description</label>
              <input 
                type="text" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="What did you buy?"
                onBlur={handleAiCategorize}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Amount (NGN)</label>
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                Category
                {isAiLoading && <Sparkles className="w-3 h-3 text-sky-500 animate-pulse" />}
              </label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 btn-primary">Save</button>
              <button type="button" onClick={() => setIsAdding(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Date</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Description</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Category</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Amount</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4 text-sm text-slate-500">
                  {format(new Date(expense.date), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4 text-sm font-medium">{expense.description}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                    {expense.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-right text-slate-900">
                  {formatCurrency(expense.amount)}
                </td>
                <td className="px-6 py-4 text-center">
                  <button 
                    onClick={() => handleDelete(expense.id)}
                    className="p-2 text-slate-400 hover:text-danger md:opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  No expenses recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const IncomeView: React.FC<{ incomes: Income[]; userId: string; formatCurrency: (amount: number) => string }> = ({ incomes, userId, formatCurrency }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState(INCOME_SOURCES[0]);

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    try {
      await addDoc(collection(db, 'incomes'), {
        userId,
        description,
        amount: parseFloat(amount),
        source,
        date: new Date().toISOString(),
      });
      setDescription('');
      setAmount('');
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'incomes');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'incomes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'incomes');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Income</h1>
        <button onClick={() => setIsAdding(!isAdding)} className="btn-primary flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-5 h-5" />
          Add Income
        </button>
      </div>

      {isAdding && (
        <div className="card border-2 border-emerald-100 animate-in fade-in slide-in-from-top-4">
          <form onSubmit={handleAddIncome} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Description</label>
              <input 
                type="text" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Salary, Bonus, etc."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Amount (NGN)</label>
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Source</label>
              <select 
                value={source} 
                onChange={(e) => setSource(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {INCOME_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 btn-primary bg-emerald-600 hover:bg-emerald-700">Save</button>
              <button type="button" onClick={() => setIsAdding(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Date</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Description</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600">Source</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Amount</th>
              <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {incomes.map((income) => (
              <tr key={income.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4 text-sm text-slate-500">
                  {format(new Date(income.date), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4 text-sm font-medium">{income.description}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-600 text-xs font-medium rounded-full">
                    {income.source}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-right text-emerald-600">
                  +{formatCurrency(income.amount)}
                </td>
                <td className="px-6 py-4 text-center">
                  <button 
                    onClick={() => handleDelete(income.id)}
                    className="p-2 text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {incomes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  No income records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BudgetsView: React.FC<{ budgets: Budget[]; userId: string; formatCurrency: (amount: number) => string }> = ({ budgets, userId, formatCurrency }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [limit, setLimit] = useState('');

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const monthlyBudgets = budgets.filter(b => b.month === currentMonth && b.year === currentYear);

  const handleSetBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limit) return;

    try {
      const existing = budgets.find(b => b.category === category && b.month === currentMonth && b.year === currentYear);
      if (existing) {
        await updateDoc(doc(db, 'budgets', existing.id), { limit: parseFloat(limit) });
      } else {
        await addDoc(collection(db, 'budgets'), {
          userId,
          category,
          limit: parseFloat(limit),
          month: currentMonth,
          year: currentYear
        });
      }
      setLimit('');
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'budgets');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Budgets</h1>
        <button onClick={() => setIsAdding(!isAdding)} className="w-full sm:w-auto btn-primary flex items-center justify-center gap-2">
          <Wallet className="w-5 h-5" />
          Set Budget
        </button>
      </div>

      {isAdding && (
        <div className="card border-2 border-emerald-100 animate-in fade-in slide-in-from-top-4">
          <form onSubmit={handleSetBudget} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Category</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Monthly Limit (NGN)</label>
              <input 
                type="number" 
                value={limit} 
                onChange={(e) => setLimit(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="0.00"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 btn-primary bg-emerald-600 hover:bg-emerald-700">Set Limit</button>
              <button type="button" onClick={() => setIsAdding(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {monthlyBudgets.map((budget) => (
          <div key={budget.id} className="card border-t-4 border-emerald-500">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-lg">{budget.category}</h3>
              <span className="text-xs font-medium text-slate-400 uppercase">{format(new Date(budget.year, budget.month - 1), 'MMM yyyy')}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Monthly Limit</span>
                <span className="font-bold">{formatCurrency(budget.limit)}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        ))}
        {monthlyBudgets.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400">
            No budgets set for this month.
          </div>
        )}
      </div>
    </div>
  );
};

const AIAdviceView: React.FC<{ expenses: Expense[]; budgets: Budget[]; currencyCode: string; currencySymbol: string }> = ({ expenses, budgets, currencyCode, currencySymbol }) => {
  const [advice, setAdvice] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const fetchAdvice = async () => {
    setLoading(true);
    const result = await getBudgetAdvice(expenses.slice(0, 20), budgets, currencyCode, currencySymbol);
    setAdvice(result);
    setLoading(false);
  };

  useEffect(() => {
    if (expenses.length > 0) fetchAdvice();
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-sky-500" />
            AI Budget Assistant
          </h1>
          <p className="text-slate-500">Personalized financial insights powered by Gemini AI.</p>
        </div>
        <button 
          onClick={fetchAdvice} 
          disabled={loading}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Sparkles className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Advice
        </button>
      </header>

      <div className="card bg-gradient-to-br from-sky-50 to-white border border-sky-100 min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 py-20">
            <div className="w-12 h-12 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium">Analyzing your spending patterns...</p>
          </div>
        ) : advice ? (
          <div className="prose prose-sky max-w-none">
            <ReactMarkdown>{advice}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-slate-300" />
            <p className="text-slate-500">Add some expenses to get personalized advice.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-emerald-50 border-emerald-100">
          <h4 className="font-semibold text-emerald-800 mb-2 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Smart Tip
          </h4>
          <p className="text-sm text-emerald-700">
            AI categorization helps you see exactly where your money goes without manual tagging. Just type a description!
          </p>
        </div>
        <div className="card bg-amber-50 border-amber-100">
          <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Budget Alert
          </h4>
          <p className="text-sm text-amber-700">
            Set monthly limits for each category to receive real-time warnings when you're close to exceeding them.
          </p>
        </div>
      </div>
    </div>
  );
};
