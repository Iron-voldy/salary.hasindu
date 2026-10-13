const STORAGE_KEY = 'moneyMapDataV3';
const LEGACY_KEY = 'moneyMapDataV2';
const START_MONTH = '2026-10';
const defaults = {
  accounts: [
    { id: 'hnb', name: 'HNB', purpose: 'Daily & personal spending', openingBalance: 0, className: 'bank-hnb', short: 'HNB' },
    { id: 'boc', name: 'BOC', purpose: 'Savings', openingBalance: 0, className: 'bank-boc', short: 'BOC' },
    { id: 'commercial', name: 'Commercial Bank', purpose: 'Salary & other income', openingBalance: 0, className: 'bank-commercial', short: 'CB' }
  ],
  goal: { target: 400000, deadline: '2027-10-31' }, transactions: [], theme: 'dark'
};
const clone = value => JSON.parse(JSON.stringify(value));
const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);
const money = (value, compact = false) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0, notation: compact ? 'compact' : 'standard' }).format(Number(value) || 0).replace('LKR', 'LKR ');
const monthName = value => new Date(`${value}-01T12:00:00`).toLocaleDateString('en-LK', { month: 'long', year: 'numeric' });
const slug = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const currentMonth = () => todayLocal().slice(0, 7) < START_MONTH ? START_MONTH : todayLocal().slice(0, 7);

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) return normalise(saved);
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    if (legacy) return normalise(legacy);
  } catch (_) {}
  return clone(defaults);
}
function normalise(data) {
  const result = { ...clone(defaults), ...data };
  result.accounts = (data.accounts || defaults.accounts).map((account, index) => ({ ...defaults.accounts[index % 3], ...account, id: account.id || slug(account.name), openingBalance: Number(account.openingBalance ?? account.balance ?? 0) }));
  result.transactions = (data.transactions || []).map(item => ({ ...item, id: Number(item.id) || Date.now() + Math.random(), amount: Number(item.amount) || 0, account: item.account && !result.accounts.some(a => a.id === item.account) ? result.accounts.find(a => a.name === item.account)?.id : item.account }));
  result.goal = { ...defaults.goal, ...(data.goal || {}) };
  return result;
}
let state = load();
let selectedMonth = currentMonth();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const account = id => state.accounts.find(item => item.id === id);
const accountName = id => account(id)?.name || id || 'Unknown account';
const isSaving = item => item.type === 'transfer' && account(item.toAccount)?.purpose.toLowerCase().includes('saving');
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value ?? ''; return div.innerHTML; }

function populateMonths() {
  let end = state.transactions.reduce((latest, item) => item.date?.slice(0, 7) > latest ? item.date.slice(0, 7) : latest, currentMonth());
  const months = [];
  for (let cursor = START_MONTH; cursor <= end;) {
    months.push(cursor);
    const d = new Date(`${cursor}-01T12:00:00`); d.setMonth(d.getMonth() + 1);
    cursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (!months.includes(selectedMonth)) selectedMonth = months.at(-1) || START_MONTH;
  $('#monthSelector').innerHTML = months.reverse().map(value => `<option value="${value}">${monthName(value)}</option>`).join('');
  $('#monthSelector').value = selectedMonth;
}
function accountBalance(id) {
  return state.transactions.filter(item => item.date <= `${selectedMonth}-31`).reduce((balance, item) => {
    if (item.type === 'income' && item.account === id) return balance + item.amount;
    if (item.type === 'expense' && item.account === id) return balance - item.amount;
    if (item.type === 'transfer' && item.fromAccount === id) return balance - item.amount;
    if (item.type === 'transfer' && item.toAccount === id) return balance + item.amount;
    return balance;
  }, Number(account(id)?.openingBalance || 0));
}
function summary() {
  const items = state.transactions.filter(item => item.date.startsWith(selectedMonth));
  const income = items.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expense = items.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const saved = items.filter(isSaving).reduce((sum, item) => sum + item.amount, 0);
  return { items, income, expense, saved, net: income - expense };
}
function render() {
  populateMonths();
  const data = summary();
  const total = state.accounts.reduce((sum, item) => sum + accountBalance(item.id), 0);
  const goalSaved = state.accounts.filter(item => item.purpose.toLowerCase().includes('saving')).reduce((sum, item) => sum + accountBalance(item.id), 0);
  const target = Number(state.goal.target) || 1;
  const percent = Math.max(0, Math.min(100, Math.round(goalSaved / target * 100)));
  $('#activeMonthLabel').textContent = monthName(selectedMonth);
  $('#totalBalance').textContent = money(total); $('#monthIncome').textContent = money(data.income); $('#monthExpense').textContent = money(data.expense);
  $('#statIncome').textContent = money(data.income); $('#statExpense').textContent = money(data.expense); $('#monthlySavings').textContent = money(data.saved); $('#netCashFlow').textContent = money(data.net);
  $('#netCashFlow').classList.toggle('negative-text', data.net < 0);
  $('#savedAmount').textContent = money(goalSaved, true); $('#goalTargetLabel').textContent = `/ ${money(target, true)}`; $('#goalProgress').style.width = `${percent}%`; $('#goalPercent').textContent = `${percent}% saved`;
  $('#goalDeadline').textContent = `Due ${new Date(state.goal.deadline + 'T12:00:00').toLocaleDateString('en-LK', { month: 'short', year: 'numeric' })}`;
  $('#goalInsight').textContent = data.saved ? `${money(data.saved)} moved to savings in ${monthName(selectedMonth)}.` : `No savings transfer recorded in ${monthName(selectedMonth)} yet.`;
  const incomes = data.items.filter(item => item.type === 'income').length, expenses = data.items.filter(item => item.type === 'expense').length;
  $('#salaryStatus').textContent = incomes ? `${incomes} income ${incomes === 1 ? 'entry' : 'entries'}` : 'No income recorded';
  $('#budgetStatus').textContent = expenses ? `${expenses} expense ${expenses === 1 ? 'entry' : 'entries'}` : 'No expenses recorded';
  renderAccounts(); renderBreakdown(data); renderTransactions(data.items);
}
function renderAccounts() {
  $('#accountList').innerHTML = state.accounts.map(item => `<div class="account-item"><span class="bank-logo ${item.className || 'bank-savings'}">${escapeHtml(item.short || item.name.slice(0, 2).toUpperCase())}</span><span class="account-name">${escapeHtml(item.name)}<small class="account-purpose">${escapeHtml(item.purpose)}</small></span><span class="account-value"><strong>${money(accountBalance(item.id))}</strong><small>Through ${monthName(selectedMonth)}</small></span></div>`).join('');
}
function renderBreakdown(data) {
  const categories = {};
  data.items.filter(item => item.type === 'expense').forEach(item => categories[item.category] = (categories[item.category] || 0) + item.amount);
  const entries = Object.entries(categories).sort((a, b) => b[1] - a[1]), colors = ['#8b5cf6', '#22c9a5', '#ff7185', '#2f9bff', '#f3b44b', '#ca7cff'];
  let cursor = 0;
  const stops = entries.map(([, amount], index) => { const start = cursor; cursor += amount / (data.expense || 1) * 100; return `${colors[index % colors.length]} ${start}% ${cursor}%`; });
  $('#budgetDonut').style.background = entries.length ? `conic-gradient(${stops.join(',')})` : 'conic-gradient(rgba(255,255,255,.06) 0 100%)';
  $('#donutPercent').textContent = data.income ? `${Math.round(data.expense / data.income * 100)}%` : '0%'; $('#planBadge').textContent = `${money(data.expense, true)} spent`;
  $('#categoryLegend').innerHTML = entries.length ? entries.map(([category, amount], index) => `<div><i style="--color:${colors[index % colors.length]}"></i><span>${escapeHtml(category)}</span><strong>${money(amount)}</strong></div>`).join('') : '<p class="empty-inline">Add expenses to see the breakdown.</p>';
  $('#monthInsight').innerHTML = `<span>↗</span><p><strong>${data.net >= 0 ? 'Positive cash flow' : 'Spending exceeded income'}</strong>${money(Math.abs(data.net))} ${data.net >= 0 ? 'remains after expenses.' : 'is the monthly shortfall.'} Savings transfers are tracked separately.</p>`;
}
const icons = { Salary: '💼', 'Extra income': '✨', Boarding: '⌂', Utilities: '◉', 'AI tools': '◆', Medicine: '+', Food: '●', Transport: '→', Savings: '★', Other: '◇' };
function renderTransactions(items = summary().items) {
  const filter = $('#transactionFilter').value;
  items = [...items].filter(item => filter === 'all' || item.type === filter).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  $('#transactionList').innerHTML = items.length ? items.map((item, index) => {
    const transfer = item.type === 'transfer', route = transfer ? `${accountName(item.fromAccount)} → ${accountName(item.toAccount)}` : accountName(item.account), sign = item.type === 'income' ? '+' : item.type === 'expense' ? '−' : '→';
    return `<div class="transaction-item" style="animation-delay:${Math.min(index * 35, 210)}ms"><span class="transaction-icon">${icons[item.category] || (transfer ? '⇄' : '◇')}</span><span class="transaction-detail"><strong>${escapeHtml(item.description)}</strong><small>${escapeHtml(item.category || 'Other')}</small></span><span class="transaction-account">${escapeHtml(route)}</span><span class="transaction-date">${new Date(item.date + 'T12:00:00').toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' })}</span><strong class="transaction-amount ${item.type}">${sign} ${money(item.amount)}</strong><button class="transaction-delete" data-delete="${item.id}" aria-label="Delete transaction">×</button></div>`;
  }).join('') : '<div class="empty-state"><span>▤</span>No activity recorded for this month.</div>';
}
function openModal(element) { element.classList.add('open'); element.setAttribute('aria-hidden', 'false'); }
function closeModal(element) { element.classList.remove('open'); element.setAttribute('aria-hidden', 'true'); }
function toast(message) { $('#toast').textContent = `✓ ${message}`; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 2200); }
function populateAccounts() { const options = state.accounts.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join(''); $('#txAccount').innerHTML = options; $('#txFromAccount').innerHTML = options; $('#txToAccount').innerHTML = options; const saving = state.accounts.find(item => item.purpose.toLowerCase().includes('saving')); if (saving) $('#txToAccount').value = saving.id; }
function updateFields() { const transfer = $('#txType').value === 'transfer'; $('#standardAccountField').hidden = transfer; $('#transferFields').hidden = !transfer; $('#txCategoryField').hidden = transfer; $('#txCategory').required = !transfer; }

$('#monthSelector').addEventListener('change', event => { selectedMonth = event.target.value; render(); });
$$('[data-open-modal]').forEach(button => button.addEventListener('click', () => { populateAccounts(); $('#txDate').value = selectedMonth === todayLocal().slice(0, 7) ? todayLocal() : `${selectedMonth}-01`; updateFields(); openModal($('#transactionModal')); setTimeout(() => $('#txDescription').focus(), 150); }));
$$('[data-close-modal]').forEach(button => button.addEventListener('click', () => closeModal($('#transactionModal')))); $('#txType').addEventListener('change', updateFields);
$('#transactionForm').addEventListener('submit', event => {
  event.preventDefault(); const type = $('#txType').value;
  const item = { id: Date.now(), description: $('#txDescription').value.trim(), type, amount: Number($('#txAmount').value), date: $('#txDate').value, category: type === 'transfer' ? 'Savings' : $('#txCategory').value };
  if (type === 'transfer') { item.fromAccount = $('#txFromAccount').value; item.toAccount = $('#txToAccount').value; if (item.fromAccount === item.toAccount) return toast('Choose two different accounts'); } else item.account = $('#txAccount').value;
  state.transactions.push(item); selectedMonth = item.date.slice(0, 7); save(); event.target.reset(); closeModal($('#transactionModal')); render(); toast('Transaction added');
});
$('#transactionFilter').addEventListener('change', () => renderTransactions());
$('#transactionList').addEventListener('click', event => { const id = event.target.dataset.delete; if (!id) return; state.transactions = state.transactions.filter(item => item.id !== Number(id)); save(); render(); toast('Transaction removed'); });
$('#editAccountsButton').addEventListener('click', () => { $('#accountInputs').innerHTML = state.accounts.map((item, index) => `<div class="account-edit-row"><label>Account name<input data-account-name="${index}" value="${escapeHtml(item.name)}" required></label><label>Starting balance (LKR)<input type="number" step="1" data-account-balance="${index}" value="${item.openingBalance}" required></label></div>`).join(''); openModal($('#accountModal')); });
$('[data-close-account]').addEventListener('click', () => closeModal($('#accountModal')));
$('#accountForm').addEventListener('submit', event => { event.preventDefault(); state.accounts.forEach((item, index) => { item.name = $(`[data-account-name="${index}"]`).value.trim(); item.openingBalance = Number($(`[data-account-balance="${index}"]`).value); }); save(); render(); closeModal($('#accountModal')); toast('Accounts updated'); });
$('#editGoalButton').addEventListener('click', () => { $('#goalTargetInput').value = state.goal.target; $('#goalDateInput').value = state.goal.deadline; openModal($('#goalModal')); }); $('[data-close-goal]').addEventListener('click', () => closeModal($('#goalModal')));
$('#goalForm').addEventListener('submit', event => { event.preventDefault(); state.goal = { target: Number($('#goalTargetInput').value), deadline: $('#goalDateInput').value }; save(); render(); closeModal($('#goalModal')); toast('Goal updated'); });
$$('.modal-backdrop').forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal); })); document.addEventListener('keydown', event => { if (event.key === 'Escape') $$('.modal-backdrop.open').forEach(closeModal); });
function applyTheme() { document.body.classList.toggle('light', state.theme === 'light'); $('#themeButton').textContent = state.theme === 'light' ? '☾' : '☀'; }
$('#themeButton').addEventListener('click', () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; save(); applyTheme(); }); $('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$$('.nav-item').forEach(item => item.addEventListener('click', () => { $$('.nav-item').forEach(link => link.classList.remove('active')); item.classList.add('active'); $('#sidebar').classList.remove('open'); }));
const hour = new Date().getHours(); $('#greetingTime').textContent = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'; $('#todayLabel').textContent = new Date().toLocaleDateString('en-LK', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase(); applyTheme(); render();
