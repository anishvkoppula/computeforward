# Compute Forward — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | Compute Forward platform (marketing site + application system) |
| **Owners** | Anish Koppula, Kaushik Atla |
| **Website** | https://compute-forward.vercel.app/ |
| **Contact** | anishkoppula@gmail.com · kaushik.atla@gmail.com |
| **Status** | Living document — last updated 2026-07-18 |
| **Related** | [ORGANIZATION.md](./ORGANIZATION.md) — brand & program context |

> **Purpose of this document.** This PRD captures the full context of Compute Forward —
> what the organization is, who it serves, and what the software product must do —
> so that anyone (or any AI assistant) can pick up work with complete background.

---

## 1. Overview

Compute Forward is a free, student-led computer science education organization that
moves students from zero programming experience to competition-ready skill through a
structured, multi-level pipeline. The **product** in this repo is the public-facing
**website** and the **application intake system** that powers enrollment.

The website's job is to:
1. Communicate the mission, principles, and curriculum credibly.
2. Convert motivated students into **applicants** via a simple, free application form.
3. Capture and organize those applications for the founders to act on within 48 hours.

---

## 2. Problem Statement

Most students who want to learn CS face:
- **Fragmentation** — disjointed YouTube videos and disconnected courses.
- **No accountability** — nothing keeping them progressing.
- **Cost barriers** — quality enrichment and tutoring are expensive.
- **No clear path** — no defined progression from beginner to competition-ready.

Compute Forward replaces this with **structure, community, real progression, and zero cost.**
The product must make this difference *immediately legible* to a prospective student and
remove all friction from applying.

---

## 3. Goals & Non-Goals

### Goals
- Present Compute Forward as a serious, structured organization (not a one-off workshop).
- Clearly explain the **4-level curriculum pipeline** and who each level is for.
- Make applying **fast, free, and frictionless** — minimal fields, instant confirmation.
- **Reliably capture** every application so none are lost.
- Reinforce credibility through outcomes (USACO promotions, completion rate, reach).

### Non-Goals (for now)
- A student login / learning-management system (no course delivery in-product yet).
- Payments or billing — the program is permanently free.
- Public student dashboards or social features.
- Automated admissions decisions — review is human and manual.

---

## 4. Target Users / Personas

| Persona | Description | What they need from the product |
|---|---|---|
| **The Beginner** | Self-motivated student, little/no coding experience, no access to paid enrichment. | A trustworthy on-ramp; reassurance that "no experience" is truly okay (Level 1). |
| **The Climber** | Has Python basics, wants AI/ML or competitive programming. | Clear sense of which level fits; evidence of rigor and outcomes. |
| **The Builder** | Advanced student ready for an independent project or research. | Signal that Level 4 offers real mentorship and portfolio-grade output. |
| **The Founders (admin)** | Anish & Kaushik, reviewing applications. | A private, organized view of incoming applications with contact details. |

Audience is broadly **K–12 students**, weighted toward middle/high school.

---

## 5. Core Principles (product must reflect these)

- **Free & accessible** — never imply cost; "Free forever" messaging is load-bearing.
- **Student-led** — tone is credible but peer-to-peer, not corporate.
- **Outcome-driven** — surface measurable results, not vanity claims.
- **Cohort-based** — emphasize community, accountability, mentorship.
- **Competition-grounded** — rigor mapped to USACO Bronze→Gold.

---

## 6. Curriculum (the 4-level pipeline)

One unified pipeline; each level builds on the previous. *Full curriculum details coming soon.*

| Level | Title | Duration | Target | Goal |
|---|---|---|---|---|
| **1** | Python Foundations | 8 weeks | Absolute beginners, no experience | Master Python + computational thinking; build real projects |
| **2** | Applied AI & Machine Learning | 8 weeks | Completed L1 / baseline Python | Build with AI — NumPy, pandas, scikit-learn, intro neural nets (TensorFlow/PyTorch); applied mini-projects |
| **3** | Algorithms & Competitive Programming | 10 weeks | Intermediate–advanced, USACO Bronze→Silver | Core data structures, algorithmic patterns, contest strategy, mock contests |
| **4** | Passion Project & Research | Ongoing, mentor-guided | Completed prior levels / strong independent readiness | Build something real — AI app, research paper, startup prototype, or tool; portfolio-grade |

---

## 7. Admissions Flow

1. Applications are **rolling** (always open).
2. Student picks a **level** and submits contact information, a 6th–12th grade selection, and short coding-background and learning-goal answers.
3. **Level 1** requires no prior experience; **Levels 2–4** expect completion of the preceding level.
4. Founders respond **within 48 hours**.
5. **Free at every stage, permanently.**

---

## 8. Functional Requirements

### 8.1 Marketing site
- **FR-1** Responsive single-page site communicating mission, principles, curriculum, outcomes, and testimonials.
- **FR-2** Persistent navigation with anchor links and a prominent "Apply Now" CTA.
- **FR-3** Curriculum section presenting each level with duration, target, and goal.
- **FR-4** Outcomes/impact section with key metrics.
- **FR-5** Accessible (keyboard nav, reduced-motion support, sufficient contrast).

### 8.2 Application system
- **FR-6** Application form collecting **name, student email, 6th–12th grade, age range, level, coding background, learning goals, and guardian contact/authorization for minors**.
- **FR-7** Client- and server-side validation using grade, age, level, and experience allowlists plus strict answer-length limits.
- **FR-8** On submit, deliver the application to the first-party `POST /api/apply`
  service and persist it to production PostgreSQL before reporting success.
  - Transactional email sends the stored reference and a copy of the application to every student and guardian address provided, and separately notifies admissions.
  - Email delivery state is tracked separately and may be retried by an administrator.
  - An opened email client, client-side third-party form service, or other unverified fallback
    must never be presented as a successful application.
- **FR-9** Show an immediate confirmation state ("Application Received") after success.

### 8.3 Admin
- **FR-10** Private admin view listing all applications (contact, grade/age, level, coding-background answers, status, email state, and timestamp), newest first.
- **FR-11** Admin access protected by a secret token; unauthorized requests are rejected.
- **FR-12** Applicant data must **not** be committed to version control (privacy).

---

## 9. Non-Functional Requirements

- **Performance** — fast first paint; no heavy frameworks required for the marketing page.
- **Reliability** — no application is silently lost; layered delivery guarantees capture.
- **Privacy** — applicant PII (emails) stays out of git; admin is token-gated.
- **Maintainability** — minimal dependencies; approachable for student maintainers.
- **Portability** — runs locally, on common Node hosts, and through a serverless entry point;
  static-only deployment may serve information but is not enrollment-ready.
- **Accessibility** — WCAG-minded: contrast, keyboard support, `prefers-reduced-motion`.

---

## 10. Current Implementation (as of 2026-07-17)

| Area | Status | Notes |
|---|---|---|
| Public site | ✅ Built in repo | Authoritative four-level content; truthful interest-list status; responsive, accessible field-guide design. |
| Program/family/team content | ✅ Built in repo | Program depth, placement, sample lesson, family guide, and explicit accountability gaps. |
| Policies | ⚠️ Drafted; review required | Versioned privacy, terms, and student safety policies are published in code; qualified review remains a launch gate. |
| Application form | ✅ Built in repo | 6th–12th grade selector, concise coding-background and goal questions, accessible labels/errors, no-JS flow, minor/guardian rules, versioned consent, truthful receipt. |
| Backend | ✅ Built in repo | Express, strict validation, anti-abuse controls, request IDs, health/readiness, and restricted admin APIs. |
| Production storage | ✅ Code ready; provider pending | PostgreSQL schema/migration plus development-only atomic file adapter and legacy preservation. |
| Confirmation | ✅ Code ready; provider pending | SMTP application copy to student and guardian, internal notification, delivery status, admin retry. |
| Privacy workflow | ✅ Built in repo | One-hour verified deletion token removes applicant/application/consent records. |
| Admin dashboard | ✅ Built in repo | Session-only token, status workflow, metrics, deletion visibility, confirmation retry, explicit CSV export. |
| Monitoring/security | ✅ Built in repo | CSP/headers, production config gates, PII-safe logs, optional alert webhook, regression tests. |
| Production launch | ⚠️ Not complete | Requires database/SMTP providers, secrets, canonical domain, provider inventory, legal/safeguarding review, and named owners. |

---

## 11. Remaining launch gaps

| Gap | Why code cannot decide it | Required owner action |
|---|---|---|
| Exact cohort logistics and capacity | No approved dates, times, workload, or seat limit were supplied | Program Operations approves one cohort brief and updates `program-config.json` |
| Founder biographies/profile links | Source records contain names and emails only | Each founder supplies and approves accurate material |
| Mentor roster and screening | No active roster or screening process was supplied | Safeguarding/Operations completes and publishes it before instruction |
| Adult oversight and safeguarding owner | Student-led status is known; accountable adult structure is not | Founders name the responsible adult and escalation coverage |
| Organizational/funding status | Not documented | Founder publishes accurate operating/legal/funding disclosure |
| Policy review | Repository drafts cannot replace qualified jurisdiction-specific review | Qualified legal and safeguarding reviewers approve or revise policies |
| Production providers | Database, SMTP, monitoring, and custom domain are not selected/configured | Engineering/Operations completes the provider inventory and deployment runbook |
| Evidence-backed outcomes | No verified metric or testimonial records were supplied | Product/Operations completes `CLAIMS.md` evidence entries before publication |

---

## 12. Future / Roadmap (candidate)

- Retention reporting and alerting beyond the implemented scheduled enforcement command.
- Role-based administrator identities beyond the launch shared high-entropy token.
- Per-cohort capacity enforcement and waitlist notifications.
- Published, curriculum-owner-approved weekly syllabi.
- Lightweight analytics on application conversion.

---

## 13. Success Metrics

- **Applications submitted** per cohort window.
- **Capture reliability** — % of submissions successfully stored/emailed (target: 100%).
- **Time-to-response** — applications answered within **48 hours**.
- **Conversion** — site visitors → submitted applications.
- **Outcomes** (program-level) — USACO promotions, problems solved, project completions, completion rate.
