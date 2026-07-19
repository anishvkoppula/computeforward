const loginPanel = document.querySelector('[data-login-panel]');
const dashboard = document.querySelector('[data-dashboard]');
const loginForm = document.querySelector('[data-admin-login]');
const loginStatus = document.querySelector('[data-login-status]');
const dashboardStatus = document.querySelector('[data-dashboard-status]');
const rows = document.querySelector('[data-application-rows]');
const deletionRows = document.querySelector('[data-deletion-rows]');
const statusFilter = document.querySelector('[data-status-filter]');
const levelFilter = document.querySelector('[data-level-filter]');
const cohortFilter = document.querySelector('[data-cohort-filter]');
const currentCohortSelect = document.querySelector('[data-current-cohort]');
const setCurrentCohortButton = document.querySelector('[data-set-current-cohort]');
const cohortStatus = document.querySelector('[data-cohort-status]');
const cohortLedger = document.querySelector('[data-cohort-ledger]');
const STATUSES = ['submitted', 'reviewing', 'contacted', 'accepted', 'enrolled', 'completed', 'waitlisted', 'declined', 'withdrawn'];
const EXPERIENCE_LABELS = {
  none: 'No experience yet',
  exploring: 'Tutorials, classes, or block coding',
  projects: 'Some code and a small project',
  independent: 'Builds or solves independently',
  'not-collected': 'Not collected'
};
let applications = [];
let cohorts = [];
let adminToken = sessionStorage.getItem('cf_admin_token') || '';

function messageFromPayload(payload) {
  if (typeof payload === 'string') return payload.trim();
  if (!payload || typeof payload !== 'object') return '';
  if (Array.isArray(payload)) {
    return payload.map(messageFromPayload).find(Boolean) || '';
  }
  for (const key of ['message', 'error', 'detail', 'details']) {
    const message = messageFromPayload(payload[key]);
    if (message) return message;
  }
  return '';
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { 'content-type': 'application/json', accept: 'application/json', 'x-admin-token': adminToken, ...(options.headers || {}) }
    });
  } catch {
    throw new Error('The admin service could not be reached. Check your connection and try again.');
  }

  const body = await response.text();
  let result;
  try {
    result = body ? JSON.parse(body) : null;
  } catch {
    result = body;
  }

  if (!response.ok) {
    let message = messageFromPayload(result);
    if (response.status === 401) message = 'The admin token was not accepted.';
    else if (response.status >= 500) message = 'The admin service is unavailable because the server could not start. Check the deployment configuration and try again.';
    throw new Error(message || `Admin request failed (${response.status}).`);
  }
  if (!result || typeof result !== 'object') throw new Error('The admin service returned an invalid response.');
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
    (!levelFilter.value || application.level === levelFilter.value) &&
    (!cohortFilter.value || application.cohort.slug === cohortFilter.value)
  );
}

function cohortCell(cohort) {
  const element = document.createElement('td');
  const name = document.createElement('strong');
  name.textContent = cohort.name;
  const detail = document.createElement('span');
  detail.className = 'table-meta';
  detail.textContent = cohort.slug;
  element.append(name, document.createElement('br'), detail);
  return element;
}

function renderApplications() {
  rows.replaceChildren();
  for (const application of filteredApplications()) {
    const row = document.createElement('tr');
    row.append(cell(application.reference));
    row.append(mailCell(application.applicant.name, application.applicant.email));
    row.append(mailCell(application.applicant.guardianName, application.applicant.guardianEmail));
    row.append(cell(`${application.applicant.grade || '—'}\n${application.applicant.ageRange || '—'}`));
    row.append(cohortCell(application.cohort));
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
    const row = document.createElement('tr'); const empty = cell('No applications match this view.'); empty.colSpan = 11; row.append(empty); rows.append(row);
  }
}

function renderCohorts() {
  const current = cohorts.find(cohort => cohort.isCurrent);
  currentCohortSelect.replaceChildren(...cohorts.map(cohort => {
    const option = new Option(`${cohort.name} · ${cohort.applicationCount} application${cohort.applicationCount === 1 ? '' : 's'}`, cohort.id);
    option.selected = cohort.isCurrent;
    return option;
  }));
  setCurrentCohortButton.disabled = !currentCohortSelect.value || currentCohortSelect.value === current?.id;
  cohortFilter.replaceChildren(new Option('All cohorts', ''), ...cohorts.map(cohort => new Option(cohort.name, cohort.slug)));
  cohortLedger.replaceChildren(...cohorts.map(cohort => {
    const item = document.createElement('article');
    item.className = `cohort-ledger-item${cohort.isCurrent ? ' is-current' : ''}`;
    const label = document.createElement('p');
    label.textContent = cohort.isCurrent ? 'Current intake' : cohort.status;
    const title = document.createElement('h3');
    title.textContent = cohort.name;
    const count = document.createElement('strong');
    count.textContent = String(cohort.applicationCount);
    const detail = document.createElement('span');
    detail.textContent = `application${cohort.applicationCount === 1 ? '' : 's'} · ${cohort.applicationsOpen ? 'open' : 'closed'}`;
    item.append(label, title, count, detail);
    return item;
  }));
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
  dashboardStatus.className = 'form-status';
  dashboardStatus.textContent = 'Loading protected application data…';
  const [applicationResult, metricsResult, deletionResult, cohortResult] = await Promise.all([
    api('/api/admin/applications'), api('/api/admin/metrics'), api('/api/admin/deletion-requests'), api('/api/admin/cohorts')
  ]);
  applications = applicationResult.applications;
  cohorts = cohortResult.cohorts;
  const levels = [...new Set(applications.map(application => application.level))].sort();
  levelFilter.replaceChildren(new Option('All levels', ''), ...levels.map(level => new Option(level, level)));
  document.querySelector('[data-metric="total"]').textContent = metricsResult.metrics.total;
  document.querySelector('[data-metric="submitted"]').textContent = metricsResult.metrics.byStatus.submitted || 0;
  document.querySelector('[data-metric="failed"]').textContent = metricsResult.metrics.confirmation.failed || 0;
  renderCohorts(); renderApplications(); renderDeletions(deletionResult.requests);
  dashboardStatus.textContent = `Loaded ${applicationResult.count} application(s).`;
}

async function setCurrentCohort() {
  const id = currentCohortSelect.value;
  if (!id) return;
  setCurrentCohortButton.disabled = true;
  cohortStatus.className = 'form-status';
  cohortStatus.textContent = 'Updating where new applications are assigned…';
  try {
    const result = await api(`/api/admin/cohorts/${encodeURIComponent(id)}/current`, { method: 'PATCH', body: '{}' });
    cohortStatus.textContent = `${result.cohort.name} is now the current application cohort.`;
    await loadDashboard();
  } catch (error) {
    cohortStatus.textContent = error.message;
    cohortStatus.className = 'form-status error';
  } finally {
    setCurrentCohortButton.disabled = currentCohortSelect.value === cohorts.find(cohort => cohort.isCurrent)?.id;
  }
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
  event.preventDefault();
  adminToken = new FormData(loginForm).get('token').trim();
  const submitButton = loginForm.querySelector('button[type="submit"]');
  loginStatus.className = 'form-status';
  loginStatus.textContent = 'Verifying…';
  loginForm.setAttribute('aria-busy', 'true');
  submitButton.disabled = true;
  try {
    await api('/api/admin/metrics');
    sessionStorage.setItem('cf_admin_token', adminToken);
    loginPanel.hidden = true;
    dashboard.hidden = false;
    await loadDashboard();
  } catch (error) {
    loginStatus.textContent = error.message;
    loginStatus.className = 'form-status error';
  } finally {
    loginForm.removeAttribute('aria-busy');
    submitButton.disabled = false;
  }
});

document.querySelector('[data-refresh]').addEventListener('click', () => loadDashboard().catch(error => {
  dashboardStatus.textContent = error.message;
  dashboardStatus.className = 'form-status error';
}));
document.querySelector('[data-logout]').addEventListener('click', () => { sessionStorage.removeItem('cf_admin_token'); adminToken = ''; dashboard.hidden = true; loginPanel.hidden = false; loginForm.reset(); });
statusFilter.addEventListener('change', renderApplications);
levelFilter.addEventListener('change', renderApplications);
cohortFilter.addEventListener('change', renderApplications);
currentCohortSelect.addEventListener('change', () => {
  setCurrentCohortButton.disabled = currentCohortSelect.value === cohorts.find(cohort => cohort.isCurrent)?.id;
});
setCurrentCohortButton.addEventListener('click', setCurrentCohort);
document.querySelector('[data-export]').addEventListener('click', () => {
  const headers = ['reference','name','email','guardian_name','guardian_email','grade','age_range','cohort_name','cohort_slug','level','experience_level','coding_tools','project_experience','learning_goals','status','confirmation','submitted_at'];
  const quote = value => {
    let safeValue = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(safeValue)) safeValue = `'${safeValue}`;
    return `"${safeValue.replaceAll('"', '""')}"`;
  };
  const lines = [headers.join(','), ...filteredApplications().map(a => [a.reference,a.applicant.name,a.applicant.email,a.applicant.guardianName,a.applicant.guardianEmail,a.applicant.grade,a.applicant.ageRange,a.cohort.name,a.cohort.slug,a.level,a.experienceLevel,a.codingTools,a.projectExperience,a.learningGoals,a.status,a.confirmationStatus,a.submittedAt].map(quote).join(','))];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const link = document.createElement('a'); link.href = url; link.download = `computeforward-applications-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url);
});

if (adminToken) { loginForm.elements.token.value = adminToken; loginForm.requestSubmit(); }
