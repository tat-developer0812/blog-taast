import type { MatchData } from "../types";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function formatStage(stage: string | null): string {
  const stageMap: Record<string, string> = {
    GROUP_STAGE: "Vòng bảng",
    ROUND_OF_16: "Vòng 1/16",
    QUARTER_FINALS: "Tứ kết",
    SEMI_FINALS: "Bán kết",
    THIRD_PLACE: "Tranh hạng 3",
    FINAL: "Chung kết",
  };
  return stage ? stageMap[stage] || stage : "World Cup 2026";
}

function renderSquad(team: MatchData["homeTeam"]): string {
  if (!team.players || team.players.length === 0) return "";

  const grouped: Record<string, typeof team.players> = {};
  for (const p of team.players) {
    const pos = p.position || "Khác";
    if (!grouped[pos]) grouped[pos] = [];
    grouped[pos].push(p);
  }

  const positionOrder = ["Goalkeeper", "Defence", "Midfield", "Offence", "Khác"];
  const positionVi: Record<string, string> = {
    Goalkeeper: "Thủ môn",
    Defence: "Hậu vệ",
    Midfield: "Tiền vệ",
    Offence: "Tiền đạo",
    Khác: "Khác",
  };

  let md = `### Đội hình ${team.name}\n\n`;
  for (const pos of positionOrder) {
    if (!grouped[pos]) continue;
    md += `**${positionVi[pos] || pos}:**\n`;
    for (const p of grouped[pos]) {
      const num = p.shirtNumber ? ` (#${p.shirtNumber})` : "";
      md += `- ${p.name}${num}\n`;
    }
    md += "\n";
  }
  return md;
}

export function generateMatchPreview(match: MatchData): string {
  const { homeTeam, awayTeam } = match;
  const stage = formatStage(match.stage);
  const date = formatDate(match.utcDate);
  const group = match.group ? ` - ${match.group}` : "";

  let md = `# ${homeTeam.name} vs ${awayTeam.name} - Nhận định trận đấu\n\n`;

  // Match info box
  md += `> **${stage}${group}**\n`;
  md += `> 📅 ${date} (giờ Việt Nam)\n`;
  if (homeTeam.venue) md += `> 🏟️ ${homeTeam.venue}\n`;
  md += "\n---\n\n";

  // Overview
  md += `## Tổng quan trận đấu\n\n`;
  md += `Trận đấu giữa **${homeTeam.name}** và **${awayTeam.name}** hứa hẹn sẽ là một trong những trận cầu đáng xem nhất tại ${stage} World Cup 2026. `;

  if (homeTeam.coach && awayTeam.coach) {
    md += `Hai nhà cầm quân ${homeTeam.coach} và ${awayTeam.coach} sẽ đưa ra những phương án chiến thuật tốt nhất cho đội nhà.\n\n`;
  } else {
    md += `Cả hai đội đều quyết tâm giành chiến thắng để tiến sâu vào giải đấu.\n\n`;
  }

  // Team info
  md += `## Thông tin đội tuyển\n\n`;

  md += `### ${homeTeam.name}\n\n`;
  md += `| Thông tin | Chi tiết |\n|-----------|----------|\n`;
  md += `| Quốc gia | ${homeTeam.area || "N/A"} |\n`;
  if (homeTeam.founded) md += `| Thành lập | ${homeTeam.founded} |\n`;
  if (homeTeam.coach) md += `| HLV trưởng | ${homeTeam.coach} |\n`;
  if (homeTeam.venue) md += `| Sân nhà | ${homeTeam.venue} |\n`;
  md += "\n";

  md += `### ${awayTeam.name}\n\n`;
  md += `| Thông tin | Chi tiết |\n|-----------|----------|\n`;
  md += `| Quốc gia | ${awayTeam.area || "N/A"} |\n`;
  if (awayTeam.founded) md += `| Thành lập | ${awayTeam.founded} |\n`;
  if (awayTeam.coach) md += `| HLV trưởng | ${awayTeam.coach} |\n`;
  if (awayTeam.venue) md += `| Sân nhà | ${awayTeam.venue} |\n`;
  md += "\n";

  // Squads
  const homeSquad = renderSquad(homeTeam);
  const awaySquad = renderSquad(awayTeam);
  if (homeSquad || awaySquad) {
    md += `## Đội hình dự kiến\n\n`;
    md += homeSquad;
    md += awaySquad;
  }

  // Analysis
  md += `## Phân tích trận đấu\n\n`;
  md += `Đây là trận đấu ở ${stage} World Cup 2026 giữa hai đội tuyển có truyền thống bóng đá mạnh. `;
  md += `${homeTeam.name} sẽ có lợi thế sân nhà, trong khi ${awayTeam.name} cần thể hiện bản lĩnh trên sân khách.\n\n`;

  md += `### Điểm mạnh ${homeTeam.name}\n\n`;
  md += `- Lợi thế sân nhà và sự cổ vũ từ khán giả\n`;
  md += `- Đội hình giàu kinh nghiệm thi đấu quốc tế\n`;
  md += `- Sự chỉ đạo chiến thuật của HLV ${homeTeam.coach || "đội nhà"}\n\n`;

  md += `### Điểm mạnh ${awayTeam.name}\n\n`;
  md += `- Tinh thần thi đấu cao và quyết tâm chiến thắng\n`;
  md += `- Khả năng phản công nhanh và hiệu quả\n`;
  md += `- Kinh nghiệm từ các giải đấu quốc tế\n\n`;

  // Key to watch
  md += `## Những điểm đáng chú ý\n\n`;
  md += `1. **Phong độ gần đây** - Cả hai đội đều cần duy trì phong độ tốt nhất\n`;
  md += `2. **Đội hình xuất phát** - Sự lựa chọn đội hình sẽ quyết định cục diện trận đấu\n`;
  md += `3. **Chiến thuật** - Ai kiểm soát bóng tốt hơn sẽ có lợi thế\n`;
  md += `4. **Bóng chết** - Những tình huống cố định có thể tạo ra sự khác biệt\n\n`;

  md += `---\n\n`;
  md += `*Bài viết được cập nhật tự động từ dữ liệu World Cup 2026.*\n`;

  return md;
}

export function generateMatchPreviewExcerpt(match: MatchData): string {
  const stage = formatStage(match.stage);
  return `Nhận định trận đấu ${match.homeTeam.name} vs ${match.awayTeam.name} tại ${stage} World Cup 2026. Phân tích đội hình, chiến thuật và dự đoán kết quả.`;
}
