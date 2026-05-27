export default function DebugEnv() {
  return (
    <pre>
      {JSON.stringify(
        {
          vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ? "SET" : "MISSING",
          email: process.env.VAPID_EMAIL,
        },
        null,
        2
      )}
    </pre>
  );
}

