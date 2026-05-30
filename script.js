const GAS_URL = 'https://script.google.com/macros/s/AKfycbzlPkZJaZhNQXLPRW8C0xWxB5WpbqqutIyW5rXq7JnvkgXyvxfbXnDKAVdARWNR82dUtw/exec';

let userList = [];      // stores users + WA numbers
let adminLogData = [];  // stores last fetched log for WA lookup
let app = { user: null, mode: null, rejectId: null };

const $ = id => document.getElementById(id);
const pages = ['landingPage','loginPage','submitPage','adminPage','historyPage','expensePage','studentPaymentPage'];

function showPage(id) {
  pages.forEach(p => {
    const el = document.getElementById(p);
    if (el) el.classList.add('hidden');
  });
  const target = document.getElementById(id);
  if (target) target.classList.remove('hidden');
  window.scrollTo(0,0);
  
  // Load data AFTER page is visible
  if (id === 'historyPage') setTimeout(loadHistory, 50);
  if (id === 'expensePage') setTimeout(loadExpenseDetail, 50);
  if (id === 'studentPaymentPage') setTimeout(loadStudentPayments, 50);
}

function showToast(msg, type) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast ' + (type || '');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

function showLoading() { 
  const el = $('loading');
  if (el) el.classList.remove('hidden'); 
}
function hideLoading() { 
  const el = $('loading');
  if (el) el.classList.add('hidden'); 
}

async function api(action, payload = {}) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...payload })
  });
  return res.json();
}

/* ─── Landing ─── */
document.addEventListener('DOMContentLoaded', () => {
  loadLandingStats();
});

async function loadLandingStats() {
  try {
    const data = await api('getSummary');
    const el = $('pengeluaranPublicValue');
    if (el) el.textContent = formatRupiah(data.totalPengeluaran);
  } catch (e) { console.error('Landing stats error:', e); }
}

/* ─── Navigation ─── */
function goLanding() { showPage('landingPage'); loadLandingStats(); }
function goToAdminLogin() { app.mode = 'admin'; $('loginTitle').textContent = 'Admin Mode'; showPage('loginPage'); }
function goToStaffLogin() { app.mode = 'staff'; $('loginTitle').textContent = 'Pengajuan Pembina'; showPage('loginPage'); $('passwordInput').focus(); }
function goToHistory() { showPage('historyPage'); }
function goToExpenseDetail() { showPage('expensePage'); }
function goToStudentPayments() { showPage('studentPaymentPage'); }

/* ─── Login ─── */
async function doLogin() {
  const p = $('passwordInput').value.trim();
  if (!p) return showToast('Masukkan kata sandi', 'error');

  showLoading();
  try {
    const res = await api('login', { password: p });
    hideLoading();
    if (res.error) return showToast(res.error, 'error');

    app.user = res;
    $('passwordInput').value = '';

    if (app.mode === 'admin' && res.role !== 'admin' && res.role !== 'supervisor') {
      return showToast('Hanya admin yang bisa masuk', 'error');
    }
    if (app.mode === 'staff' && res.role !== 'staff') {
      return showToast('Hanya pembina yang bisa mengajukan', 'error');
    }

    if (res.role === 'admin') {
      $('userNameAdmin').textContent = res.name;
      showPage('adminPage');
      switchAdminTab('income');
      loadAdmin();
      setupAdminView();
    } else if (res.role === 'supervisor') {
      $('userNameAdmin').textContent = res.name;
      showPage('adminPage');
      setupSupervisorView();
      loadAdminStats();
    } else {
      $('userNameSubmit').textContent = res.name;
      showPage('submitPage');
      generateId();
    }
  } catch (err) {
    hideLoading();
    showToast('Error: ' + err.message, 'error');
  }
}
/* ─── Admin / Supervisor View Toggle ─── */
function setupAdminView() {
  const tabs = $('adminTabs');
  const banner = $('supervisorBanner');
  if (tabs) tabs.classList.remove('hidden');
  if (banner) banner.classList.add('hidden');
}

function setupSupervisorView() {
  const tabs = $('adminTabs');
  const incomeTab = $('incomeTab');
  const expenseTab = $('expenseTab');
  const approvalTab = $('approvalTab');
  const banner = $('supervisorBanner');
  
  if (tabs) tabs.classList.add('hidden');
  if (incomeTab) incomeTab.classList.add('hidden');
  if (expenseTab) expenseTab.classList.add('hidden');
  if (approvalTab) approvalTab.classList.add('hidden');
  if (banner) banner.classList.remove('hidden');
}

function doLogout() {
  app.user = null;
  app.mode = null;
  $('passwordInput').value = '';
  // Reset view so next login starts clean
  setupAdminView();
  goLanding();
}

/* ─── Currency ─── */
function formatRupiahInput(el) {
  let val = el.value.replace(/[^0-9]/g, '');
  if (!val) { el.value = ''; return; }
  el.value = 'Rp.' + parseInt(val).toLocaleString('id-ID');
}

function parseRupiah(str) {
  return parseFloat(str.replace(/[^0-9]/g, '')) || 0;
}

function formatRupiah(num) {
  if (num === undefined || num === null) return 'Rp 0';
  return 'Rp.' + Math.round(num).toLocaleString('id-ID');
}
/* ─── Users Dropdown ─── */
async function loadUsers() {
  try {
    const res = await api('getUsers');
    userList = res.users || [];
    const sel = $('adminExpenseDiajukanOleh');
    if (!sel) return;
    sel.innerHTML = '<option value="">Pilih nama...</option>';
    userList.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.name;
      opt.textContent = u.name;
      sel.appendChild(opt);
    });
    const other = document.createElement('option');
    other.value = '__other__';
    other.textContent = 'Lainnya...';
    sel.appendChild(other);
  } catch (e) { console.error('Load users error:', e); }
}

function onDiajukanOlehChange() {
  const sel = $('adminExpenseDiajukanOleh');
  const block = $('customDiajukanBlock');
  if (!sel || !block) return;
  if (sel.value === '__other__') {
    block.classList.remove('hidden');
  } else {
    block.classList.add('hidden');
  }
}

/* ─── Staff: Submit Pengeluaran ─── */
async function generateId() {
  try {
    const res = await api('getNextId');
    $('idTransaksi').value = res.id;
  } catch (e) { showToast('Gagal generate ID', 'error'); }
}

async function submitTransaction() {
  const id = $('idTransaksi').value.trim();
  const nama = $('namaTransaksi').value.trim();
  const jumlah = parseRupiah($('jumlahTransaksi').value);
  const bukti = $('buktiTransaksi').value.trim();

  if (!id || !nama || jumlah <= 0) {
    return showToast('Lengkapi semua field dengan benar', 'error');
  }

  showLoading();
  try {
    const res = await api('submitTransaction', {
      id, transaksi: nama, jumlah, bukti,
      diajukanOleh: app.user.name
    });
    hideLoading();
    if (res.error) return showToast(res.error, 'error');

    showToast('Pengajuan terkirim! Menunggu approval.', 'success');
    $('namaTransaksi').value = '';
    $('jumlahTransaksi').value = '';
    $('buktiTransaksi').value = '';
    generateId();
  } catch (err) {
    hideLoading();
    showToast('Error: ' + err.message, 'error');
  }
}

/* ─── Admin: Tabs ─── */
function switchAdminTab(tab) {
  const tIncome = $('tabIncome');
  const tExpense = $('tabExpense');
  const tApproval = $('tabApproval');
  const cIncome = $('incomeTab');
  const cExpense = $('expenseTab');
  const cApproval = $('approvalTab');
  
  if (tIncome) tIncome.classList.toggle('active', tab === 'income');
  if (tExpense) tExpense.classList.toggle('active', tab === 'expense');
  if (tApproval) tApproval.classList.toggle('active', tab === 'approval');
  if (cIncome) cIncome.classList.toggle('hidden', tab !== 'income');
  if (cExpense) cExpense.classList.toggle('hidden', tab !== 'expense');
  if (cApproval) cApproval.classList.toggle('hidden', tab !== 'approval');
  
  if (tab === 'approval') loadAdminLists();
  if (tab === 'income') generateIncomeId();
  if (tab === 'expense') { generateAdminExpenseId(); loadUsers(); }
}

/* ─── Admin: Record Pemasukan ─── */
async function generateIncomeId() {
  try {
    const res = await api('getNextId');
    $('incomeId').value = res.id;
  } catch (e) { showToast('Gagal generate ID', 'error'); }
}

async function recordIncome() {
  const id = $('incomeId').value.trim();
  const nama = $('incomeNama').value.trim();
  const jumlah = parseRupiah($('incomeJumlah').value);
  const bukti = $('incomeBukti').value.trim();

  if (!id || !nama || jumlah <= 0) {
    return showToast('Lengkapi semua field dengan benar', 'error');
  }

  showLoading();
  try {
    const res = await api('recordIncome', {
      id, transaksi: nama, jumlah, bukti,
      petugas: app.user.name
    });
    hideLoading();
    if (res.error) return showToast(res.error, 'error');

    showToast('Pemasukan tercatat!', 'success');
    $('incomeNama').value = '';
    $('incomeJumlah').value = '';
    $('incomeBukti').value = '';
    generateIncomeId();
    loadAdminStats();
  } catch (err) {
    hideLoading();
    showToast('Error: ' + err.message, 'error');
  }
}

/* ─── Admin: Record Pengeluaran (Auto-approve → Confirmed) ─── */
async function generateAdminExpenseId() {
  try {
    const res = await api('getNextId');
    $('adminExpenseId').value = res.id;
  } catch (e) { showToast('Gagal generate ID', 'error'); }
}
async function recordAdminExpense() {
  const id = $('adminExpenseId').value.trim();
  const nama = $('adminExpenseNama').value.trim();
  const jumlah = parseRupiah($('adminExpenseJumlah').value);
  const bukti = $('adminExpenseBukti').value.trim();

  let diajukanOleh = $('adminExpenseDiajukanOleh').value;
  if (diajukanOleh === '__other__') {
    diajukanOleh = $('adminExpenseDiajukanCustom').value.trim();
  }

  if (!id || !nama || jumlah <= 0) {
    return showToast('Lengkapi semua field dengan benar', 'error');
  }
  if (!diajukanOleh) {
    return showToast('Pilih atau masukkan nama pengaju', 'error');
  }

  showLoading();
  try {
    const res = await api('recordAdminExpense', {
      id, transaksi: nama, jumlah, bukti,
      petugas: app.user.name,
      diajukanOleh
    });
    hideLoading();
    if (res.error) return showToast(res.error, 'error');

    showToast('Pengeluaran tercatat!', 'success');
    $('adminExpenseNama').value = '';
    $('adminExpenseJumlah').value = '';
    $('adminExpenseBukti').value = '';
    $('adminExpenseDiajukanOleh').value = '';
    $('adminExpenseDiajukanCustom').value = '';
    $('customDiajukanBlock').classList.add('hidden');
    generateAdminExpenseId();
    loadAdminStats();
  } catch (err) {
    hideLoading();
    showToast('Error: ' + err.message, 'error');
  }
}

/* ─── Admin: Load Stats ─── */
async function loadAdmin() {
  await loadAdminStats();
  await loadUsers();
}

async function loadAdminStats() {
  try {
    const data = await api('getSummary');
    const saldo = $('adminSaldo');
    const pemasukan = $('adminPemasukan');
    const pengeluaran = $('adminPengeluaran');
    if (saldo) saldo.textContent = formatRupiah(data.balance);
    if (pemasukan) pemasukan.textContent = formatRupiah(data.totalPemasukan);
    if (pengeluaran) pengeluaran.textContent = formatRupiah(data.totalPengeluaran);
  } catch (e) { console.error('Admin stats error:', e); }
}

/* ─── Admin: Approval Lists ─── */
async function loadAdminLists() {
  try {
    const log = await api('getLog');
    adminLogData = log;
    
    const pending = log.filter(x => x.status === 'Submitted' && x.jenis === 'Pengeluaran');
    const approved = log.filter(x => x.status === 'Approved' && x.jenis === 'Pengeluaran');
    const confirmed = log.filter(x => x.status === 'Confirmed' && x.jenis === 'Pengeluaran');
    const rejected = log.filter(x => x.status === 'Rejected' && x.jenis === 'Pengeluaran');

    // Pending
    const pEl = $('pendingList');
    if (pEl) {
      pEl.innerHTML = pending.length
        ? pending.map(item => renderAdminCard(item, 'pending')).join('')
        : '<div class="empty-state">Tidak ada pengajuan menunggu</div>';
    }

    // Approved (waiting confirmation) — use existing DOM element
    const aEl = $('approvedList');
    if (aEl) {
      aEl.innerHTML = approved.length
        ? approved.map(item => renderAdminCard(item, 'approved')).join('')
        : '<div class="empty-state">Tidak ada yang menunggu konfirmasi bayar</div>';
    }

    // Processed (Confirmed + Rejected)
    const procEl = $('processedList');
    if (procEl) {
      const processed = [...confirmed, ...rejected];
      procEl.innerHTML = processed.length
        ? processed.map(item => renderAdminCard(item, item.status === 'Confirmed' ? 'confirmed' : 'rejected')).join('')
        : '<div class="empty-state">Belum ada riwayat proses</div>';
    }

  } catch (e) { console.error('Admin lists error:', e); }
}

function renderAdminCard(item, status) {
  const isOut = item.jenis === 'Pengeluaran';
  const amountClass = isOut ? 'amount-out' : 'amount-in';
  const sign = isOut ? '-' : '+';
  const jenisClass = isOut ? 'jenis-out' : 'jenis-in';

  let actions = '';
  let statusBadge = '';

  if (status === 'pending') {
    actions = `
      <div class="card-actions">
        <button class="btn-action btn-approve" onclick="approvePending('${item.id}')">✓ Setuju</button>
        <button class="btn-action btn-reject" onclick="openRejectModal('${item.id}')">✕ Tolak</button>
      </div>`;
  } else if (status === 'approved') {
    // FIXED: No more Tolak button here. Reject was only available at pending stage.
    actions = `
      <div class="card-actions">
        <button class="btn-action btn-approve" onclick="confirmPayment('${item.id}')" style="background:#f59e0b;">💰 Konfirmasi Bayar</button>
      </div>`;
    statusBadge = '<span class="status-badge status-approved">Disetujui — Menunggu Konfirmasi</span>';
  } else if (status === 'confirmed') {
    statusBadge = '<span class="status-badge status-approved">✅ Selesai</span>';
  } else {
    statusBadge = `<span class="status-badge status-rejected">Ditolak</span>`;
  }

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-id">${item.id}</span>
        <span class="card-jenis ${jenisClass}">${item.jenis}</span>
      </div>
      <div class="card-title">${item.transaksi}</div>
      <div class="card-meta">Diajukan oleh: ${item.diajukanOleh}</div>
      <div class="card-amount ${amountClass}">${sign}${formatRupiah(item.jumlah)}</div>
      ${statusBadge}
      ${actions}
      ${item.reason ? `<div class="reason-box"><strong>Alasan Penolakan:</strong> ${item.reason}</div>` : ''}
    </div>
  `;
}

async function approvePending(id) {
  const item = adminLogData.find(x => x.id === id);
  
  showLoading();
  try {
    const res = await api('approvePending', { id, petugas: app.user.name });
    hideLoading();
    if (res.error) return showToast(res.error, 'error');
    
    showToast('Disetujui! Menunggu konfirmasi bayar.', 'success');
    if (item) sendWaNotification(item, 'approved');
    loadAdminLists();
  } catch (err) {
    hideLoading();
    showToast('Error: ' + err.message, 'error');
  }
}

async function confirmPayment(id) {
  showLoading();
  try {
    const res = await api('confirmPayment', { id, petugas: app.user.name });
    hideLoading();
    if (res.error) return showToast(res.error, 'error');
    showToast('Pembayaran dikonfirmasi! Saldo diperbarui.', 'success');
    loadAdminLists();
    loadAdminStats();
  } catch (err) {
    hideLoading();
    showToast('Error: ' + err.message, 'error');
  }
}

/* ─── Reject Modal ─── */
function openRejectModal(id) {
  app.rejectId = id;
  $('rejectReason').value = '';
  $('rejectModal').classList.remove('hidden');
}

function closeRejectModal() {
  app.rejectId = null;
  $('rejectModal').classList.add('hidden');
}

async function confirmReject() {
  const reason = $('rejectReason').value.trim();
  if (!reason) return showToast('Masukkan alasan penolakan', 'error');

  const item = adminLogData.find(x => x.id === app.rejectId);

  showLoading();
  try {
    const res = await api('rejectTransaction', { id: app.rejectId, petugas: app.user.name, reason });
    hideLoading();
    if (res.error) return showToast(res.error, 'error');
    
    showToast('Ditolak.', 'success');
    if (item) sendWaNotification(item, 'rejected', reason);
    closeRejectModal();
    loadAdminLists();
  } catch (err) {
    hideLoading();
    showToast('Error: ' + err.message, 'error');
  }
}

/* ─── History: Only Pengeluaran ─── */
async function loadHistory() {
  const el = $('historyList');
  if (!el) {
    console.error('historyList element not found');
    return;
  }
  
  el.innerHTML = '<div class="empty-state">Memuat...</div>';
  
  try {
    const log = await api('getLog');
    console.log('History raw data:', log);
    
    if (!Array.isArray(log)) {
      el.innerHTML = '<div class="empty-state">Gagal memuat data</div>';
      return;
    }
    
    // Filter: only Pengeluaran
    const pengeluaranOnly = log.filter(x => x.jenis === 'Pengeluaran');
    console.log('Filtered pengeluaran:', pengeluaranOnly);
    
    if (!pengeluaranOnly.length) {
      el.innerHTML = '<div class="empty-state">Belum ada pengajuan</div>';
      return;
    }

    el.innerHTML = pengeluaranOnly.slice().reverse().map(item => {
      const amountClass = 'amount-out';
      const sign = '-';
      const jenisClass = 'jenis-out';
      
      let footer = '';
      if (item.status === 'Confirmed') {
        footer = `<div class="coordinator-msg">✅ Dikonfirmasi</div>`;
      } else if (item.status === 'Approved') {
        footer = `<div class="coordinator-msg">⏳ Disetujui — Menunggu konfirmasi pembayaran</div>`;
      } else if (item.status === 'Rejected') {
        footer = `<div class="reason-box"><strong>Ditolak:</strong> ${item.reason || 'Tidak ada alasan'}</div>`;
      } else {
        footer = `<span class="status-badge status-submitted">Menunggu Approval</span>`;
      }

      return `
        <div class="card">
          <div class="card-header">
            <span class="card-id">${item.id}</span>
            <span class="card-jenis ${jenisClass}">${item.jenis}</span>
          </div>
          <div class="card-title">${item.transaksi}</div>
          <div class="card-meta">${item.diajukanOleh} • ${new Date(item.timestamp).toLocaleDateString('id-ID')}</div>
          <div class="card-amount ${amountClass}">${sign}${formatRupiah(item.jumlah)}</div>
          ${footer}
        </div>
      `;
    }).join('');
  } catch (e) { 
    console.error('History error:', e);
    el.innerHTML = '<div class="empty-state">Error memuat data</div>';
  }
}

/* ─── Expense Detail ─── */
async function loadExpenseDetail() {
  const el = $('expenseList');
  const totalEl = $('expenseTotal');
  const countEl = $('expenseCount');
  
  if (!el || !totalEl || !countEl) {
    console.error('Expense elements missing:', { el: !!el, totalEl: !!totalEl, countEl: !!countEl });
    return;
  }
  
  el.innerHTML = '<div class="empty-state">Memuat...</div>';
  
  try {
    const master = await api('getMaster');
    console.log('Master raw data:', master);
    
    if (!Array.isArray(master)) {
      el.innerHTML = '<div class="empty-state">Gagal memuat data</div>';
      return;
    }
    
    const expenses = master.filter(x => x.jenis === 'Pengeluaran');
    console.log('Filtered expenses:', expenses);
    
    const total = expenses.reduce((sum, x) => sum + (parseFloat(x.jumlah) || 0), 0);
    totalEl.textContent = formatRupiah(total);
    countEl.textContent = expenses.length;

    if (!expenses.length) {
      el.innerHTML = '<div class="empty-state">Belum ada pengeluaran</div>';
      return;
    }

    el.innerHTML = expenses.slice().reverse().map(item => `
      <div class="card">
        <div class="card-header">
          <span class="card-id">${item.id}</span>
          <span class="card-jenis jenis-out">Pengeluaran</span>
        </div>
        <div class="card-title">${item.transaksi}</div>
        <div class="card-meta">Diajukan oleh: ${item.diajukanOleh} • Disetujui: ${item.petugas || '-'}</div>
        <div class="card-amount amount-out">-${formatRupiah(item.jumlah)}</div>
      </div>
    `).join('');
  } catch (e) { 
    console.error('Expense error:', e);
    el.innerHTML = '<div class="empty-state">Error memuat data</div>';
  }
}

// Enter key on password
document.addEventListener('DOMContentLoaded', () => {
  const pwd = $('passwordInput');
  if (pwd) {
    pwd.addEventListener('keypress', e => { 
      if (e.key === 'Enter') doLogin(); 
    });
  }
});

/* ─── Admin Full Report Modal ─── */
function openReportModal() {
  const modal = $('reportModal');
  if (modal) {
    modal.classList.remove('hidden');
    loadAdminReport();
  }
}

function closeReportModal() {
  const modal = $('reportModal');
  if (modal) modal.classList.add('hidden');
}

async function loadAdminReport() {
  const listEl = $('reportList');
  const incomeEl = $('reportTotalIncome');
  const expenseEl = $('reportTotalExpense');
  const balanceEl = $('reportBalance');
  
  if (!listEl) return;
  listEl.innerHTML = '<div class="empty-state">Memuat...</div>';
  
  try {
    const master = await api('getMaster');
    if (!Array.isArray(master)) {
      listEl.innerHTML = '<div class="empty-state">Gagal memuat data</div>';
      return;
    }
    
    let totalIncome = 0, totalExpense = 0;
    master.forEach(t => {
      const val = parseFloat(t.jumlah) || 0;
      if (t.jenis === 'Pemasukan') totalIncome += val;
      else if (t.jenis === 'Pengeluaran') totalExpense += val;
    });
    
    if (incomeEl) incomeEl.textContent = formatRupiah(totalIncome);
    if (expenseEl) expenseEl.textContent = formatRupiah(totalExpense);
    if (balanceEl) balanceEl.textContent = formatRupiah(totalIncome - totalExpense);
    
    if (!master.length) {
      listEl.innerHTML = '<div class="empty-state">Belum ada transaksi</div>';
      return;
    }
    
    listEl.innerHTML = master.slice().reverse().map(item => {
      const isOut = item.jenis === 'Pengeluaran';
      const amountClass = isOut ? 'amount-out' : 'amount-in';
      const sign = isOut ? '-' : '+';
      const jenisClass = isOut ? 'jenis-out' : 'jenis-in';
      
      return `
        <div class="card">
          <div class="card-header">
            <span class="card-id">${item.id}</span>
            <span class="card-jenis ${jenisClass}">${item.jenis}</span>
          </div>
          <div class="card-title">${item.transaksi}</div>
          <div class="card-meta">Diajukan: ${item.diajukanOleh || '-'} • Petugas: ${item.petugas || '-'}</div>
          <div class="card-amount ${amountClass}">${sign}${formatRupiah(item.jumlah)}</div>
          <div style="font-size:0.75rem; color:var(--text-light); margin-top:0.5rem;">Running Balance: ${formatRupiah(item.balance)}</div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error('Report error:', e);
    listEl.innerHTML = '<div class="empty-state">Error memuat data</div>';
  }
}

/* ─── Student Payments ─── */
async function loadStudentPayments() {
  const el = $('studentPaymentList');
  if (!el) return;
  el.innerHTML = '<div class="empty-state">Memuat...</div>';

  try {
    const data = await api('getStudentPayments');
    if (!Array.isArray(data)) {
      el.innerHTML = '<div class="empty-state">Gagal memuat data</div>';
      return;
    }
    window.studentPaymentData = data;
    renderStudentPayments(data);
  } catch (e) {
    console.error('Student payment error:', e);
    el.innerHTML = '<div class="empty-state">Error memuat data</div>';
  }
}

function renderStudentPayments(data) {
  const el = $('studentPaymentList');
  if (!el) return;

  if (!data.length) {
    el.innerHTML = '<div class="empty-state">Tidak ada data</div>';
    return;
  }

  // Sort newest first
  const sorted = [...data].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  // Group by local date
  const groups = {};
  sorted.forEach(item => {
    const d = new Date(item.tanggal);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    if (!groups[key]) groups[key] = { label, items: [] };
    groups[key].items.push(item);
  });

  let html = '';
  Object.keys(groups).sort().reverse().forEach(key => {
    const g = groups[key];
    html += `<div class="date-group"><div class="date-header">${g.label}</div>`;
    g.items.forEach(item => {
      html += `
        <div class="card">
          <div class="card-title">${item.nama}</div>
          <div class="card-meta">Petugas: ${item.petugas || '-'}</div>
          <div class="card-amount amount-in">+${formatRupiah(item.nominal)}</div>
        </div>`;
    });
    html += `</div>`;
  });

  el.innerHTML = html;
}

function filterStudentPayments() {
  const query = $('studentSearch').value.trim().toLowerCase();
  if (!window.studentPaymentData) return;
  const filtered = query
    ? window.studentPaymentData.filter(x => x.nama.toLowerCase().includes(query))
    : window.studentPaymentData;
  renderStudentPayments(filtered);
}

/* ─── WhatsApp Notification ─── */
function formatWaNumber(phone) {
  let num = phone.toString().replace(/\D/g, '');
  if (num.startsWith('0')) num = '62' + num.substring(1);
  return num;
}

function sendWaNotification(item, status, reason) {
  const user = userList.find(u => u.name === item.diajukanOleh);
  if (!user || !user.phone) {
    showToast(`Nomor WA untuk ${item.diajukanOleh} tidak ditemukan. Notifikasi tidak terkirim.`, 'error');
    return;
  }

  let message = '';
  if (status === 'approved') {
    message = `Assalamu'alaikum ${item.diajukanOleh}, pengajuan anda ${item.transaksi} telah disetujui. Silakan hubungi koordinator.`;
  } else if (status === 'rejected') {
    message = `Assalamu'alaikum ${item.diajukanOleh}, pengajuan anda ${item.transaksi} ditolak. Alasan: ${reason || 'Tidak ada alasan'}.`;
  }

  const num = formatWaNumber(user.phone);
  const url = `https://wa.me/${num}?text=${encodeURIComponent(message)}`;

  // Open via invisible link (more reliable than window.open after async)
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
  }, 100);
}
