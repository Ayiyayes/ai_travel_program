import { Config } from '@remotion/cli/config';

// 配置 Remotion
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(4); // 并发渲染数量

// 设置输出质量
Config.setQuality(90);

// 设置帧率
Config.setFrameRate(30);
