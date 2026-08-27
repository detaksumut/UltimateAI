# Journal Command Catalog

| Command | Aggregate | Handler | Authorization | Events Triggered |
| :--- | :--- | :--- | :--- | :--- |
| `SubmitArticleCommand` | `Submission` | `SubmitArticleHandler` | `Author (ACTIVE)` | `ManuscriptSubmitted` |
| `ExecuteDeskReviewCommand` | `Manuscript` | `ExecuteDeskReviewHandler` | `Editor` | `DeskReviewCompleted` |
| `AssignReviewerCommand` | `ReviewAssignment` | `AssignReviewerHandler` | `Editor` | `ReviewerInvited` |
| `RespondToInvitationCommand` | `ReviewAssignment` | `RespondToInvitationHandler` | `Reviewer` | `ReviewerDeclined` (if declined) |
| `SubmitReviewCommand` | `Review` | `SubmitReviewHandler` | `Reviewer` | `ReviewCompleted` |
| `RecordDecisionCommand` | `EditorialDecision` | `RecordDecisionHandler` | `Editor` | `EditorialDecisionRecorded` |
| `SubmitRevisionCommand` | `Manuscript` | `SubmitRevisionHandler` | `Author` | `RevisionSubmitted` |
| `RegisterDOICommand` | `Manuscript` | `RegisterDOIHandler` | `Editor` | `DOIRegistered` |
| `PublishIssueCommand` | `JournalIssue` | `PublishIssueHandler` | `Managing Editor` | `IssuePublished` |
| `RetractArticleCommand` | `Manuscript` | `RetractArticleHandler` | `Chief Editor` | `RetractionRequested` |
