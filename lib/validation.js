const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AGE_RANGES = new Set(['under-13', '13-17', '18-plus']);
const GRADES = new Set(['6th', '7th', '8th', '9th', '10th', '11th', '12th']);
const EXPERIENCE_LEVELS = new Set(['none', 'exploring', 'projects', 'independent']);
const APPLICATION_STATUSES = new Set([
  'submitted',
  'reviewing',
  'contacted',
  'accepted',
  'enrolled',
  'completed',
  'waitlisted',
  'declined',
  'withdrawn'
]);

function text(value, maxLength) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength + 1);
}

function email(value) {
  return text(value, 254).toLowerCase();
}

function checked(value) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

export function validateApplication(body, program) {
  const input = {
    name: text(body.name, 120),
    email: email(body.email),
    grade: text(body.grade, 10),
    ageRange: text(body.ageRange, 20),
    guardianName: text(body.guardianName, 120),
    guardianEmail: email(body.guardianEmail),
    level: text(body.level, 120),
    experienceLevel: text(body.experienceLevel, 30),
    codingTools: text(body.codingTools, 300),
    projectExperience: text(body.projectExperience, 600),
    learningGoals: text(body.learningGoals, 600),
    cohortSlug: text(body.cohortSlug, 80) || program.currentCohort.slug,
    privacyConsent: checked(body.privacyConsent),
    termsConsent: checked(body.termsConsent),
    safetyConsent: checked(body.safetyConsent),
    guardianConsent: checked(body.guardianConsent),
    submittedByGuardian: checked(body.submittedByGuardian),
    communicationsConsent: checked(body.communicationsConsent),
    website: text(body.website, 200),
    startedAt: text(body.startedAt, 40)
  };
  const errors = {};
  const validLevels = new Set(program.levels.map(level => level.value));

  if (!input.name || input.name.length > 120) errors.name = 'Enter the applicant’s full name.';
  if (!EMAIL_RE.test(input.email)) errors.email = 'Enter a valid contact email address.';
  if (!GRADES.has(input.grade)) errors.grade = 'Select a grade from 6th through 12th.';
  if (!AGE_RANGES.has(input.ageRange)) errors.ageRange = 'Select the applicant’s age range.';
  if (!validLevels.has(input.level)) errors.level = 'Select a valid program level.';
  if (!EXPERIENCE_LEVELS.has(input.experienceLevel)) errors.experienceLevel = 'Select the answer that best describes the applicant’s coding experience.';
  if (input.codingTools.length > 300) errors.codingTools = 'Keep this answer to 300 characters or fewer.';
  if (input.projectExperience.length > 600) errors.projectExperience = 'Keep this answer to 600 characters or fewer.';
  if (input.learningGoals.length < 10 || input.learningGoals.length > 600) errors.learningGoals = 'Tell us what the applicant hopes to learn or make in 10–600 characters.';
  if (input.cohortSlug !== program.currentCohort.slug) errors.cohortSlug = 'Select the current application period.';

  if (input.ageRange === 'under-13' && !input.submittedByGuardian) {
    errors.submittedByGuardian = 'A parent or legal guardian must submit for applicants under 13.';
  }
  if (input.ageRange !== '18-plus') {
    if (!input.guardianName || input.guardianName.length > 120) {
      errors.guardianName = 'Enter a parent or guardian name for applicants under 18.';
    }
    if (!EMAIL_RE.test(input.guardianEmail)) {
      errors.guardianEmail = 'Enter a valid parent or guardian email for applicants under 18.';
    }
    if (!input.guardianConsent) {
      errors.guardianConsent = 'Parent or guardian authorization is required for applicants under 18.';
    }
  }

  if (!input.privacyConsent) errors.privacyConsent = 'Review and accept the Privacy Policy.';
  if (!input.termsConsent) errors.termsConsent = 'Review and accept the Terms of Participation.';
  if (!input.safetyConsent) errors.safetyConsent = 'Review and accept the Student Safety Policy.';

  return { input, errors, valid: Object.keys(errors).length === 0 };
}

export function validateEmail(value) {
  const normalized = email(value);
  return { value: normalized, valid: EMAIL_RE.test(normalized) };
}

export function validateStatus(value) {
  const normalized = text(value, 30);
  return { value: normalized, valid: APPLICATION_STATUSES.has(normalized) };
}

export function validateId(value) {
  const normalized = text(value, 80);
  return /^[0-9a-f-]{36}$/i.test(normalized) ? normalized : '';
}

export { APPLICATION_STATUSES, EXPERIENCE_LEVELS, GRADES };
