export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-20">
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">VoxLibre</h1>
        <p className="mt-3 text-lg text-zinc-600">
          Learn a language at your own pace.
        </p>
      </header>

      <section aria-labelledby="courses-heading">
        <h2 id="courses-heading" className="text-2xl font-medium">
          Your courses
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <article className="rounded-lg border border-zinc-200 p-5">
            <h3 className="text-xl font-medium">English to French</h3>
          </article>
          <article className="rounded-lg border border-zinc-200 p-5">
            <h3 className="text-xl font-medium">English to Italian</h3>
          </article>
        </div>
      </section>
    </main>
  );
}
