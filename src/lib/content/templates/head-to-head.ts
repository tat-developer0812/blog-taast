import type { H2HData, MatchData } from "../types";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatStage(stage: string | null): string {
  const map: Record<string, string> = {
    GROUP_STAGE: "Vòng bảng",
    ROUND_OF_16: "Vòng 1/16",
    QUARTER_FINALS: "Tứ kết",
    SEMI_FINALS: "Bán kết",
    THIRD_PLACE: "Tranh hạng 3",
    FINAL: "Chung kết",
  };
  return stage ? map[stage] || stage : "";
}

function renderRecentMatches(matches: MatchData[], team1Name: string, team2Name: string): string {
  if (matches.length === 0) return "";

  let md = `## Các trận đấu gần đây\n\n`;
  md += `| Ngày | Trận đấu | Tỷ số | Giải đấu |\n`;
  md += `|------|----------|-------|----------|\n`;

  for (const m of matches.slice(0, 10)) {
    const date = formatDate(m.utcDate);
    const score =
      m.homeScore !== null ? `${m.homeScore} - ${m.awayScore}` : "vs";
    const comp = m.competition?.name || "";
    md += `| ${date} | ${m.homeTeam.name} vs ${m.awayTeam.name} | ${score} | ${comp} |\n`;
  }
  md += "\n";
  return md;
}

export function generateHeadToHead(data: H2HData): string {
  const { team1, team2 } = data;

  let md = `# ${team1.name} vs ${team2.name} - Lịch sử đối đầu\n\n`;

  md += `> Thống kê đầy đủ lịch sử đối đầu giữa **${team1.name}** và **${team2.name}** trong bóng đá quốc tế.\n\n`;

  // Stats summary
  md += `## Thống kê tổng quan\n\n`;
  md += `| Thống kê | ${team1.name} | | ${team2.name} |\n`;
  md += `|----------|:---:|:---:|:---:|\n`;
  md += `| Số trận thắng | **${data.team1Wins}** | / ${data.totalMatches} trận | **${data.team2Wins}** |\n`;
  md += `| Số trận hòa | | **${data.draws}** | |\n`;
  md += `| Tổng bàn thắng | **${data.team1Goals}** | | **${data.team2Goals}** |\n`;

  if (data.totalMatches > 0) {
    const t1Avg = (data.team1Goals / data.totalMatches).toFixed(1);
    const t2Avg = (data.team2Goals / data.totalMatches).toFixed(1);
    md += `| TB bàn/trận | **${t1Avg}** | | **${t2Avg}** |\n`;
  }
  md += "\n";

  // Win percentage visual
  if (data.totalMatches > 0) {
    const t1Pct = Math.round((data.team1Wins / data.totalMatches) * 100);
    const t2Pct = Math.round((data.team2Wins / data.totalMatches) * 100);
    const drawPct = Math.round((data.draws / data.totalMatches) * 100);

    md += `## Tỷ lệ thắng/thua/hòa\n\n`;
    md += `- ${team1.name}: **${t1Pct}%** thắng\n`;
    md += `- Hòa: **${drawPct}%**\n`;
    md += `- ${team2.name}: **${t2Pct}%** thắng\n\n`;
  }

  // Analysis
  md += `## Phân tích đối đầu\n\n`;

  if (data.totalMatches === 0) {
    md += `${team1.name} và ${team2.name} chưa từng gặp nhau trong lịch sử. `;
    md += `Trận đấu tại World Cup 2026 sẽ là lần chạm trán đầu tiên giữa hai đội.\n\n`;
  } else {
    const dominant =
      data.team1Wins > data.team2Wins
        ? team1.name
        : data.team2Wins > data.team1Wins
          ? team2.name
          : null;

    if (dominant) {
      md += `Trong **${data.totalMatches} trận** đối đầu, **${dominant}** chiếm ưu thế rõ rệt. `;
    } else {
      md += `Trong **${data.totalMatches} trận** đối đầu, hai đội khá cân bằng. `;
    }

    md += `Tổng cộng đã có **${data.team1Goals + data.team2Goals} bàn thắng** được ghi, `;
    md += `trung bình **${((data.team1Goals + data.team2Goals) / data.totalMatches).toFixed(1)} bàn/trận**.\n\n`;

    if (data.draws > 0) {
      md += `Đáng chú ý, có tới **${data.draws} trận hòa** (${Math.round((data.draws / data.totalMatches) * 100)}%), `;
      md += `cho thấy mức độ cạnh tranh cao giữa hai đội.\n\n`;
    }
  }

  // Recent matches
  md += renderRecentMatches(data.recentMatches, team1.name, team2.name);

  // World Cup 2026 context
  md += `## Đối đầu tại World Cup 2026\n\n`;
  md += `World Cup 2026 sẽ là cơ hội để ${team1.name} và ${team2.name} viết thêm chương mới trong lịch sử đối đầu. `;
  md += `Với format 48 đội lần đầu tiên, cả hai đội đều có cơ hội tiến sâu và đối mặt nhau.\n\n`;

  md += `### Ai có lợi thế?\n\n`;
  if (data.totalMatches > 0 && data.team1Wins !== data.team2Wins) {
    const fav = data.team1Wins > data.team2Wins ? team1 : team2;
    md += `Dựa trên lịch sử, **${fav.name}** có phần nhỉnh hơn. Tuy nhiên, World Cup luôn mang đến những bất ngờ và phong độ hiện tại mới là yếu tố quan trọng nhất.\n\n`;
  } else {
    md += `Lịch sử đối đầu cho thấy hai đội rất cân bằng. Trận đấu tại World Cup 2026 sẽ phụ thuộc vào phong độ và chiến thuật của từng đội.\n\n`;
  }

  md += `---\n\n`;
  md += `*Thống kê được cập nhật tự động.*\n`;

  return md;
}

export function generateH2HExcerpt(data: H2HData): string {
  return `Lịch sử đối đầu ${data.team1.name} vs ${data.team2.name}: ${data.totalMatches} trận, ${data.team1Wins} thắng - ${data.draws} hòa - ${data.team2Wins} thua. Thống kê chi tiết và phân tích.`;
}
