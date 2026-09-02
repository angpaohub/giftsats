import LegalPage from '../components/LegalPage.jsx';

// PLACEHOLDER COPY — structure only.
// The section order and headings follow the design handoff; the body text is a
// one-line stand-in per section so the layout can be reviewed. Replace each
// `paragraphs` array with the approved wording before launch and drop the
// disclaimer box below.
const SECTIONS = [
  { title: 'Using GiftSats', paragraphs: ['[Scope of the service, who may use it, and what accepting these terms means.]'] },
  { title: 'What a card is', paragraphs: ['[What a gift card represents, that it is a bearer instrument, and who holds the sats until redemption.]'] },
  { title: 'Payment and fees', paragraphs: ['[The Lightning invoice, the service fee, the network fee, and the design fee.]'] },
  { title: 'Redemption', paragraphs: ['[How a card is redeemed, what a Lightning address is, and what happens if a payout fails.]'] },
  { title: 'Expiry and refunds', paragraphs: ['[The 30-day redemption window, refunds to a stated refund address, and forfeiture where none was given.]'] },
  { title: 'Designer submissions', paragraphs: ['[Rights in submitted artwork, the per-use fee, the platform share, and takedown.]'] },
  { title: 'Acceptable use', paragraphs: ['[Prohibited uses, including unlawful purposes and infringing artwork.]'] },
  { title: 'Liability', paragraphs: ['[Limits of liability, and the risks the user accepts when holding a bearer card.]'] },
  { title: 'Changes', paragraphs: ['[How these terms may change and how notice is given.]'] },
];

export default function Terms() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updated="DRAFT — PLACEHOLDER TEXT, NOT YET IN FORCE"
      disclaimer="This page is a layout placeholder. The wording below is not the operative agreement and should not be relied on — the approved text will replace it before launch."
      sections={SECTIONS}
      other={{ to: '/privacy', label: 'Read the Privacy Policy' }}
    />
  );
}
