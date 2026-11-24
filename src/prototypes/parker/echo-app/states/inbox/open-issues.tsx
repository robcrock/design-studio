/** @studio-id 251pw5engqagm142 */
// State: the feedback inbox after clicking the Open issues metric on the overview. Everything not resolved, and a bar saying so.
import { FeedbackInboxScreen } from '../../app/feedback-inbox';

export default function FeedbackOpenIssues() {
  return <FeedbackInboxScreen filter={{ status: 'open', priority: null }} />;
}
