import { RfqForm } from "@/components/rfq-form";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">QuoteReady</h1>
        <p className="text-sm text-muted-foreground">
          Paste a customer enquiry for hex bolts or screws. The model only reads the email and extracts what was asked
          for, with evidence. Fixed rules and an exact catalogue lookup decide each line: ready to quote, clarification
          required, or no compliant match. A person reviews every draft.
        </p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          <li>The catalogue, prices and stock are synthetic demo data.</li>
          <li>Do not paste personal data. Emails are stored for review.</li>
          <li>The rules are a house policy built from supplier practice. They do not replace engineering sign-off.</li>
        </ul>
      </header>
      <RfqForm />
    </main>
  );
}
