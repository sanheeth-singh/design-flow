export default function Page() {
  return (
    <>
      <header>
        <a className="logo" href="#home">
          Fieldnotes
        </a>
        <nav aria-label="Main navigation">
          <a href="#work">Selected work</a>
          <a href="#about">Our approach</a>
          <a href="#contact">Start a conversation</a>
        </nav>
      </header>
      <main id="home">
        <p className="eyebrow">INDEPENDENT DESIGN STUDIO</p>
        <h1>
          Good things grow
          <br />
          from clear ideas.
        </h1>
        <p>
          We help thoughtful teams turn their next idea into something people
          can use.
        </p>
        <a className="cta" href="#work">
          Explore our work
        </a>
        <section id="work">
          <h2>Built with purpose.</h2>
          <p>Digital products, considered details, and room to grow.</p>
        </section>
        <section id="about">
          <h2>Keep it considered.</h2>
          <p>Simple systems. Clear communication. Thoughtful collaboration.</p>
        </section>
        <section id="contact">
          <h2>Let’s make a start.</h2>
          <a href="mailto:hello@example.com">hello@example.com</a>
        </section>
      </main>
      <footer>Fieldnotes Studio · An independent demo frontend</footer>
    </>
  );
}
