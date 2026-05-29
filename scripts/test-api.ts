const LC_HEADERS = { "Content-Type": "application/json", "Referer": "https://leetcode.com", "User-Agent": "Mozilla/5.0" };

async function test() {
  const currentYear = new Date().getFullYear();
  let aliases = "";
  for (let y = 2015; y <= currentYear; y++) {
    aliases += `y${y}: userCalendar(year: ${y}) { submissionCalendar }\n`;
  }
  
  const query = `
    query($username: String!) {
      matchedUser(username: $username) {
        userCalendar { streak totalActiveDays }
        ${aliases}
      }
    }
  `;
  const res = await fetch("https://leetcode.com/graphql", { method: "POST", headers: LC_HEADERS, body: JSON.stringify({ query, variables: { username: "lee215" } }) });
  const text = await res.text();
  const data = JSON.parse(text);
  const user = data?.data?.matchedUser;
  if (!user) return console.log("Not found");
  
  const allTimestamps: number[] = [];
  for (let y = 2015; y <= currentYear; y++) {
      if (user[`y${y}`] && user[`y${y}`].submissionCalendar) {
         const subCal = JSON.parse(user[`y${y}`].submissionCalendar);
         allTimestamps.push(...Object.keys(subCal).map(Number));
      }
  }
  allTimestamps.sort((a,b) => a - b);
  
  let maxStreak = 0;
  let currentStreak = 0;
  let previousDate = 0;
  
  for (const ts of allTimestamps) {
      if (currentStreak === 0) {
          currentStreak = 1;
          previousDate = ts;
      } else {
          const diffDays = Math.round((ts - previousDate) / 86400);
          if (diffDays === 1) {
              currentStreak++;
          } else if (diffDays > 1) {
              if (currentStreak > maxStreak) maxStreak = currentStreak;
              currentStreak = 1;
          }
          previousDate = ts;
      }
  }
  if (currentStreak > maxStreak) maxStreak = currentStreak;
  
  console.log("Calculated MAX streak:", maxStreak);
  console.log("Returned current streak:", user.userCalendar.streak);
}
test();
