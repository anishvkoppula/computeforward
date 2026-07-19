const button = document.querySelector('[data-confirm-delete]');
const status = document.querySelector('[data-delete-status]');
const token = new URLSearchParams(window.location.search).get('token') || '';

if (!token) {
  status.textContent = 'This link is missing its confirmation token.';
  status.className = 'form-status error';
  button.disabled = true;
}

button?.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Deleting verified records…';
  try {
    const response = await fetch('/api/privacy/deletion-confirmations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ token })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Deletion could not be completed.');
    status.textContent = `Deletion complete. ${result.deletedApplicationCount} application record(s) were removed.`;
    button.hidden = true;
    window.history.replaceState({}, '', '/privacy/delete');
  } catch (error) {
    status.textContent = error.message;
    status.className = 'form-status error';
    button.disabled = false;
  }
});
