const menuButton = document.querySelector('[data-menu-button]');
const navigation = document.querySelector('[data-navigation]');

if (menuButton && navigation) {
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    navigation.dataset.open = String(open);
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) {
      menuButton.setAttribute('aria-expanded', 'false');
      navigation.dataset.open = 'false';
    }
  });
}

const applicationForm = document.querySelector('#application-form');
if (applicationForm) {
  const startedAt = applicationForm.querySelector('[name="startedAt"]');
  if (startedAt) startedAt.value = new Date().toISOString();

  const ageRange = applicationForm.querySelector('[name="ageRange"]');
  const guardianPanel = applicationForm.querySelector('[data-guardian-fields]');
  const guardianInputs = guardianPanel?.querySelectorAll('[data-guardian-required]') || [];
  const submittedByGuardian = applicationForm.querySelector('[data-under-13-only]');

  function updateGuardianFields() {
    const minor = ageRange.value && ageRange.value !== '18-plus';
    guardianPanel.hidden = !minor;
    guardianInputs.forEach(input => { input.required = minor; });
    if (submittedByGuardian) submittedByGuardian.hidden = ageRange.value !== 'under-13';
  }
  ageRange?.addEventListener('change', updateGuardianFields);
  updateGuardianFields();

  applicationForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = applicationForm.querySelector('[type="submit"]');
    const status = applicationForm.querySelector('[data-form-status]');
    const success = document.querySelector('[data-application-success]');
    const data = Object.fromEntries(new FormData(applicationForm));

    applicationForm.querySelectorAll('[aria-invalid="true"]').forEach(field => field.removeAttribute('aria-invalid'));
    applicationForm.querySelectorAll('[data-error-for]').forEach(element => { element.textContent = ''; });
    status.className = 'form-status';
    status.textContent = 'Securely submitting…';
    button.disabled = true;

    try {
      const response = await fetch(applicationForm.action, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([name, message]) => {
            const field = applicationForm.elements.namedItem(name);
            if (field) field.setAttribute('aria-invalid', 'true');
            const error = applicationForm.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
            if (error) error.textContent = message;
          });
          applicationForm.querySelector('[aria-invalid="true"]')?.focus();
        }
        throw new Error(result.error || 'The application could not be submitted.');
      }
      applicationForm.hidden = true;
      success.hidden = false;
      success.querySelector('[data-reference]').textContent = result.reference;
      success.querySelector('[data-confirmation-note]').textContent = result.confirmationStatus === 'sent'
        ? 'A confirmation and copy of the application was emailed to every student and parent/guardian address provided.'
        : 'Your application is stored and visible in the protected admissions dashboard. Email could not be sent yet; the team can retry it after email delivery is configured.';
      success.focus();
    } catch (error) {
      status.className = 'form-status error';
      status.textContent = error.message === 'Failed to fetch'
        ? 'We could not reach the secure application service. Nothing was marked submitted. Please try again or contact both founders.'
        : error.message;
      button.disabled = false;
    }
  });
}

document.querySelectorAll('[data-deletion-form]').forEach(form => {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const status = form.querySelector('[data-form-status]');
    const button = form.querySelector('[type="submit"]');
    status.textContent = 'Sending a verification link…';
    status.className = 'form-status';
    button.disabled = true;
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The request could not be started.');
      status.textContent = result.message;
      form.reset();
    } catch (error) {
      status.textContent = error.message;
      status.className = 'form-status error';
    } finally {
      button.disabled = false;
    }
  });
});
