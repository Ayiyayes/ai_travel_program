import { Composition } from 'remotion';
import { MarketingVideo } from './compositions/MarketingVideo';
import { PhotoAlbumVideo } from './compositions/PhotoAlbumVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 营销宣传视频 */}
      <Composition
        id="MarketingVideo"
        component={MarketingVideo}
        durationInFrames={300} // 10秒 @ 30fps
        fps={30}
        width={1080}
        height={1920} // 竖屏视频，适合短视频平台
        defaultProps={{
          title: 'AI 旅拍照片',
          subtitle: '一键生成你的专属旅行大片',
          features: [
            '🎨 AI 智能换脸',
            '🏞️ 海量景点模板',
            '📸 一键生成美照',
            '💾 永久保存',
          ],
          ctaText: '立即体验',
        }}
      />

      {/* 用户照片相册视频 */}
      <Composition
        id="PhotoAlbumVideo"
        component={PhotoAlbumVideo}
        durationInFrames={450} // 15秒 @ 30fps
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          photos: [],
          username: '旅行者',
          location: '长沙·橘子洲',
        }}
      />
    </>
  );
};
