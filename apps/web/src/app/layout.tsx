import "./globals.css";
export const metadata = {
  title: "Design Flow",
  description: "From Team Conversations to Verified Code.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
