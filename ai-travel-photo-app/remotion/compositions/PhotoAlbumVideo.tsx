import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
  Sequence,
} from 'remotion';

export interface PhotoAlbumVideoProps {
  photos: string[]; // 照片 URL 数组
  username: string;
  location: string;
}

export const PhotoAlbumVideo: React.FC<PhotoAlbumVideoProps> = ({
  photos,
  username,
  location,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // 如果没有照片，显示占位符
  if (photos.length === 0) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#f0f0f0',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <p style={{ fontSize: 48, color: '#999' }}>暂无照片</p>
      </AbsoluteFill>
    );
  }

  // 计算每张照片的显示时长
  const framesPerPhoto = Math.floor((durationInFrames - 60) / photos.length); // 留 60 帧给片头片尾

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* 片头 (0-30 帧) */}
      <Sequence from={0} durationInFrames={30}>
        <IntroScene username={username} location={location} />
      </Sequence>

      {/* 照片轮播 */}
      {photos.map((photoUrl, index) => (
        <Sequence
          key={index}
          from={30 + index * framesPerPhoto}
          durationInFrames={framesPerPhoto}
        >
          <PhotoSlide photoUrl={photoUrl} index={index} />
        </Sequence>
      ))}

      {/* 片尾 (最后 30 帧) */}
      <Sequence from={durationInFrames - 30} durationInFrames={30}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};

// 片头场景
const IntroScene: React.FC<{ username: string; location: string }> = ({
  username,
  location,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.8, 1]);

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: 80,
            fontWeight: 'bold',
            color: '#fff',
            margin: 0,
            marginBottom: 20,
          }}
        >
          {username} 的旅行回忆
        </h1>
        <p
          style={{
            fontSize: 56,
            color: 'rgba(255,255,255,0.9)',
            margin: 0,
          }}
        >
          📍 {location}
        </p>
      </div>
    </AbsoluteFill>
  );
};

// 照片展示
const PhotoSlide: React.FC<{ photoUrl: string; index: number }> = ({ photoUrl, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 入场动画
  const entranceProgress = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  const opacity = interpolate(entranceProgress, [0, 1], [0, 1]);
  const scale = interpolate(entranceProgress, [0, 1], [0.9, 1]);

  // Ken Burns 效果（缓慢放大）
  const kenBurnsScale = interpolate(frame, [0, 90], [1, 1.1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Img
          src={photoUrl}
          style={{
            maxWidth: '90%',
            maxHeight: '90%',
            objectFit: 'contain',
            transform: `scale(${kenBurnsScale})`,
            borderRadius: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        />
      </div>

      {/* 照片序号 */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          right: 60,
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: '20px 40px',
          borderRadius: 30,
        }}
      >
        <p
          style={{
            fontSize: 40,
            color: '#fff',
            margin: 0,
          }}
        >
          {index + 1}
        </p>
      </div>
    </AbsoluteFill>
  );
};

// 片尾场景
const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          opacity,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: 64,
            fontWeight: 'bold',
            color: '#fff',
            margin: 0,
            marginBottom: 30,
          }}
        >
          AI 旅拍照片
        </p>
        <p
          style={{
            fontSize: 48,
            color: 'rgba(255,255,255,0.9)',
            margin: 0,
          }}
        >
          记录每一刻精彩瞬间
        </p>
      </div>
    </AbsoluteFill>
  );
};
