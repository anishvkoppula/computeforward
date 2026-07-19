const loginPanel = document.querySelector('[data-login-panel]');
const dashboard = document.querySelector('[data-dashboard]');
const loginForm = document.querySelector('[data-admin-login]');
const loginStatus = document.querySelector('[data-login-status]');
const dashboardStatus = document.querySelector('[data-dashboard-status]');
const rows = document.querySelector('[data-application-rows]');
const deletionRows = document.querySelector('[data-deletion-rows]');
const statusFilter = document.querySelector('[data-status-filter]');
const levelFilter = document.querySelector('[data-level-filter]');
const STATUSES = ['submitted', 'reviewing', 'contacted', 'accepted', 'enrolled', 'completed', 'waitlisted', 'declined', 'withdrawn'];
const EXPERIENCE_LABELS = {
  none: 'No experience yet',
  exploring: 'Tutorials, classes, or block coding',
  projects: 'Some code and a small project',
  independent: 'Builds or solves independently',
  'not-collected': 'Not collected'
};
let applications = [];
let adminToken = sessionStorage.getItem('cf_admin_token') || '';

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', accept: 'application/json', 'x-admin-token': adminToken, ...(options.headers || {}) }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(response.status === 401 ? 'The admin token was not accepted.' : (result.error || 'Admin request failed.'));
  return result;
}

function cell(value = '') {
  const element = document.createElement('td');
  element.textContent = value == null ? '' : String(value);
  return element;
}

function mailCell(name, email) {
  const element = document.createElement('td');
  const strong = document.createElement('strong');
  strong.textContent = name || '—';
  const link = document.createElement('a');
  link.href = `mailto:${encodeURIComponent(email || '')}`;
  link.textContent = email || '—';
  element.append(strong, document.createElement('br'), link);
  return element;
}

function backgroundCell(application) {
  const element = document.createElement('td');
  const details = document.createElement('details');
  details.className = 'application-details';
  const summary = document.createElement('summary');
  summary.textContent = EXPERIENCE_LABELS[application.experienceLevel] || 'View answers';
  const list = document.createElement('dl');
  const answers = [
    ['Experience', EXPERIENCE_LABELS[application.experienceLevel] || application.experienceLevel || 'Not collected'],
    ['Languages, tools, or courses', application.codingTools || 'Not provided'],
    ['Project or problem', application.projectExperience || 'Not provided'],
    ['Learning goals', application.learningGoals || 'Not provided']
  ];
  for (const [label, value] of answers) {
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    list.append(term, description);
  }
  details.append(summary, list);
  element.append(details);
  return element;
}

function filteredApplications() {
  return applications.filter(application =>
    (!statusFilter.value || application.status === statusFilter.value) &&
    (!levelFilter.value || application.level === levelFilter.value)
  );
}

function renderApplications() {
  rows.replaceChildren();
  for (const application of filteredApplications()) {
    const row = document.createElement('tr');
    row.append(cell(application.reference));
    row.append(mailCell(application.applicant.name, application.applicant.email));
    row.append(mailCell(application.applicant.guardianName, application.applicant.guardianEmail));
    row.append(cell(`${application.applicant.grade || '—'}\n${application.applicant.ageRange || '—'}`));
    row.append(cell(application.level));
    row.append(backgroundCell(application));
    const statusCell = document.createElement('td');
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Status for ${application.reference}`);
    for (const value of STATUSES) {
      const option = document.createElement('option');
      option.value = value; option.textContent = value; option.selected = application.status === value;
      select.append(option);
    }
    select.addEventListener('change', () => updateStatus(application.id, select.value, select));
    statusCell.append(select); row.append(statusCell);
    row.append(cell(application.confirmationStatus));
    row.append(cell(new Date(application.submittedAt).toLocaleString()));
    const actionCell = document.createElement('td');
    const resend = document.createElement('button');
    resend.type = 'button'; resend.className = 'button button-secondary button-small'; resend.textContent = 'Resend email';
    resend.addEventListener('click', () => resendConfirmation(application.id, resend));
    actionCell.append(resend); row.append(actionCell);
    rows.append(row);
  }
  if (!rows.children.length) {
    const row = document.createElement('tr'); const empty = cell('No applications match this view.'); empty.colSpan = 10; row.append(empty); rows.append(row);
  }
}

function renderDeletions(requests) {
  deletionRows.replaceChildren();
  for (const request of requests) {
    const row = document.createElement('tr');
    row.append(cell(request.status), cell(request.email || 'Removed after completion'), cell(new Date(request.requestedAt).toLocaleString()), cell(new Date(request.completedAt || request.expiresAt).toLocaleString()), cell(request.deletedApplicationCount ?? '—'));
    deletionRows.append(row);
  }
  document.querySelector('[data-metric="deletions"]').textContent = requests.filter(request => request.status === 'pending').length;
}

async function loadDashboard() {
  dashboardStatus.textContent = 'Loading protected application data…';
  const [applicationResult, metricsResult, deletionResult] = await Promise.all([
    api('/api/admin/applications'), api('/api/admin/metrics'), api('/api/admin/deletion-requests')
  ]);
  applications = applicationResult.applications;
  const levels = [...new Set(applications.map(application => application.level))].sort();
  levelFilter.replaceChildren(new Option('All levels', ''), ...levels.map(level => new Option(level, level)));
  document.querySelector('[data-metric="total"]').textContent = metricsResult.metrics.total;
  document.querySelector('[data-metric="submitted"]').textContent = metricsResult.metrics.byStatus.submitted || 0;
  document.querySelector('[data-metric="failed"]').textContent = metricsResult.metrics.confirmation.failed || 0;
  renderApplications(); renderDeletions(deletionResult.requests);
  dashboardStatus.textContent = `Loaded ${applicationResult.count} application(s).`;
}

async function updateStatus(id, status, select) {
  select.disabled = true;
  try {
    const result = await api(`/api/admin/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    const index = applications.findIndex(application => application.id === id);
    applications[index] = result.application;
    dashboardStatus.textContent = `Updated ${result.application.reference} to ${status}.`;
  } catch (error) { dashboardStatus.textContent = error.message; dashboardStatus.className = 'form-status error'; await loadDashboard(); }
  finally { select.disabled = false; }
}

async function resendConfirmation(id, button) {
  button.disabled = true;
  try { const result = await api(`/api/admin/applications/${id}/resend-confirmation`, { method: 'POST', body: '{}' }); dashboardStatus.textContent = result.success ? 'Confirmation sent.' : 'Email is still pending; check SMTP and monitoring.'; await loadDashboard(); }
  catch (error) { dashboardStatus.textContent = error.message; dashboardStatus.className = 'form-status error'; }
  finally { button.disabled = false; }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault(); adminToken = new FormData(loginForm).get('token').trim(); loginStatus.textContent = 'Verifying…';
  try { await api('/api/admin/metrics'); sessionStorage.setItem('cf_admin_token', adminToken); loginPanel.hidden = true; dashboard.hidden = false; await loadDashboard(); }
  catch (error) { loginStatus.textContent = error.message; loginStatus.className = 'form-status error'; }
});

document.querySelector('[data-refresh]').addEventListener('click', () => loadDashboard().catch(error => { dashboardStatus.textContent = error.message; }));
document.querySelector('[data-logout]').addEventListener('click', () => { sessionStorage.removeItem('cf_admin_token'); adminToken = ''; dashboard.hidden = true; loginPanel.hidden = false; loginForm.reset(); });
statusFilter.addEventListener('change', renderApplications); levelFilter.addEventListener('change', renderApplications);
document.querySelector('[data-export]').addEventListener('click', () => {
  const headers = ['reference','name','email','guardian_name','guardian_email','grade','age_range','level','experience_level','coding_tools','project_experience','learning_goals','status','confirmation','submitted_at'];
  const quote = value => {
    let safeValue = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(safeValue)) safeValue = `'${safeValue}`;
    return `"${safeValue.replaceAll('"', '""')}"`;
  };
  const lines = [headers.join(','), ...filteredApplications().map(a => [a.reference,a.applicant.name,a.applicant.email,a.applicant.guardianName,a.applicant.guardianEmail,a.applicant.grade,a.applicant.ageRange,a.level,a.experienceLevel,a.codingTools,a.projectExperience,a.learningGoals,a.status,a.confirmationStatus,a.submittedAt].map(quote).join(','))];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const link = document.createElement('a'); link.href = url; link.download = `computeforward-applications-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url);
});

if (adminToken) { loginForm.elements.token.value = adminToken; loginForm.requestSubmit(); }
