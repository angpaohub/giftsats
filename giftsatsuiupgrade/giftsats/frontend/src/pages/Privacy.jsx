import LegalPage from '../components/LegalPage.jsx';

// PLACEHOLDER COPY — structure only. See the note in Terms.jsx.
const SECTIONS = [
  { title: 'What we collect', paragraphs: ['[The data the service handles: card details, the sender’s refund address, and designer contact details.]'] },
  { title: 'What we do not collect', paragraphs: ['[No accounts, no passwords, and what is deliberately never stored.]'] },
  { title: 'Card messages', paragraphs: ['[That the message, to and from lines are stored in plain text and visible to anyone holding the link.]'] },
  { title: 'Payment data', paragraphs: ['[What the Lightning node records, and what the payment processor sees.]'] },
  { title: 'Retention', paragraphs: ['[How long card records and designer submissions are kept.]'] },
  { title: 'Sharing', paragraphs: ['[Who data is shared with — infrastructure providers, and nobody else.]'] },
  { title: 'Your choices', paragraphs: ['[How to ask for deletion or a copy of what is held.]'] },
  { title: 'Cookies', paragraphs: ['[What is stored in the browser and why — the draft card and pending invoice.]'] },
  { title: 'Changes', paragraphs: ['[How this policy may change and how notice is given.]'] },
];

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="DRAFT — PLACEHOLDER TEXT, NOT YET IN FORCE"
      disclaimer="This page is a layout placeholder. The wording below is not the operative policy and should not be relied on — the approved text will replace it before launch."
      sections={SECTIONS}
      other={{ to: '/terms', label: 'Read the Terms & Conditions' }}
    />
  );
}
