import { readFile, writeFile } from "node:fs/promises";

const README_PATH = "README.md";
const LEETCODE_USERNAME = "ajitkumarsaini02";
const CODECHEF_USERNAME = "ajitsaini94";

const numberFrom = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getByPath = (obj, path) =>
  path.split(".").reduce((acc, key) => (acc == null ? null : acc[key]), obj);

const pickNumber = (obj, paths) => {
  for (const path of paths) {
    const value = getByPath(obj, path);
    const numeric = numberFrom(value);
    if (numeric != null) return numeric;
  }
  return null;
};

const countAttendedContests = (history) => {
  if (!Array.isArray(history)) return null;
  const attended = history.reduce((total, item) => {
    if (item?.attended === true) return total + 1;
    return total;
  }, 0);
  return attended > 0 ? attended : null;
};

const pickContestCountFromArrays = (obj, paths) => {
  for (const path of paths) {
    const value = getByPath(obj, path);
    if (Array.isArray(value) && value.length > 0) return value.length;
  }
  return null;
};

const fetchLeetCodeStats = async () => {
  const query = `
    query getUserStats($username: String!) {
      matchedUser(username: $username) {
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
      userContestRanking(username: $username) {
        attendedContestsCount
        rating
      }
      userContestRankingHistory(username: $username) {
        attended
      }
    }
  `;

  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { username: LEETCODE_USERNAME } }),
  });

  if (!response.ok) throw new Error(`LeetCode API failed: ${response.status}`);

  const data = await response.json();
  const allStats = data?.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum ?? [];
  const totalSolved = numberFrom(
    allStats.find((item) => item?.difficulty === "All")?.count,
  );
  const contestsFromRanking = numberFrom(data?.data?.userContestRanking?.attendedContestsCount);
  const contestsFromHistory = countAttendedContests(data?.data?.userContestRankingHistory);
  const contests =
    contestsFromRanking == null
      ? contestsFromHistory
      : contestsFromHistory == null
        ? contestsFromRanking
        : Math.max(contestsFromRanking, contestsFromHistory);
  const ratingRaw = numberFrom(data?.data?.userContestRanking?.rating);
  const rating = ratingRaw == null ? null : Math.round(ratingRaw);

  return {
    problems: totalSolved,
    contests,
    rating,
  };
};

const fetchCodeChefStats = async () => {
  const response = await fetch(`https://codechef-api.vercel.app/handle/${CODECHEF_USERNAME}`);
  if (!response.ok) throw new Error(`CodeChef API failed: ${response.status}`);

  const data = await response.json();
  const fullySolved = data?.fullySolved;
  const solvedFromFullySolved =
    typeof fullySolved === "object" && fullySolved != null
      ? pickNumber(fullySolved, ["count", "total", "problemsSolved", "all"]) ??
        Object.values(fullySolved).reduce((sum, value) => {
          const n = numberFrom(value);
          return n == null ? sum : sum + n;
        }, 0)
      : numberFrom(fullySolved);

  return {
    problems:
      solvedFromFullySolved ??
      pickNumber(data, ["problemsSolved", "totalProblemsSolved", "total_solved"]),
    contests:
      pickNumber(data, [
        "contestCount",
        "contests",
        "totalContests",
        "contest_count",
        "userDetails.contestCount",
      ]) ??
      pickContestCountFromArrays(data, [
        "contests",
        "contestData",
        "contestHistory",
        "contest_history",
      ]),
  };
};

const replaceBlock = (content, key, value) => {
  const pattern = new RegExp(`<!--${key}-->[\\s\\S]*?<!--\\/${key}-->`, "g");
  return content.replace(pattern, `<!--${key}-->${value}<!--/${key}-->`);
};

const main = async () => {
  const readme = await readFile(README_PATH, "utf8");
  let nextReadme = readme;

  let leetCodeStats = {};
  let codeChefStats = {};

  try {
    leetCodeStats = await fetchLeetCodeStats();
  } catch (error) {
    console.log("Skipping LeetCode update:", error.message);
  }

  try {
    codeChefStats = await fetchCodeChefStats();
  } catch (error) {
    console.log("Skipping CodeChef update:", error.message);
  }

  if (leetCodeStats.problems != null) {
    nextReadme = replaceBlock(nextReadme, "LEETCODE_PROBLEMS", String(leetCodeStats.problems));
  }
  if (leetCodeStats.contests != null) {
    nextReadme = replaceBlock(nextReadme, "LEETCODE_CONTESTS", String(leetCodeStats.contests));
  }
  if (leetCodeStats.rating != null) {
    nextReadme = nextReadme.replace(
      /LeetCode_Rating-\d+-FFA116/g,
      `LeetCode_Rating-${leetCodeStats.rating}-FFA116`,
    );
  }

  if (codeChefStats.problems != null) {
    nextReadme = replaceBlock(nextReadme, "CODECHEF_PROBLEMS", String(codeChefStats.problems));
  }
  if (codeChefStats.contests != null) {
    nextReadme = replaceBlock(nextReadme, "CODECHEF_CONTESTS", String(codeChefStats.contests));
  }

  if (nextReadme !== readme) {
    await writeFile(README_PATH, nextReadme, "utf8");
    console.log("README updated.");
  } else {
    console.log("No README changes needed.");
  }
};

await main();
