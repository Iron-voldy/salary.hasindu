const STORAGE_KEY = 'moneyMapDataV2';
const defaultState = {
  accounts: [
    { name: 'HNB', purpose: 'Daily & personal spending', balance: 0, className: 'bank-hnb', short: 'HNB' },
    { name: 'BOC', purpose: 'Savings • do not spend', balance: 0, className: 'bank-boc', short: 'BOC' },
    { name: 'Commercial Bank', purpose: 'Salary & other income', balance: 0, className: 'bank-commercial', short: 'CB' }
  ],
  goal: { target: 400000, saved: 0, deadline: '2027-02-28' },
  transactions: [
    { id: 1, description: 'Monthly salary', type: 'income', amount: 145000, account: 'Commercial Bank', category: 'Salary', date: new Date().toISOString().slice(0, 8) + '10' },
    { id: 2, description: 'Boarding fee', type: 'expense', amount: 11000, account: 'HNB', category: 'Boarding', date: new Date().toISOString().slice(0, 8) + '11' },
    { id: 3, description: 'Utilities', type: 'expense', amount: 26000, account: 'HNB', category: 'Utilities', date: new Date().toISOString().slice(0, 8) + '12' },
    { id: 4, description: 'AI tools', type: 'expense', amount: 10000, account: 'HNB', category: 'AI tools', date: new Date().toISOString().slice(0, 8) + '13' }
  ],
  theme: 'dark'
};

let state;
try { state = { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }; } catch { state = structuredClone(defaultState); }
state.accounts ||= defaultState.accounts;
state.transactions ||= defaultState.transactions;
state.goal ||= defaultState.goal;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const money = (value, compact = false) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0, notation: compact ? 'compact' : 'standard' }).format(value).replace('LKR', 'LKR ');
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const currentMonth = new Date().toISOString().slice(0, 7);

function render() {
  const monthly = state.transactions.filter(t => t.date.startsWith(currentMonth));
  const income = monthly.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthly.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const total = state.accounts.reduce((s, a) => s + Number(a.balance), 0);
  const now = new Date();
  const deadline = new Date(state.goal.deadline + 'T23:59:59');
  const monthsLeft = Math.max(1, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24 * 30.44)));
  const remaining = Math.max(0, state.goal.target - state.goal.saved);
  const monthlyNeeded = Math.ceil(remaining / monthsLeft);
  const safe = Math.max(0, income - expense - monthlyNeeded);
  const percent = Math.min(100, Math.round((state.goal.saved / state.goal.target) * 100) || 0);

  $('#totalBalance').textContent = money(total);
  $('#monthIncome').textContent = money(income);
  $('#monthExpense').textContent = money(expense);
  $('#statIncome').textContent = money(income);
  $('#statExpense').textContent = money(expense);
  $('#safeToSpend').textContent = money(safe);
  $('#savedAmount').textContent = money(state.goal.saved, true);
  $('#goalProgress').style.width = percent + '%';
  $('#goalPercent').textContent = percent + '% saved';
  $('#goalDeadline').textContent = 'Due ' + deadline.toLocaleDateString('en-LK', { month: 'short', year: 'numeric' });
  $('#goalInsight').textContent = remaining === 0 ? '🎉 Goal reached — amazing work!' : `Save about ${money(monthlyNeeded)} per month for the next ${monthsLeft} month${monthsLeft === 1 ? '' : 's'}.`;
  $('#salaryStatus').textContent = income >= 145000 ? '✓ Base salary covered' : `${money(Math.max(0, 145000 - income))} below base salary`;
  $('#budgetStatus').textContent = expense > 47000 ? `${money(expense - 47000)} above fixed costs` : 'LKR 47K fixed monthly';
  renderAccounts();
  renderTransactions();
}

function renderAccounts() {
  $('#accountList').innerHTML = state.accounts.map(a => `<div class="account-item"><span class="bank-logo ${a.className}">${a.short}</span><span class="account-name">${a.name}<small class="account-purpose">${a.purpose}</small></span><span class="account-value"><strong>${money(a.balance)}</strong><small>Available</small></span></div>`).join('');
}

const categoryIcons = { Salary: '💼', 'Extra income': '✨', Boarding: '🏠', Utilities: '💡', 'AI tools': '🤖', Medicine: '💊', Food: '🍜', Transport: '🚌', Other: '◈' };
function renderTransactions() {
  const filter = $('#transactionFilter').value;
  const items = [...state.transactions].filter(t => filter === 'all' || t.type === filter).sort((a, b) => b.date.localeCompare(a.date));
  $('#transactionList').innerHTML = items.length ? items.map((t, i) => `<div class="transaction-item" style="animation-delay:${Math.min(i * 35, 210)}ms"><span class="transaction-icon">${categoryIcons[t.category] || '◈'}</span><span class="transaction-detail"><strong>${escapeHtml(t.description)}</strong><small>${t.category}</small></span><span class="transaction-account">${t.account}</span><span class="transaction-date">${new Date(t.date + 'T12:00:00').toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}</span><strong class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '−'} ${money(t.amount)}</strong><button class="transaction-delete" data-delete="${t.id}" aria-label="Delete transaction">×</button></div>`).join('') : '<div class="empty-state"><span>🧾</span>No transactions here yet.</div>';
}

function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }
function openModal(el) { el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); }
function closeModal(el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
function toast(message) { $('#toast').textContent = '✓ ' + message; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 2200); }

$$('[data-open-modal]').forEach(b => b.addEventListener('click', () => { $('#txDate').value = new Date().toISOString().slice(0, 10); openModal($('#transactionModal')); setTimeout(() => $('#txDescription').focus(), 200); }));
$$('[data-close-modal]').forEach(b => b.addEventListener('click', () => closeModal($('#transactionModal'))));
$('#transactionForm').addEventListener('submit', e => {
  e.preventDefault();
  state.transactions.push({ id: Date.now(), description: $('#txDescription').value.trim(), type: $('#txType').value, amount: Number($('#txAmount').value), account: $('#txAccount').value, category: $('#txCategory').value, date: $('#txDate').value });
  save(); render(); e.target.reset(); closeModal($('#transactionModal')); toast('Transaction added');
});
$('#transactionFilter').addEventListener('change', renderTransactions);
$('#transactionList').addEventListener('click', e => { const id = e.target.dataset.delete; if (!id) return; state.transactions = state.transactions.filter(t => t.id !== Number(id)); save(); render(); toast('Transaction removed'); });

$('#editAccountsButton').addEventListener('click', () => {
  $('#accountInputs').innerHTML = state.accounts.map((a, i) => `<label>${a.name} balance (LKR)<input type="number" min="0" step="1" data-account-index="${i}" value="${a.balance}" required></label>`).join('');
  openModal($('#accountModal'));
});
$('[data-close-account]').addEventListener('click', () => closeModal($('#accountModal')));
$('#accountForm').addEventListener('submit', e => { e.preventDefault(); $$('[data-account-index]').forEach(input => state.accounts[Number(input.dataset.accountIndex)].balance = Number(input.value)); save(); render(); closeModal($('#accountModal')); toast('Balances updated'); });

$('#editGoalButton').addEventListener('click', () => { $('#goalTargetInput').value = state.goal.target; $('#goalSavedInput').value = state.goal.saved; $('#goalDateInput').value = state.goal.deadline; openModal($('#goalModal')); });
$('[data-close-goal]').addEventListener('click', () => closeModal($('#goalModal')));
$('#goalForm').addEventListener('submit', e => { e.preventDefault(); state.goal = { target: Number($('#goalTargetInput').value), saved: Number($('#goalSavedInput').value), deadline: $('#goalDateInput').value }; save(); render(); closeModal($('#goalModal')); toast('Goal updated'); });

$$('.modal-backdrop').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModal(m); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.modal-backdrop.open').forEach(closeModal); });

function applyTheme() { document.body.classList.toggle('light', state.theme === 'light'); $('#themeButton').textContent = state.theme === 'light' ? '🌙' : '☀️'; }
$('#themeButton').addEventListener('click', () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; save(); applyTheme(); });
$('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$$('.nav-item').forEach(item => item.addEventListener('click', () => { $$('.nav-item').forEach(i => i.classList.remove('active')); item.classList.add('active'); $('#sidebar').classList.remove('open'); }));

const hour = new Date().getHours();
$('#greetingTime').textContent = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
$('#todayLabel').textContent = new Date().toLocaleDateString('en-LK', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
applyTheme();
render();
