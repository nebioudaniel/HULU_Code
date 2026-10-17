export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-500">
        Coming soon.
      </p>
    </section>
  )
}
