import { Injectable } from '@nestjs/common';

interface MktProduct {
  name: string;
  url: string;
  tagline: string;
  categories: string[];
  usp: string[];
  audience: string[];
  painPoints: string[];
  socialProof: string[];
}

export interface MktProductContext {
  brandSummary: {
    brand: string;
    strengths: string[];
    contact: string[];
  };
  matchedProducts: Array<{
    name: string;
    url: string;
    tagline: string;
    whyRelevant: string[];
    usp: string[];
    audience: string[];
    painPoints: string[];
    socialProof: string[];
  }>;
}

const BRAND_SUMMARY: MktProductContext['brandSummary'] = {
  brand: 'MKT Software',
  strengths: [
    'Thuong hieu phan mem marketing Viet Nam voi 50,000+ nguoi dung doanh nghiep',
    'He sinh thai cong cu tu dong hoa marketing da nen tang: Facebook, TikTok, Zalo, WhatsApp, X, YouTube, Google Maps, affiliate va SEO traffic',
    'Cap nhat lien tuc theo thay doi nen tang, ho tro 24/7, gia phu hop cho SME Viet Nam',
  ],
  contact: ['0246.291.6668', '0941.113.119', '0968.449.928'],
};

const PRODUCTS: MktProduct[] = [
  {
    name: 'MKT Care',
    url: 'https://phanmemmkt.vn/phan-mem-mkt-care',
    tagline: 'Phan mem nuoi nick Facebook so luong lon',
    categories: ['facebook', 'nuoi nick', 'tai khoan facebook', 'reach', 'comment', 'share'],
    usp: [
      'Nuoi nick Facebook tu dong hang loat theo lich',
      'Quan ly hang tram tai khoan cung luc',
      'Ho tro proxy va da thiet bi de giam nguy co khoa nick',
    ],
    audience: ['seller Facebook', 'shop online', 'agency marketing', 'freelancer MMO'],
    painPoints: ['die nick hang loat', 'mat nhieu gio tuong tac thu cong', 'nick moi reach thap'],
    socialProof: ['50,000+ nguoi dung', 'Nuoi 100-500 nick/ca lam viec'],
  },
  {
    name: 'MKT Post',
    url: 'https://phanmemmkt.vn/mkt-post',
    tagline: 'Tu dong dang bai ban hang tren Facebook',
    categories: ['facebook', 'dang bai', 'group facebook', 'fanpage', 'len lich', 'spin content'],
    usp: [
      'Dang bai len nhieu tai khoan, fanpage va group cung luc',
      'Len lich dang bai theo gio, ngay cu the',
      'Spin noi dung va thay doi anh de tranh trung lap',
    ],
    audience: ['chu shop Facebook', 'admin group', 'agency quan ly fanpage'],
    painPoints: ['mat 3-5 tieng moi ngay dang bai thu cong', 'quen gio vang', 'bai bi trung lap'],
    socialProof: ['Dang 500+ bai/ngay', 'Tiet kiem 80% thoi gian'],
  },
  {
    name: 'MKT UID',
    url: 'https://phanmemmkt.vn/mkt-uid',
    tagline: 'Phan mem tong hop data khach hang tren Facebook',
    categories: ['facebook', 'uid', 'quet data', 'ads', 'custom audience', 'target'],
    usp: [
      'Quet UID khach hang tu nhom, fanpage, bai viet doi thu',
      'Loc data theo gioi tinh, tuoi, khu vuc',
      'Xuat data de chay Facebook Ads Custom Audience',
    ],
    audience: ['media buyer', 'marketing manager', 'agency digital'],
    painPoints: ['target ads sai', 'chi phi ads cao', 'khong tim duoc lead chat luong'],
    socialProof: ['Quet 10,000-50,000 UID/ngay', 'Giam chi phi ads 40-60%'],
  },
  {
    name: 'MKT TikPro',
    url: 'https://phanmemmkt.vn/mkt-tikpro',
    tagline: 'Phan mem nuoi TikTok tu dong',
    categories: ['tiktok', 'fyp', 'follow', 'comment', 'nuoi tai khoan'],
    usp: [
      'Nuoi tai khoan TikTok tu dong: xem video, like, follow, comment',
      'Tang diem uy tin de len FYP',
      'Quan ly nhieu tai khoan TikTok cung luc',
    ],
    audience: ['TikToker', 'chu shop TikTok Shop', 'agency TikTok'],
    painPoints: ['video khong len FYP', 'tai khoan moi it tuong tac'],
    socialProof: ['Tang ty le len FYP 3-5 lan', 'Quan ly 50-200 tai khoan'],
  },
  {
    name: 'MKT Traffic',
    url: 'https://phanmemmkt.vn/phan-mem-mkt-traffic',
    tagline: 'Phan mem tang traffic va cai thien vi tri tu khoa tren Google',
    categories: ['seo', 'traffic', 'google', 'bing', 'coc coc', 'website ranking'],
    usp: [
      'Tang luot truy cap website tu nhieu nguon',
      'Gia lap hanh vi nguoi dung: dung, cuon, click',
      'Ho tro Google, Bing va Coc Coc',
    ],
    audience: ['chu website', 'seo specialist', 'agency SEO'],
    painPoints: ['website tut hang', 'traffic thap', 'chi phi SEO cao va cham thay ket qua'],
    socialProof: ['Tang traffic 200-500% sau 30-60 ngay', 'Cai thien thu hang trong 2-4 tuan'],
  },
  {
    name: 'MKT Viral',
    url: 'https://phanmemmkt.vn/phan-mem-mkt-viral-ver-2',
    tagline: 'Phan mem tai va chinh sua video hang loat',
    categories: ['video', 'tiktok', 'youtube', 'facebook', 'render', 'watermark'],
    usp: [
      'Tai video hang loat khong watermark',
      'Cat, ghep, them text va logo hang loat',
      'Doi metadata video de tranh trung lap',
    ],
    audience: ['content creator da kenh', 'affiliate marketer', 'agency video'],
    painPoints: ['mat nhieu gio edit thu cong', 'video trung bi phat reach'],
    socialProof: ['Xu ly 100-500 video/ngay', 'Tiet kiem 90% thoi gian'],
  },
  {
    name: 'MKT Tube',
    url: 'https://phanmemmkt.vn/mkt-tube',
    tagline: 'Phan mem quan ly he thong kenh YouTube tu dong',
    categories: ['youtube', 'upload video', 'seo youtube', 'tags', 'description'],
    usp: [
      'Quan ly hang chuc kenh YouTube tren mot giao dien',
      'Tu dong upload video theo lich',
      'Toi uu SEO YouTube: title, tags, description',
    ],
    audience: ['YouTuber', 'YouTube automation', 'MCN', 'agency'],
    painPoints: ['mat nhieu gio upload va toi uu thu cong', 'kenh moi kho tang truong'],
    socialProof: ['Quan ly 50+ kenh', 'Tang view tu nhien 3-5x'],
  },
  {
    name: 'MKT Insta',
    url: 'https://phanmemmkt.vn/phan-mem-mkt-insta',
    tagline: 'Phan mem marketing Instagram tu dong',
    categories: ['instagram', 'follow', 'unfollow', 'dm', 'story', 'followers'],
    usp: [
      'Tu dong follow/unfollow, like, comment theo target',
      'Quet va loc followers cua doi thu',
      'Len lich dang post va story',
    ],
    audience: ['brand thoi trang', 'my pham', 'KOL', 'agency Instagram'],
    painPoints: ['tang follower cham', 'mat nhieu gio tuong tac thu cong'],
    socialProof: ['Tang 500-2,000 follower/thang', 'DM conversion 5-15%'],
  },
  {
    name: 'MKT WhatsApp',
    url: 'https://phanmemmkt.vn/phan-mem-mkt-whatsapp',
    tagline: 'Phan mem marketing WhatsApp tu dong',
    categories: ['whatsapp', 'broadcast', 'chatbot', 'international sales', 'bulk message'],
    usp: [
      'Gui tin nhan hang loat qua WhatsApp',
      'Quan ly nhieu so WhatsApp cung luc',
      'Chatbot tra loi 24/7',
    ],
    audience: ['doanh nghiep xuat nhap khau', 'shop ban cho khach nuoc ngoai', 'agency quoc te'],
    painPoints: ['nhan tin thu cong qua lau', 'ty le phan hoi thap'],
    socialProof: ['Gui 1,000-5,000 tin/ngay', 'Ty le mo tin 85-95%'],
  },
  {
    name: 'MKT X',
    url: 'https://phanmemmkt.vn/phan-mem-mkt-twitter',
    tagline: 'Phan mem marketing Twitter/X tu dong',
    categories: ['twitter', 'x', 'tweet', 'thread', 'retweet', 'crypto', 'web3'],
    usp: [
      'Tu dong follow, like, retweet theo target',
      'Dang tweet va thread theo lich',
      'Tu dong gui DM theo kich ban',
    ],
    audience: ['crypto', 'web3', 'trading', 'brand quoc te', 'agency global'],
    painPoints: ['tai khoan X moi khong co follower', 'kho viral', 'mat nhieu gio tuong tac thu cong'],
    socialProof: ['Tang 1,000-5,000 follower/thang', 'Quan ly 20-50 tai khoan'],
  },
  {
    name: 'MKT Maps',
    url: 'https://phanmemmkt.vn/phan-mem-mkt-maps',
    tagline: 'Phan mem marketing Google Maps tu dong',
    categories: ['google maps', 'local seo', '5 sao', 'google my business', 'review'],
    usp: [
      'Tang danh gia 5 sao tren Google Maps',
      'Tang check-in, hinh anh va muc do hien thi GMB',
      'Tu dong tra loi danh gia khach hang',
    ],
    audience: ['nha hang', 'spa', 'phong kham', 'tham my', 'doanh nghiep dia diem thuc'],
    painPoints: ['doi thu chiem top maps', 'it review', 'rating thap mat khach walk-in'],
    socialProof: ['Tang tu 3 sao len 4.5 sao trong 30-60 ngay', 'Tang luot tim kiem 200-400%'],
  },
  {
    name: 'MKT Affiliate',
    url: 'https://phanmemmkt.vn/phan-mem-lam-affiliate-da-kenh-tu-dong',
    tagline: 'Phan mem lam affiliate da kenh tu dong',
    categories: ['affiliate', 'link affiliate', 'shopee', 'lazada', 'tiktok shop', 'publisher'],
    usp: [
      'Tu dong dang link affiliate len nhieu kenh',
      'Quan ly hang nghin link tren mot nen tang',
      'Theo doi hieu suat tung link, tung kenh realtime',
    ],
    audience: ['publisher affiliate', 'CTV online', 'MMO', 'agency affiliate'],
    painPoints: ['dang link thu cong ton thoi gian', 'khong do duoc hieu qua tung kenh'],
    socialProof: ['Tang thu nhap affiliate 3-5x', 'Tiet kiem 6-8 tieng/ngay'],
  },
  {
    name: 'Zmarketing / MKT Zalo PC',
    url: 'https://phanmemmkt.vn/zmarketing',
    tagline: 'Phan mem marketing Zalo tu dong toan dien',
    categories: ['zalo', 'oa', 'gui tin nhan', 'ket ban zalo', 'chatbot zalo'],
    usp: [
      'Gui tin nhan Zalo hang loat cho Zalo ca nhan va OA',
      'Tu dong ket ban Zalo theo target',
      'Dang bai Zalo theo lich va chatbot tra loi 24/7',
    ],
    audience: ['shop noi dia', 'spa', 'phong kham', 'sale B2B', 'SME'],
    painPoints: ['gui tin Zalo thu cong qua ton thoi gian', 'chua tan dung ty le mo tin cao'],
    socialProof: ['Gui 500-2,000 tin/ngay', 'Ty le mo 80-90%', '10,000+ doanh nghiep dang dung'],
  },
];

@Injectable()
export class MktProductContextService {
  buildForArticle(args: {
    keyword: string;
    title: string;
    sections: string[];
  }): MktProductContext | null {
    const corpus = this.normalize([args.keyword, args.title, ...args.sections].join(' '));
    const matched = PRODUCTS.map((product) => ({
      product,
      score: this.scoreProduct(product, corpus),
    }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (matched.length === 0) return null;

    return {
      brandSummary: BRAND_SUMMARY,
      matchedProducts: matched.map(({ product }) => ({
        name: product.name,
        url: product.url,
        tagline: product.tagline,
        whyRelevant: this.pickRelevantBullets(product, corpus),
        usp: product.usp,
        audience: product.audience,
        painPoints: product.painPoints,
        socialProof: product.socialProof,
      })),
    };
  }

  private scoreProduct(product: MktProduct, corpus: string): number {
    const keywordHits = product.categories.reduce(
      (sum, term) => sum + (corpus.includes(this.normalize(term)) ? 3 : 0),
      0,
    );
    const audienceHits = product.audience.reduce(
      (sum, term) => sum + (corpus.includes(this.normalize(term)) ? 2 : 0),
      0,
    );
    const painHits = product.painPoints.reduce(
      (sum, term) => sum + (corpus.includes(this.normalize(term)) ? 2 : 0),
      0,
    );
    const nameHit = corpus.includes(this.normalize(product.name)) ? 5 : 0;

    return keywordHits + audienceHits + painHits + nameHit;
  }

  private pickRelevantBullets(product: MktProduct, corpus: string): string[] {
    const candidates = [...product.usp, ...product.painPoints, ...product.socialProof];
    const hits = candidates.filter((line) =>
      this.tokenize(line).some((token) => token.length >= 4 && corpus.includes(token)),
    );

    return (hits.length > 0 ? hits : [...product.usp.slice(0, 2), ...product.socialProof.slice(0, 1)]).slice(
      0,
      4,
    );
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenize(value: string): string[] {
    return this.normalize(value).split(/\s+/).filter(Boolean);
  }
}
