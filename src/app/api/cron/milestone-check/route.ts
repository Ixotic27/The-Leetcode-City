// Vercel crons call GET with the CRON_SECRET bearer; the recording logic lives in the POST handler.
export { POST as GET } from "@/app/api/milestone-celebration/route";
