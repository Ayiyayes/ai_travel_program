import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
  Sequence,
} from 'remotion';

export interface MarketingVideoProps {
  title: string;
  subtitle: string;
  features: string[];
  ctaText: string;
}

export const MarketingVideo: React.FC<MarketingVideoProps> = ({
  title,
  subtitle,
  features,
  ctaText,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#fff' }}>
      {/* 场景 1: 标题介绍 (0-90 帧 / 0-3秒) */}
      <Sequence from={0} durationInFrames={90}>
        <TitleScene title={title} subtitle={subtitle} />
      </Sequence>

      {/* 场景 2: 功能展示 (90-240 帧 / 3-8秒) */}
      <Sequence from={90} durationInFrames={150}>
        <FeaturesScene features={features} />
      </Sequence>

      {/* 场景 3: 行动号召 (240-300 帧 / 8-10秒) */}
      <Sequence from={240} durationInFrames={60}>
        <CTAScene ctaText={ctaText} />
      </Sequence>
    </AbsoluteFill>
  );
};

// 场景 1: 标题介绍
const TitleScene: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 标题动画
  const titleProgress = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleScale = interpolate(titleProgress, [0, 1], [0.5, 1]);

  // 副标题动画（延迟 0.5 秒）
  const subtitleProgress = spring({
    frame: frame - 15,
    fps,
    config: {
      damping: 100,
    },
  });

  const subtitleOpacity = interpolate(subtitleProgress, [0, 1], [0, 1]);
  const subtitleY = interpolate(subtitleProgress, [0, 1], [50, 0]);

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 60,
      }}
    >
      <div
        style={{
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
        }}
      >
        <h1
          style={{
            fontSize: 120,
            fontWeight: 'bold',
            color: '#fff',
            textAlign: 'center',
            margin: 0,
            textShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          {title}
        </h1>
      </div>

      <div
        style={{
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
          marginTop: 40,
        }}
      >
        <p
          style={{
            fontSize: 48,
            color: 'rgba(255,255,255,0.9)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      </div>
    </AbsoluteFill>
  );
};

// 场景 2: 功能展示
const FeaturesScene: React.FC<{ features: string[] }> = ({ features }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        padding: 80,
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
        }}
      >
        {features.map((feature, index) => {
          // 每个功能点延迟显示
          const delay = index * 10; // 每个延迟 0.33 秒
          const progress = spring({
            frame: frame - delay,
            fps,
            config: {
              damping: 200,
            },
          });

          const opacity = interpolate(progress, [0, 1], [0, 1]);
          const x = interpolate(progress, [0, 1], [-100, 0]);

          return (
            <div
              key={index}
              style={{
                opacity,
                transform: `translateX(${x}px)`,
                backgroundColor: 'rgba(255,255,255,0.95)',
                padding: '40px 60px',
                borderRadius: 30,
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              }}
            >
              <p
                style={{
                  fontSize: 56,
                  fontWeight: '600',
                  margin: 0,
                  color: '#333',
                }}
              >
                {feature}
              </p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// 场景 3: 行动号召
const CTAScene: React.FC<{ ctaText: string }> = ({ ctaText }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: {
      damping: 100,
    },
  });

  const scale = interpolate(progress, [0, 1], [0.8, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  // 按钮脉冲动画
  const pulseProgress = interpolate(frame % 30, [0, 15, 30], [1, 1.1, 1]);

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
          transform: `scale(${scale})`,
        }}
      >
        <div
          style={{
            backgroundColor: '#fff',
            padding: '50px 120px',
            borderRadius: 60,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            transform: `scale(${pulseProgress})`,
            transition: 'transform 0.3s ease',
          }}
        >
          <p
            style={{
              fontSize: 80,
              fontWeight: 'bold',
              color: '#fa709a',
              margin: 0,
              textAlign: 'center',
            }}
          >
            {ctaText}
          </p>
        </div>

        <p
          style={{
            fontSize: 48,
            color: '#fff',
            textAlign: 'center',
            marginTop: 60,
            textShadow: '0 2px 10px rgba(0,0,0,0.2)',
          }}
        >
          扫码体验 👇
        </p>
      </div>
    </AbsoluteFill>
  );
};
