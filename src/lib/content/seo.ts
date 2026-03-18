import { slugify } from "@/lib/utils/slug";
import type { ArticleType } from "./types";

interface SeoInput {
  type: ArticleType;
  teamName?: string;
  homeTeam?: string;
  awayTeam?: string;
  competition?: string;
  year?: number;
}

interface SeoOutput {
  title: string;
  seoTitle: string;
  seoDescription: string;
  slug: string;
}

const CURRENT_YEAR = 2026;

export function generateSeo(input: SeoInput): SeoOutput {
  switch (input.type) {
    case "match_preview":
      return {
        title: `${input.homeTeam} vs ${input.awayTeam} - Nhận định trận đấu World Cup ${CURRENT_YEAR}`,
        seoTitle: `${input.homeTeam} vs ${input.awayTeam} | Nhận định & Phân tích World Cup ${CURRENT_YEAR}`,
        seoDescription: `Nhận định trận đấu ${input.homeTeam} vs ${input.awayTeam} tại World Cup ${CURRENT_YEAR}. Phân tích đội hình, phong độ, lịch sử đối đầu và dự đoán kết quả.`,
        slug: `${slugify(input.homeTeam!)}-vs-${slugify(input.awayTeam!)}-nhan-dinh-world-cup-${CURRENT_YEAR}`,
      };

    case "prediction":
      return {
        title: `Dự đoán ${input.homeTeam} vs ${input.awayTeam} - World Cup ${CURRENT_YEAR}`,
        seoTitle: `Dự đoán ${input.homeTeam} vs ${input.awayTeam} | Tỷ lệ & Kết quả World Cup ${CURRENT_YEAR}`,
        seoDescription: `Dự đoán kết quả trận ${input.homeTeam} vs ${input.awayTeam} World Cup ${CURRENT_YEAR}. Phân tích tỷ lệ thắng, thua, hòa dựa trên thống kê và phong độ gần đây.`,
        slug: `du-doan-${slugify(input.homeTeam!)}-vs-${slugify(input.awayTeam!)}-world-cup-${CURRENT_YEAR}`,
      };

    case "team_history":
      return {
        title: `${input.teamName} - Lịch sử World Cup & Thông tin đội tuyển`,
        seoTitle: `${input.teamName} World Cup ${CURRENT_YEAR} | Đội hình, Lịch sử & Thành tích`,
        seoDescription: `Tìm hiểu về đội tuyển ${input.teamName} tại World Cup ${CURRENT_YEAR}. Lịch sử tham dự, thành tích, đội hình hiện tại và cơ hội vô địch.`,
        slug: `doi-tuyen-${slugify(input.teamName!)}-world-cup-${CURRENT_YEAR}`,
      };

    case "h2h":
      return {
        title: `${input.homeTeam} vs ${input.awayTeam} - Lịch sử đối đầu`,
        seoTitle: `${input.homeTeam} vs ${input.awayTeam} | Lịch sử đối đầu & Thống kê H2H`,
        seoDescription: `Thống kê lịch sử đối đầu giữa ${input.homeTeam} và ${input.awayTeam}. Số trận thắng, thua, hòa, bàn thắng và các trận đấu đáng nhớ.`,
        slug: `${slugify(input.homeTeam!)}-vs-${slugify(input.awayTeam!)}-lich-su-doi-dau`,
      };

    case "world_cup_history":
      return {
        title: `Lịch sử World Cup - Tất cả các kỳ World Cup từ 1930 đến ${CURRENT_YEAR}`,
        seoTitle: `Lịch sử World Cup | Nhà vô địch, Kỷ lục & Thống kê từ 1930-${CURRENT_YEAR}`,
        seoDescription: `Tổng hợp lịch sử các kỳ World Cup từ 1930 đến ${CURRENT_YEAR}. Danh sách nhà vô địch, vua phá lưới, kỷ lục và những khoảnh khắc đáng nhớ nhất.`,
        slug: `lich-su-world-cup-1930-${CURRENT_YEAR}`,
      };

    case "tournament_analysis":
      return {
        title: `Phân tích World Cup ${CURRENT_YEAR} - Ứng viên vô địch & Dự đoán`,
        seoTitle: `Phân tích World Cup ${CURRENT_YEAR} | Ứng viên vô địch, Bảng đấu & Dự đoán`,
        seoDescription: `Phân tích chuyên sâu World Cup ${CURRENT_YEAR}. Đánh giá ứng viên vô địch, phân tích bảng đấu, và dự đoán đội tuyển sẽ giành cúp vàng.`,
        slug: `phan-tich-world-cup-${CURRENT_YEAR}-ung-vien-vo-dich`,
      };
  }
}
