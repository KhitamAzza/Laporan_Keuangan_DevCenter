const GAS_URL = 'https://script.google.com/macros/s/AKfycbz0nTZE3SEQuoyBQVWI83du_9uDIpu3qZE5gbsqDQgvVVTNhw2CJvbnM460fjP5K03mzg/exec';

let app = { user: null, mode: null, rejectId: null };

const $ = id => document.getElementById(id);
const pages = ['landingPage','loginPage','submitPage','adminPage','historyPage','expensePage'];

function showPage(id) {
  pages.forEach(p => $(p).classList.add('hidden'));
  $(id).classList.remove('hidden');
  window.scrollTo(0,0);
}

function showToast(msg, type) {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast ' + (type || '');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

function showLoading() { $('loading').classList.remove('hidden'); }
function hideLoading() { $('loading').classList.add('hidden'); }

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
    $('saldoValue').textContent = formatRupiah(data.balance);
    $('pemasukanValue').textContent = formatRupiah(data.totalPemasukan);
    $('pengeluaranValue').textContent = formatRupiah(data.totalPengeluaran);
  } catch (e) { console.error(e); }
}

/* ─── Navigation ─── */
function goLanding() { showPage('landingPage'); loadLandingStats(); }
function goToAdminLogin() { app.mode = 'admin'; $('loginTitle').textContent = 'Admin Mode'; showPage('loginPage'); }
function goToStaffLogin() { app.mode = 'staff'; $('loginTitle').textContent = 'Pengajuan Pembina'; showPage('loginPage'); $('passwordInput').focus(); }
function goToHistory() { showPage('historyPage'); loadHistory(); }
function goToExpenseDetail() { showPage('expensePage'); loadExpenseDetail(); }

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

    if (app.mode === 'admin' && res.role !== 'admin') {
      return showToast('Hanya admin yang bisa masuk', 'error');
    }
    if (app.mode === 'staff' && res.role === 'admin') {
      return showToast('Admin tidak bisa mengajukan', 'error');
    }

    if (res.role === 'admin') {
      $('userNameAdmin').textContent = res.name;
      showPage('adminPage');
      switchAdminTab('income');
      loadAdmin();
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

function doLogout() {
  app.user = null;
  app.mode = null;
  $('passwordInput').value = '';
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
  $('tabIncome').classList.toggle('active', tab === 'income');
  $('tabApproval').classList.toggle('active', tab === 'approval');
  $('incomeTab').classList.toggle('hidden', tab !== 'income');
  $('approvalTab').classList.toggle('hidden', tab !== 'approval');
  if (tab === 'approval') loadAdminLists();
  if (tab === 'income') generateIncomeId();
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
    loadAdminSaldo();
  } catch (err) {
    hideLoading();
    showToast('Error: ' + err.message, 'error');
  }
}

/* ─── Admin: Approval ─── */
async function loadAdmin() {
  await loadAdminSaldo();
}

async function loadAdminSaldo() {
  try {
    const data = await api('getSummary');
    $('adminSaldo').textContent = formatRupiah(data.balance);
  } catch (e) { console.error(e); }
}

async function loadAdminLists() {
  try {
    const log = await api('getLog');
    const pending = log.filter(x => x.status === 'Submitted' && x.jenis === 'Pengeluaran');
    const processed = log.filter(x => x.status !== 'Submitted' && x.jenis === 'Pengeluaran');

    $('pendingList').innerHTML = pending.length
      ? pending.map(item => renderAdminCard(item, true)).join('')
      : '<div class="empty-state">Tidak ada pengajuan menunggu</div>';

    $('processedList').innerHTML = processed.length
      ? processed.map(item => renderAdminCard(item, false)).join('')
      : '<div class="empty-state">Belum ada riwayat proses</div>';
  } catch (e) { console.error(e); }
}

function renderAdminCard(item, isPending) {
  const isOut = item.jenis === 'Pengeluaran';
  const amountClass = isOut ? 'amount-out' : 'amount-in';
  const sign = isOut ? '-' : '+';
  const jenisClass = isOut ? 'jenis-out' : 'jenis-in';

  let actions = '';
  if (isPending) {
    actions = `
      <div class="card-actions">
        <button class="btn-action btn-approve" onclick="approveTransaction('${item.id}')">✓ Setuju</button>
        <button class="btn-action btn-reject" onclick="openRejectModal('${item.id}')">✕ Tolak</button>
      </div>`;
  } else {
    const statusClass = item.status === 'Approved' ? 'status-approved' : 'status-rejected';
    actions = `<span class="status-badge ${statusClass}">${item.status}</span>`;
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
      ${actions}
      ${item.reason ? `<div class="reason-box"><strong>Alasan Penolakan:</strong> ${item.reason}</div>` : ''}
    </div>
  `;
}

async function approveTransaction(id) {
  showLoading();
  try {
    const res = await api('approveTransaction', { id, petugas: app.user.name });
    hideLoading();
    if (res.error) return showToast(res.error, 'error');
    showToast('Disetujui!', 'success');
    loadAdminLists();
    loadAdminSaldo();
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

  showLoading();
  try {
    const res = await api('rejectTransaction', { id: app.rejectId, petugas: app.user.name, reason });
    hideLoading();
    if (res.error) return showToast(res.error, 'error');
    showToast('Ditolak.', 'success');
    closeRejectModal();
    loadAdminLists();
  } catch (err) {
    hideLoading();
    showToast('Error: ' + err.message, 'error');
  }
}

/* ─── History ─── */
async function loadHistory() {
  try {
    const log = await api('getLog');
    const el = $('historyList');

    if (!log.length) {
      el.innerHTML = '<div class="empty-state">Belum ada pengajuan</div>';
      return;
    }

    el.innerHTML = log.slice().reverse().map(item => {
      const isOut = item.jenis === 'Pengeluaran';
      const amountClass = isOut ? 'amount-out' : 'amount-in';
      const sign = isOut ? '-' : '+';
      const jenisClass = isOut ? 'jenis-out' : 'jenis-in';
      const statusClass = item.status === 'Approved' ? 'status-approved' : item.status === 'Rejected' ? 'status-rejected' : 'status-submitted';

      let footer = '';
      if (item.status === 'Approved') {
        if (isOut) {
          footer = `<div class="coordinator-msg">✅ Disetujui — Silakan temui koordinator</div>`;
        } else {
          footer = `<div class="income-msg">✅ Pemasukan tercatat</div>`;
        }
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
  } catch (e) { console.error(e); }
}

/* ─── Expense Detail ─── */
async function loadExpenseDetail() {
  try {
    const master = await api('getMaster');
    const expenses = master.filter(x => x.jenis === 'Pengeluaran');

    const total = expenses.reduce((sum, x) => sum + (parseFloat(x.jumlah) || 0), 0);
    $('expenseTotal').textContent = formatRupiah(total);
    $('expenseCount').textContent = expenses.length;

    const el = $('expenseList');
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
  } catch (e) { console.error(e); }
}

// Enter key on password
$('passwordInput').addEventListener('keypress', e => { if (e.key === 'Enter') doLogin(); });