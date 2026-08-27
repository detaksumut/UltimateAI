# Journal Domain Event Catalog

| Event Name | Aggregate | Trigger Command | Domain Event | Integration Event | Consumers | Version |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ManuscriptSubmitted` | `Submission` | `SubmitArticleCommand` | `ManuscriptSubmitted` | `Apasific.Journal.ManuscriptSubmitted.v1` | Application (Notification Service) | v1.0 |
| `DeskReviewCompleted` | `Manuscript` | `ExecuteDeskReviewCommand` | `DeskReviewCompleted` | `Apasific.Journal.DeskReviewCompleted.v1` | Editor Dashboard | v1.0 |
| `ReviewerInvited` | `ReviewAssignment` | `AssignReviewerCommand` | `ReviewerInvited` | `Apasific.Journal.ReviewerInvited.v1` | Notification Service | v1.0 |
| `ReviewerDeclined` | `ReviewAssignment` | `RespondToInvitationCommand` | `ReviewerDeclined` | `Apasific.Journal.ReviewerDeclined.v1` | Editor Dashboard | v1.0 |
| `ReviewCompleted` | `Review` | `SubmitReviewCommand` | `ReviewCompleted` | `Apasific.Journal.ReviewCompleted.v1` | EditorialPolicyService | v1.0 |
| `EditorialDecisionRecorded` | `EditorialDecision` | `RecordDecisionCommand` | `EditorialDecisionRecorded` | `Apasific.Journal.DecisionRecorded.v1` | Publication / Notification | v1.0 |
| `RevisionRequested` | `Manuscript` | `RecordDecisionCommand` | `RevisionRequested` | `Apasific.Journal.RevisionRequested.v1` | Author Dashboard | v1.0 |
| `ManuscriptAccepted` | `Manuscript` | `RecordDecisionCommand` | `ManuscriptAccepted` | `Apasific.Journal.ManuscriptAccepted.v1` | JournalIssue / Production | v1.0 |
| `ManuscriptRejected` | `Manuscript` | `RecordDecisionCommand` | `ManuscriptRejected` | `Apasific.Journal.ManuscriptRejected.v1` | Notification Service | v1.0 |
| `DOIRegistered` | `Manuscript` | `RegisterDOICommand` | `DOIRegistered` | `Apasific.Journal.DOIRegistered.v1` | External DOI Registry | v1.0 |
| `IssuePublished` | `JournalIssue` | `PublishIssueCommand` | `IssuePublished` | `Apasific.Journal.IssuePublished.v1` | Research Platform | v1.0 |
| `RetractionRequested` | `Manuscript` | `RetractArticleCommand` | `RetractionRequested` | `Apasific.Journal.RetractionRequested.v1` | Public Article Directory | v1.0 |
