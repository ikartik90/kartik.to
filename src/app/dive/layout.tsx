// React hoists an async script into the server-rendered <head>. `data-path` keeps Inflight's widget to /dive.
export default function DiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script src="https://inflight.co/widget.js" data-org="aius9qpt" data-path="/dive" async />
      {children}
    </>
  );
}
