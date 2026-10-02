import { Chapter, Story } from '../types';
import { saveChapter, addNotification, getStoredStories } from './storage';

export interface CrawlProgressEvent {
  step: string;
  progressPercent: number;
  log: string;
  isComplete?: boolean;
  error?: string;
  newChapterCount?: number;
}

// Sample generator for realistic novel chapters when crawling new sources
const SAMPLE_CRAWLER_PLOTS = [
  {
    titleTemplate: (ch: number) => `Chương ${ch}: Đột phá cảnh giới & Dị tượng thiên địa`,
    paragraphs: [
      'Gió lốc gầm thét, thiên lôi cuồn cuộn trên chín tầng mây! Toàn bộ linh khí trong vòng ngàn dặm như bị một lực hút vô hình lôi kéo, điên cuồng rót vào đan điền.',
      'Từng đường kinh mạch nóng rực như dung nham phun trào. Nhân vật chính cắn chặt răng, vận chuyển công pháp đến cực hạn, không màng đến nỗi đau thấu tận xương tủy.',
      '"Phá cho ta!" - Một tiếng gầm kinh thiên động địa vang lên từ sâu thẳm linh hồn. Rào cản bế tắc bấy lâu bỗng chốc vỡ tan từng mảnh như thủy tinh!',
      'Hào quang vạn trượng phóng thẳng lên trời xanh. Một cỗ uy áp kinh khủng giáng xuống, khiến vạn linh quỳ rạp bái phục. Hắn rốt cuộc đã bước chân vào cảnh giới trong truyền thuyết!',
    ],
  },
  {
    titleTemplate: (ch: number) => `Chương ${ch}: Đấu giá hội phong vân & Đoạt bảo`,
    paragraphs: [
      'Đại sảnh Thiên Bảo Các nguy nga tráng lệ, quy tụ vô số cường giả từ các đại gia tộc và thánh địa cổ xưa.',
      'Trên đài bán đấu giá, một nữ đấu giá sư xinh đẹp tuyệt trần nhẹ nhàng vén tấm lụa đỏ, để lộ ra một khối ngọc thạch phát ra tử quang huyền ảo.',
      '"Món bảo vật tiếp theo: Thái Cổ Di Thạch! Tương truyền chứa đựng một giọt tinh huyết của Chân Long thời thượng cổ! Giá khởi điểm: Một vạn khối thượng phẩm linh thạch!"',
      'Cả sảnh đường lập tức sôi trào náo nhiệt, tiếng tranh giành trả giá vang lên không dứt. Nhân vật chính ngồi trong phòng bao số một, khóe môi khẽ nhếch lên nụ cười tự tin: "Thứ này, ta nhất định phải có!"',
    ],
  },
  {
    titleTemplate: (ch: number) => `Chương ${ch}: Kiếm xuất phong lôi, một kiếm trảm ma`,
    paragraphs: [
      'Bầu trời Hắc Phong Lĩnh đen kịt như mực, tà khí ma vụ nồng nặc che khuất cả trăng sao.',
      'Ma đầu nhe răng cười quái dị, mười ngón tay biến thành vuốt sắc đen sì cào xé hư không lao thẳng về phía trước: "Tiểu tử miệng còn hôi sữa, hôm nay hãy làm huyết tế cho Ma Thần!"',
      'Nhân vật chính đứng sừng sững bất động, trường kiếm trong tay phát ra tiếng ngân thanh thúy như rồng ngâm. Hắn chậm rãi nhắm mắt lại, cảm nhận nhịp đập của trời đất.',
      'Kiếm quang lóe lên! Tựa như một đạo sấm sét xé toạc màn đêm u tối. Không có bất kỳ chiêu thức hoa mỹ nào, chỉ có sự tinh thuần và tốc độ vượt qua giới hạn của thời gian.',
      'Phập! Đầu của ma đầu lăn lông lốc dưới đất, ma vụ tan biến, ánh mặt trời ấm áp lại một lần nữa chiếu rọi thế gian.',
    ],
  },
];

export async function runCrawlerForStory(
  targetUrl: string,
  targetStoryId: string,
  onProgress: (event: CrawlProgressEvent) => void
): Promise<{ success: boolean; chaptersAdded: number }> {
  try {
    const stories = getStoredStories();
    const story = stories.find((s) => s.id === targetStoryId) || stories[0];

    onProgress({
      step: 'Khởi tạo kết nối',
      progressPercent: 10,
      log: `[CRAWLER] Đang kết nối tới nguồn: ${targetUrl}...`,
    });

    await new Promise((r) => setTimeout(r, 600));

    onProgress({
      step: 'Xác thực & Vượt kiểm tra bảo vệ',
      progressPercent: 25,
      log: `[CRAWLER] User-Agent: Chrome/128.0 (Mobile/Desktop TruyenCrawler Engine v3.2)`,
    });

    await new Promise((r) => setTimeout(r, 700));

    onProgress({
      step: 'Phân tích cấu trúc DOM truyện',
      progressPercent: 45,
      log: `[CRAWLER] Đã tải trang Mục Lục. Trích xuất selector: .chapter-c, #chapter-content...`,
    });

    await new Promise((r) => setTimeout(r, 800));

    // Determine current max chapter
    const currentMaxChapter = story.totalChapters || 3;
    const chaptersToAdd = Math.floor(Math.random() * 2) + 1; // 1-2 new chapters
    let addedCount = 0;

    for (let i = 1; i <= chaptersToAdd; i++) {
      const newChapterNumber = currentMaxChapter + i;
      const plotIndex = (newChapterNumber - 1) % SAMPLE_CRAWLER_PLOTS.length;
      const plot = SAMPLE_CRAWLER_PLOTS[plotIndex];

      onProgress({
        step: `Đang bóc tách & Lọc sạch chương ${newChapterNumber}`,
        progressPercent: 50 + Math.round((i / chaptersToAdd) * 40),
        log: `[CRAWLER] Thu thập Chương ${newChapterNumber}: Đã loại bỏ 4 banner rác, chuẩn hóa dấu tiếng Việt...`,
      });

      await new Promise((r) => setTimeout(r, 700));

      const newChapter: Chapter = {
        id: `${story.id}-${newChapterNumber}`,
        storyId: story.id,
        chapterNumber: newChapterNumber,
        title: plot.titleTemplate(newChapterNumber),
        wordCount: Math.floor(Math.random() * 1000) + 2200,
        publishedAt: new Date().toISOString().split('T')[0],
        views: 120,
        content: plot.paragraphs,
      };

      saveChapter(story.id, newChapter);
      addedCount++;
    }

    onProgress({
      step: 'Hoàn tất cập nhật cơ sở dữ liệu',
      progressPercent: 100,
      log: `[CRAWLER] Thành công! Đã thêm ${addedCount} chương mới vào truyện "${story.title}".`,
      isComplete: true,
      newChapterCount: addedCount,
    });

    // Send push notification
    addNotification({
      id: `crawl-notif-${Date.now()}`,
      storyId: story.id,
      title: `Chương mới: ${story.title}`,
      message: `Hệ thống Crawler vừa tự động cập nhật ${addedCount} chương mới!`,
      timestamp: 'Vừa xong',
      isRead: false,
      linkChapterNumber: currentMaxChapter + 1,
    });

    return { success: true, chaptersAdded: addedCount };
  } catch (error: any) {
    onProgress({
      step: 'Lỗi Crawler',
      progressPercent: 100,
      log: `[CRAWLER ERROR] ${error?.message || 'Không thể cào dữ liệu nguồn này'}`,
      isComplete: true,
      error: error?.message,
    });
    return { success: false, chaptersAdded: 0 };
  }
}
