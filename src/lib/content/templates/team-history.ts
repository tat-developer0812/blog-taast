import type { TeamData } from "../types";

// Historical World Cup data for major teams
const WORLD_CUP_HISTORY: Record<string, { titles: number; appearances: number; bestFinish: string }> = {
  Brazil: { titles: 5, appearances: 22, bestFinish: "Vô địch (1958, 1962, 1970, 1994, 2002)" },
  Germany: { titles: 4, appearances: 20, bestFinish: "Vô địch (1954, 1974, 1990, 2014)" },
  Italy: { titles: 4, appearances: 18, bestFinish: "Vô địch (1934, 1938, 1982, 2006)" },
  Argentina: { titles: 3, appearances: 18, bestFinish: "Vô địch (1978, 1986, 2022)" },
  France: { titles: 2, appearances: 16, bestFinish: "Vô địch (1998, 2018)" },
  Uruguay: { titles: 2, appearances: 14, bestFinish: "Vô địch (1930, 1950)" },
  England: { titles: 1, appearances: 16, bestFinish: "Vô địch (1966)" },
  Spain: { titles: 1, appearances: 16, bestFinish: "Vô địch (2010)" },
  Netherlands: { titles: 0, appearances: 11, bestFinish: "Á quân (1974, 1978, 2010)" },
  Portugal: { titles: 0, appearances: 8, bestFinish: "Hạng 3 (1966)" },
  Belgium: { titles: 0, appearances: 14, bestFinish: "Hạng 3 (2018)" },
  Croatia: { titles: 0, appearances: 6, bestFinish: "Á quân (2018, 2022)" },
  Japan: { titles: 0, appearances: 7, bestFinish: "Vòng 1/16 (2002, 2010, 2018, 2022)" },
  "Korea Republic": { titles: 0, appearances: 11, bestFinish: "Hạng 4 (2002)" },
  Mexico: { titles: 0, appearances: 17, bestFinish: "Tứ kết (1970, 1986)" },
  USA: { titles: 0, appearances: 11, bestFinish: "Hạng 3 (1930)" },
};

function renderPlayers(players: TeamData["players"]): string {
  if (!players || players.length === 0) return "";

  const grouped: Record<string, typeof players> = {};
  for (const p of players) {
    const pos = p.position || "Khác";
    if (!grouped[pos]) grouped[pos] = [];
    grouped[pos].push(p);
  }

  const posVi: Record<string, string> = {
    Goalkeeper: "Thủ môn",
    Defence: "Hậu vệ",
    Midfield: "Tiền vệ",
    Offence: "Tiền đạo",
    Khác: "Khác",
  };

  let md = `## Đội hình hiện tại\n\n`;
  md += `| # | Tên | Vị trí | Quốc tịch |\n`;
  md += `|---|-----|--------|----------|\n`;

  const order = ["Goalkeeper", "Defence", "Midfield", "Offence", "Khác"];
  for (const pos of order) {
    if (!grouped[pos]) continue;
    for (const p of grouped[pos]) {
      const num = p.shirtNumber ?? "-";
      md += `| ${num} | ${p.name} | ${posVi[pos] || pos} | ${p.nationality || "-"} |\n`;
    }
  }
  md += "\n";
  return md;
}

export function generateTeamHistory(team: TeamData): string {
  const history = WORLD_CUP_HISTORY[team.name];

  let md = `# ${team.name} - Đội tuyển bóng đá quốc gia\n\n`;

  // Team info card
  md += `## Thông tin đội tuyển\n\n`;
  md += `| Thông tin | Chi tiết |\n`;
  md += `|-----------|----------|\n`;
  md += `| Tên đầy đủ | ${team.name} |\n`;
  if (team.shortName) md += `| Tên viết tắt | ${team.shortName} |\n`;
  if (team.tla) md += `| Mã FIFA | ${team.tla} |\n`;
  md += `| Quốc gia | ${team.area || "N/A"} |\n`;
  if (team.founded) md += `| Thành lập | ${team.founded} |\n`;
  if (team.venue) md += `| Sân nhà | ${team.venue} |\n`;
  if (team.coach) md += `| HLV trưởng | ${team.coach} |\n`;
  md += "\n";

  // World Cup history
  md += `## Lịch sử World Cup\n\n`;

  if (history) {
    md += `**${team.name}** là một trong những đội tuyển có bề dày lịch sử tại World Cup.\n\n`;
    md += `| Thống kê | Số liệu |\n`;
    md += `|----------|----------|\n`;
    md += `| Số lần vô địch | ${history.titles} |\n`;
    md += `| Số lần tham dự | ${history.appearances} |\n`;
    md += `| Thành tích tốt nhất | ${history.bestFinish} |\n\n`;

    if (history.titles > 0) {
      md += `Với **${history.titles} lần vô địch**, ${team.name} là một trong những đội tuyển thành công nhất lịch sử World Cup. `;
    }
    md += `Đội đã tham dự **${history.appearances} kỳ World Cup**, thể hiện sự ổn định và đẳng cấp của bóng đá ${team.area || "quốc gia"}.\n\n`;
  } else {
    md += `**${team.name}** đại diện cho ${team.area || "quốc gia"} tại đấu trường World Cup. `;
    md += `Đội tuyển đang nỗ lực để tạo dấu ấn tại World Cup 2026.\n\n`;
  }

  // World Cup 2026 outlook
  md += `## Triển vọng World Cup 2026\n\n`;
  md += `World Cup 2026 sẽ được tổ chức tại Hoa Kỳ, Canada và Mexico với sự tham gia của 48 đội tuyển - `;
  md += `nhiều hơn bất kỳ kỳ World Cup nào trước đó.\n\n`;

  if (team.coach) {
    md += `Dưới sự dẫn dắt của HLV **${team.coach}**, ${team.name} đang có sự chuẩn bị kỹ lưỡng cho giải đấu. `;
  }
  md += `Đội tuyển sở hữu nhiều cầu thủ tài năng và giàu kinh nghiệm thi đấu quốc tế.\n\n`;

  md += `### Điểm mạnh\n\n`;
  md += `- Đội hình giàu kinh nghiệm thi đấu quốc tế\n`;
  md += `- Truyền thống bóng đá lâu đời\n`;
  md += `- Sự chuẩn bị kỹ lưỡng cho giải đấu\n\n`;

  md += `### Thách thức\n\n`;
  md += `- Sự cạnh tranh khốc liệt với 48 đội tham dự\n`;
  md += `- Thể lực và sự thích nghi với điều kiện thi đấu\n`;
  md += `- Áp lực từ kỳ vọng của người hâm mộ\n\n`;

  // Squad
  if (team.players && team.players.length > 0) {
    md += renderPlayers(team.players);
  }

  md += `---\n\n`;
  md += `*Thông tin được cập nhật tự động từ dữ liệu World Cup 2026.*\n`;

  return md;
}

export function generateTeamHistoryExcerpt(team: TeamData): string {
  const history = WORLD_CUP_HISTORY[team.name];
  if (history) {
    return `Tìm hiểu về đội tuyển ${team.name} tại World Cup 2026. ${history.titles} lần vô địch, ${history.appearances} lần tham dự và đội hình hiện tại.`;
  }
  return `Tìm hiểu về đội tuyển ${team.name} tại World Cup 2026. Lịch sử, đội hình và triển vọng tại giải đấu.`;
}
