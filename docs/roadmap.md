# ComputeForward Product Roadmap

**Roadmap horizon:** July–October 2026
**Primary objective:** Launch a trustworthy, safe, enrollment-ready website before promoting the next active cohort.
**Planning model:** Outcome-based phases with release gates

---

## 1. Roadmap Principles

- Trust and student safety take priority over visual polish.
- Unsupported claims are removed before new claims are added.
- Cohort logistics must be finalized before conversion optimization.
- The application workflow is not complete until submissions are stored and confirmed.
- Every phase ends with measurable acceptance criteria.
- Dates are planning targets and should be adjusted around the actual cohort launch date.

---

## 2. Priority Definitions

### P0 — Launch Blocking

A defect or missing capability that creates credibility, safety, privacy, legal, or application-loss risk.

### P1 — Conversion Critical

A capability needed for visitors to understand the program, evaluate fit, and complete a high-quality application.

### P2 — Growth and Scale

A capability that improves discoverability, reporting, content operations, or partnership readiness.

### P3 — Enhancement

A useful improvement that is not required for a safe and credible initial launch.

---

## 3. Phase Overview

| Phase | Target Window | Outcome |
|---|---|---|
| Phase 0: Stabilize | July 16–20, 2026 | Remove immediate credibility and application risks |
| Phase 1: Trust Foundation | July 21–31, 2026 | Publish complete logistics, team, safety, and policy information |
| Phase 2: Enrollment System | August 1–14, 2026 | Deliver a reliable, accessible application workflow |
| Phase 3: Program Depth | August 15–31, 2026 | Add detailed program pages, sample content, and parent guidance |
| Phase 4: Production Launch | September 1–10, 2026 | Move to a production domain and complete launch QA |
| Phase 5: Measure and Improve | September 11–October 15, 2026 | Optimize conversion and publish evidence-backed reporting |
| Phase 6: Scale | After October 15, 2026 | Add admissions, placement, partner, and alumni capabilities |

## Implementation checkpoint — July 17, 2026

The repository now contains the Phase 0 engineering fixes, the public trust/policy pages,
the enrollment backend and PostgreSQL model, program-depth content, security controls,
operations runbooks, and automated regression tests. These changes are **code-complete in
the working tree, not production-approved or deployed**.

Remaining launch gates require accountable human decisions or external configuration:

- Approve cohort dates, schedule, workload, capacity, and status.
- Supply founder biographies and active mentor profiles.
- Name the adult safeguarding owner and finish mentor screening/training.
- Obtain qualified privacy, terms, minor-consent, and safeguarding review.
- Select and configure the canonical domain, PostgreSQL, SMTP, monitoring, backups, and secrets.
- Run manual screen-reader, keyboard, mobile, email-delivery, restore, and incident tests in production.

---

# Phase 0: Stabilize

**Target:** July 16–20, 2026
**Priority:** P0
**Goal:** Prevent the live website from displaying contradictory, stale, or misleading information.

## Deliverables

### 0.1 Fix Impact Counters

- Render final metric values in the initial HTML.
- Remove zero-value placeholders from crawler-visible content.
- Support reduced motion and JavaScript-disabled states.
- Temporarily remove counters if verified values are unavailable.

**Owner:** Engineering
**Dependency:** Verified metric values
**Acceptance:** No visitor or crawler receives contradictory zero metrics.

### 0.2 Audit Claims and Testimonials

- Inventory every number, testimonial, promotion claim, and superlative.
- Record source, reporting period, owner, and publication status.
- Remove unsupported content.
- Mark unapproved testimonials as unpublished.

**Owner:** Product/Founder
**Dependency:** Historical records
**Acceptance:** Every public claim has an evidence record.

### 0.3 Correct Cohort Status

- Confirm whether a Summer 2026 cohort is still accepting applications.
- Add exact start date, end date, deadline, and current status when an active cohort is approved;
  until then publish an explicit interest-list state with no implied dates.
- Replace stale enrollment messaging with waitlist or next-cohort messaging where necessary.

**Owner:** Program Operations
**Dependency:** Cohort decision
**Acceptance:** The live status matches the actual program status on July 2026 dates.

### 0.4 Verify Contact and Form Behavior

- Test every CTA and footer link.
- Confirm where applications are stored.
- Verify that success appears only after a confirmed submission.
- Add a working contact email or contact form.

**Owner:** Engineering
**Dependency:** Access to current form backend
**Acceptance:** No dead CTAs and no false application success state.

## Exit Gate

Phase 0 is complete when the site contains no known contradictory metrics, unsupported testimonials, stale cohort labels, broken CTAs, or unverified form-success behavior.

---

# Phase 1: Trust Foundation

**Target:** July 21–31, 2026
**Priority:** P0/P1
**Goal:** Give students and parents enough information to evaluate legitimacy, fit, safety, and commitment.

## Deliverables

### 1.1 Cohort Logistics Component

Create one reusable source of truth for:

- Cohort name
- Start and end dates
- Application deadline
- Meeting days and times
- Time zone
- Weekly workload
- Delivery format
- Seat limit
- Cost
- Application status

**Owner:** Product + Engineering
**Acceptance:** Logistics are consistent across homepage, program pages, FAQ, and application.

### 1.2 Team Page

- Founder biography and headshot
- Relevant experience and profile links
- Active mentor profiles
- Organizational status
- Funding and operating model
- Adult oversight description, where applicable

**Owner:** Founder/Content
**Acceptance:** A parent can identify the responsible people and their qualifications.

### 1.3 Student Safety Policy

- Approved communication channels
- One-to-one mentorship rules
- Session visibility or auditability
- Mentor conduct
- Student conduct
- Reporting and escalation
- Consent for recordings, images, and testimonials

**Owner:** Program Operations
**Dependency:** Legal or qualified policy review
**Acceptance:** The policy is published and acknowledged by active mentors.

### 1.4 Privacy and Terms

- Privacy policy
- Terms of participation
- Data-retention statement
- Parent or guardian rights
- Contact for deletion or privacy requests
- Application consent language

**Owner:** Operations/Legal Review
**Acceptance:** Policies are live and linked from the form and footer.

### 1.5 Parent Information Section

- Safety summary
- Time commitment
- Technology requirements
- Supervision model
- Communication expectations
- Application and admissions process

**Owner:** Content/Design
**Acceptance:** Parent concerns are addressed before the application CTA.

## Exit Gate

Phase 1 is complete when a parent can understand who runs the program, what the commitment is, how students are protected, and how data is handled.

---

# Phase 2: Enrollment System

**Target:** August 1–14, 2026
**Priority:** P0/P1
**Goal:** Build a durable, accessible, transparent application workflow.

## Deliverables

### 2.1 Application Data Model and Backend

- Applicant, application, cohort, consent, and status records
- Durable storage
- Server-side validation
- Duplicate handling
- Rate limiting and spam protection
- Role-restricted access

**Owner:** Engineering
**Acceptance:** Every successful submission creates a durable application record.

### 2.2 Accessible Application Form

- Visible labels
- Clear instructions
- Appropriate field types
- Keyboard navigation
- Screen-reader error announcements
- Accessible consent controls
- Mobile layout
- Progress indicator if the form is multi-step

**Owner:** Design + Engineering
**Acceptance:** No critical or high-severity accessibility issues in the form.

### 2.3 Confirmation Workflow

- Unique application reference
- On-screen confirmation
- Transactional confirmation email
- Internal admissions notification
- Expected response timeline
- Contact path for missing confirmation

**Owner:** Engineering + Operations
**Acceptance:** At least 98% confirmation email delivery in production testing and no false success states.

### 2.4 Failure Handling and Monitoring

- Error logging
- Failed-submission alerting
- Retry guidance
- Privacy-safe telemetry
- Delivery monitoring

**Owner:** Engineering
**Acceptance:** The team can detect and diagnose a failed submission without collecting unnecessary sensitive data.

### 2.5 Application Content Review

- Remove unnecessary fields
- Use a required 6th–12th grade selector plus age-range logic
- Collect concise coding-experience, tools/project, and learning-goal answers for human placement
- Add parent contact and consent when required
- Explain selection criteria
- Explain next steps

**Owner:** Product + Operations
**Acceptance:** Every field has a documented operational purpose.

## Exit Gate

Phase 2 is complete when a student can submit an application on mobile or desktop, receive confirmation, and trust that the application was stored.

---

# Phase 3: Program Depth

**Target:** August 15–31, 2026
**Priority:** P1
**Goal:** Improve application quality by helping students choose the correct program and understand the learning experience.

## Deliverables

### 3.1 Dedicated Program Pages

Launch:

- Python Foundations
- Applied AI and Machine Learning
- Algorithms and Competitive Programming
- Passion Project and Research
- Curriculum overview

Each page includes prerequisites, weekly topics, workload, assessments, progression requirements, and expected outcomes.

**Owner:** Curriculum + Content + Engineering
**Acceptance:** Visitors can accurately distinguish levels and select an appropriate program.

### 3.2 How the Program Works

Publish a concrete weekly model covering workshops, assignments, feedback, office hours, code review, and mock contests.

**Owner:** Program Operations
**Acceptance:** A visitor can describe a typical week without contacting the team.

### 3.3 Sample Lesson or Problem Set

- One representative lesson
- One representative assignment or problem set
- Expected time and prerequisite labels
- Optional solution excerpt or walkthrough

**Owner:** Curriculum
**Acceptance:** The sample accurately represents program difficulty and teaching quality.

### 3.4 Placement Guidance

- Self-assessment checklist
- Recommended starting level
- Rules for moving between levels
- Optional lightweight placement quiz specification

**Owner:** Curriculum/Product
**Acceptance:** Application-level mismatch is measurable and reduced after launch.

### 3.5 Comprehensive FAQ

Cover admissions, cost, scheduling, technology, levels, recordings, safety, and outcomes.

**Owner:** Content/Operations
**Acceptance:** Common pre-application questions are answered consistently.

## Exit Gate

Phase 3 is complete when students understand the actual learning model and can choose a level with minimal ambiguity.

---

# Phase 4: Production Launch

**Target:** September 1–10, 2026
**Priority:** P0/P1/P2
**Goal:** Launch on a credible production foundation with complete quality assurance.

## Deliverables

### 4.1 Brand and Domain Decision

- Review the ComputeForward naming collision
- Select the permanent organization name
- Register a custom domain
- Configure branded email
- Set canonical redirects

**Owner:** Founder
**Dependency:** Naming and trademark review
**Acceptance:** One approved production domain and one canonical site version.

### 4.2 SEO Foundation

- Search-focused titles and descriptions
- Sitemap
- Robots configuration
- Canonical tags
- Open Graph metadata
- Structured data where accurate
- Indexable program pages

**Owner:** Engineering/Content
**Acceptance:** No duplicate deployment URLs are intended for indexing.

### 4.3 Performance QA

- Optimize images and fonts
- Reduce unused scripts
- Validate responsive layouts
- Test slow networks
- Test without JavaScript
- Validate Core Web Vitals targets

**Owner:** Engineering
**Acceptance:** Performance targets in the PRD are met or exceptions are documented.

### 4.4 Accessibility QA

- Automated audit
- Keyboard-only review
- Screen-reader review
- Reduced-motion review
- Form error review
- Contrast review

**Owner:** Design + Engineering + Reviewer
**Acceptance:** Zero critical and high-severity findings.

### 4.5 Security and Privacy QA

- Security headers
- Content Security Policy
- Secret review
- Dependency audit
- Database permission review
- Analytics privacy review
- Data deletion test

**Owner:** Engineering + Operations
**Acceptance:** No known critical security issue and deletion workflow is verified.

### 4.6 Launch Runbook

- Prelaunch checklist
- Rollback plan
- Form test
- Email test
- Analytics test
- Monitoring test
- Content signoff
- Post-deployment verification

**Owner:** Product/Engineering
**Acceptance:** Named owners sign off on every launch gate.

## Exit Gate

Phase 4 is complete when the site is live on the approved domain, all release criteria in the PRD are met, and the application funnel is monitored.

---

# Phase 5: Measure and Improve

**Target:** September 11–October 15, 2026
**Priority:** P2
**Goal:** Use real visitor and application data to improve clarity, conversion, and operational efficiency.

## Deliverables

### 5.1 Funnel Dashboard

Track:

- Program-page engagement
- Apply CTA clicks
- Application starts
- Validation errors
- Abandonment
- Submission success
- Confirmation delivery
- Level selection

**Owner:** Product/Engineering
**Acceptance:** Weekly funnel reporting contains no form-response content or sensitive personal data.

### 5.2 Application Quality Review

- Identify common level mismatches
- Identify unclear questions
- Measure incomplete or low-information responses
- Review applicant questions received through contact channels

**Owner:** Admissions/Product
**Acceptance:** At least one evidence-based form or content improvement is shipped.

### 5.3 Outcome Reporting Framework

- Metric dictionary
- Cohort reporting template
- Evidence registry
- Consent workflow for stories
- Small-sample disclosure rules

**Owner:** Product/Operations
**Acceptance:** Future metrics can be published with definitions, periods, and sources.

### 5.4 Conversion Experiments

Potential tests:

- Hero positioning
- Sample lesson CTA
- Parent information placement
- Application form length
- Program comparison format

**Owner:** Product/Design
**Acceptance:** Experiments have predefined hypotheses and guardrails; safety and policy content is never hidden for conversion gains.

### 5.5 Search Content Expansion

- Improve program pages based on search queries
- Publish substantive guides related to Python foundations and competitive programming preparation
- Add internal linking

**Owner:** Content
**Acceptance:** New pages provide unique educational value and are not thin SEO pages.

## Exit Gate

Phase 5 is complete when the team has a trustworthy measurement system and has shipped improvements based on observed behavior rather than assumptions.

---

# Phase 6: Scale

**Target:** After October 15, 2026
**Priority:** P2/P3
**Goal:** Support repeated cohorts, partnerships, mentors, and student progression without rebuilding core operations.

## Candidate Initiatives

### Admissions Dashboard

- Review queue
- Status changes
- Reviewer assignment
- Notes and audit history
- Export controls

### Placement Quiz

- Skill-based questions
- Recommended level
- Application prefill
- Clear statement that results are guidance, not admission decisions

### Waitlist and Cohort Notifications

- Join waitlist
- Cohort opening email
- Consent and unsubscribe management

### Mentor Recruitment

- Mentor role descriptions
- Application form
- Screening and references
- Conduct acknowledgement
- Training checklist

### Partner Referral Program

- School or nonprofit referral links
- Partner information pages
- Aggregate referral reporting

### Student Progress Experience

- Assignment tracking
- Feedback history
- Attendance
- Progress milestones
- Parent visibility model where appropriate

### Alumni and Outcome Stories

- Structured consent
- Case-study template
- Cohort and starting-level context
- Verified outcomes

---

## 4. Workstream Ownership

| Workstream | Primary Owner | Supporting Roles |
|---|---|---|
| Product scope and prioritization | Product owner/founder | Engineering, curriculum, operations |
| Curriculum and placement | Curriculum lead | Mentors, product |
| Website engineering | Engineering lead | Design, product |
| Visual and interaction design | Designer | Engineering, content |
| Program operations | Operations lead | Founder, mentors |
| Student safety | Safeguarding owner | Operations, legal reviewer |
| Privacy and terms | Operations/legal reviewer | Engineering, founder |
| Admissions | Admissions owner | Product, operations |
| Content and evidence | Content owner | Founder, curriculum, operations |
| Analytics and reporting | Product/engineering | Admissions, operations |

One person may hold multiple roles, but every workstream needs a named accountable owner.

---

## 5. Critical Path

The launch-critical sequence is:

1. Confirm organization name, cohort status, dates, schedule, capacity, and eligibility.
2. Verify or remove all claims and testimonials.
3. Finalize privacy, consent, communication, and safeguarding rules.
4. Build the durable application backend.
5. Implement the accessible form and confirmation workflow.
6. Publish team, logistics, parent, policy, and FAQ content.
7. Complete accessibility, security, privacy, mobile, and form QA.
8. Configure the custom domain, canonical URLs, monitoring, and launch runbook.

A delay in steps 1–3 blocks accurate implementation of later phases.

---

## 6. Backlog by Priority

## P0

- Fix zero counters
- Verify or remove claims
- Correct cohort status
- Add exact logistics
- Publish team identity
- Publish privacy, terms, and safety policies
- Implement durable form storage
- Add confirmation email
- Prevent false success states
- Add accessible labels and errors
- Configure monitoring and security controls

## P1

- Program detail pages
- Parent information
- How-it-works section
- Sample lesson
- Placement guidance
- Comprehensive FAQ
- Custom domain and branded email
- SEO metadata

## P2

- Funnel analytics
- Evidence registry
- Cohort outcome reports
- Search content expansion
- Admissions dashboard
- Waitlist automation
- Mentor recruitment workflow

## P3

- Placement quiz
- Student progress dashboard
- Partner referral reporting
- Alumni case-study library
- Parent portal

---

## 7. Release Checklist

### Content

- [ ] Cohort dates are current
- [ ] Schedule and workload are accurate
- [ ] Every metric is verified
- [ ] Every testimonial has consent
- [ ] Team profiles are approved
- [ ] FAQ matches current operations
- [ ] No unsupported guarantee remains

### Application

- [ ] Submission persists in the database
- [ ] Confirmation email is delivered
- [ ] Error state is tested
- [ ] Duplicate handling is tested
- [ ] Consent logic is tested
- [ ] Mobile completion is tested

### Safety and Privacy

- [ ] Privacy policy is live
- [ ] Terms are live
- [ ] Student safety policy is live
- [ ] Reporting contact works
- [ ] Data deletion process is tested
- [ ] Mentor conduct acknowledgement is complete

### Technical

- [ ] Custom domain is configured
- [ ] Canonical redirects work
- [ ] Sitemap and robots are valid
- [ ] Security headers are enabled
- [ ] Error monitoring is enabled
- [ ] Analytics excludes sensitive data
- [ ] JavaScript-disabled experience is usable

### Accessibility

- [ ] Keyboard navigation passes
- [ ] Screen-reader form flow passes
- [ ] Focus states are visible
- [ ] Error messages are announced
- [ ] Contrast passes
- [ ] Reduced motion is respected

### Operations

- [ ] Admissions owner is assigned
- [ ] Response-time commitment is realistic
- [ ] Launch rollback owner is assigned
- [ ] Post-launch form test is completed
- [ ] Incident escalation path is documented

---

## 8. Roadmap Success Definition

This roadmap succeeds when ComputeForward can promote an active cohort with confidence that:

- Program information is complete and current.
- Published evidence is accurate and explainable.
- Students and parents know who operates the program.
- Student communication and data practices are documented and enforced.
- Applications are reliably stored and confirmed.
- The experience is accessible on mobile and assistive technology.
- The team can measure and improve the funnel without exposing student data.
