/** @studio-id gcpx47czy7a6rfat */
// State: no feedback at all. It runs on data of its own, so the real data is untouched.
import { FeedbackInboxScreen } from '../../app/feedback-inbox';
import { StaticItems } from '../../app/_components/store';

export default function FeedbackEmpty() {
  return <StaticItems value={[]}><FeedbackInboxScreen /></StaticItems>;
}
