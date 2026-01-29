import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';

// 示例模板数据
const DEMO_TEMPLATES = [
  { id: 1, templateId: 'tpl_001', name: '西湖春韵', imageUrl: '/assets/figma/8255-8618.webp', city: '杭州', scenicSpot: '西湖', groupType: '花季少女', price: 0, isFree: true },
  { id: 2, templateId: 'tpl_002', name: '橘子洲头', imageUrl: '/assets/figma/8255-8624.webp', city: '长沙', scenicSpot: '橘子洲', groupType: '花季少女', price: 0, isFree: true },
  { id: 3, templateId: 'tpl_003', name: '古典佳人', imageUrl: '/assets/figma/8255-8631.webp', city: '杭州', scenicSpot: '西湖', groupType: '花季少女', price: 10, isFree: false },
  { id: 4, templateId: 'tpl_004', name: '夕阳舞者', imageUrl: '/assets/figma/8255-8641.webp', city: '长沙', scenicSpot: '橘子洲', groupType: '花季少女', price: 10, isFree: false },
  { id: 5, templateId: 'tpl_005', name: '古风红妆', imageUrl: '/assets/figma/8255-8650.webp', city: '北京', scenicSpot: '故宫', groupType: '花季少女', price: 15, isFree: false },
  { id: 6, templateId: 'tpl_006', name: '清新少女', imageUrl: '/assets/figma/8255-8648.webp', city: '苏州', scenicSpot: '拙政园', groupType: '花季少女', price: 0, isFree: true },
];

export default function TemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [localTemplate, setLocalTemplate] = useState<typeof DEMO_TEMPLATES[0] | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 从 localStorage 获取模板信息
  useEffect(() => {
    const savedTemplate = localStorage.getItem('selectedTemplate');
    if (savedTemplate) {
      setLocalTemplate(JSON.parse(savedTemplate));
    } else {
      // 如果没有保存的模板，使用示例数据
      const demo = DEMO_TEMPLATES.find(t => t.id === parseInt(id || '0'));
      if (demo) {
        setLocalTemplate(demo);
      }
    }
  }, [id]);

  // 从 API 获取模板信息
  const { data: apiTemplate, isLoading } = trpc.template.getById.useQuery(
    { id: parseInt(id || '0') },
    { enabled: !!id }
  );

  // 优先使用 API 数据，否则使用本地数据
  const template = apiTemplate || localTemplate;

  // 预加载图片并获取尺寸
  useEffect(() => {
    if (template?.imageUrl) {
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        setImageLoaded(true);
      };
      img.src = template.imageUrl;
    }
  }, [template?.imageUrl]);

  const handleBack = () => {
    navigate('/');
  };

  const handleStartPhoto = () => {
    if (!isAuthenticated) {
      // 跳转登录
      window.location.href = getLoginUrl();
      return;
    }
    // 保存模板信息并跳转到拍照页
    if (template) {
      localStorage.setItem('selectedTemplates', JSON.stringify([template.id]));
    }
    navigate(`/camera?templates=${id}`);
  };

  if (isLoading && !localTemplate) {
    return (
      <div className="w-full h-screen min-h-[100dvh] bg-[#fdf9f6] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#e89a8d] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="w-full h-screen min-h-[100dvh] bg-[#fdf9f6] flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">模板不存在</p>
        <button 
          className="bg-[#e89a8d] text-white px-6 py-3 rounded-[10px]" 
          onClick={handleBack}
        >
          返回首页
        </button>
      </div>
    );
  }

  // 计算图片样式，确保完整显示在屏幕内
  const getImageStyle = () => {
    if (!imageLoaded || !imageDimensions.width || !imageDimensions.height) {
      return {};
    }

    const imageRatio = imageDimensions.width / imageDimensions.height;
    
    // 对于竖版图片（高度大于宽度），使用高度100%，宽度自适应
    // 对于横版图片（宽度大于高度），使用宽度100%，高度自适应
    if (imageRatio < 1) {
      // 竖版图片：高度填满，宽度自适应居中
      return {
        height: '100%',
        width: 'auto',
        maxWidth: '100%',
      };
    } else {
      // 横版图片：宽度填满，高度自适应居中
      return {
        width: '100%',
        height: 'auto',
        maxHeight: '100%',
      };
    }
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-screen min-h-[100dvh] relative bg-[#fdf9f6] overflow-hidden flex flex-col"
    >
      {/* iPhone 状态栏和导航栏 */}
      <div className="flex-shrink-0 z-10 bg-transparent">
        {/* 状态栏 */}
        <div className="h-11 flex items-center justify-between px-5 pt-3">
          <span className="text-sm font-medium text-black">9:41</span>
          <div className="flex items-center gap-1">
            {/* 信号强度 */}
            <div className="flex items-end gap-0.5">
              <div className="w-[3px] h-[4.5px] bg-black rounded-[1px]" />
              <div className="w-[3px] h-[6px] bg-black rounded-[1px]" />
              <div className="w-[3px] h-[8px] bg-black rounded-[1px]" />
              <div className="w-[3px] h-[10px] bg-black/30 rounded-[1px]" />
            </div>
            {/* WiFi */}
            <svg className="w-4 h-3.5" viewBox="0 0 16 14" fill="black">
              <path d="M8 10.94c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1-1.1-.5-1.1-1.1.5-1.1 1.1-1.1zm0-3c1.4 0 2.7.5 3.7 1.5l-1.2 1.2c-.7-.7-1.5-1-2.5-1s-1.8.4-2.5 1l-1.2-1.2c1-1 2.3-1.5 3.7-1.5zm0-3c2.2 0 4.2.9 5.7 2.3l-1.2 1.2c-1.2-1.2-2.8-1.8-4.5-1.8s-3.3.7-4.5 1.8l-1.2-1.2c1.5-1.4 3.5-2.3 5.7-2.3z"/>
            </svg>
            {/* 电池 */}
            <div className="flex items-center">
              <div className="w-[23px] h-3 border border-black rounded-[3px] relative">
                <div className="absolute left-[2px] top-[2px] bottom-[2px] w-[19px] bg-black rounded-[1px]" />
              </div>
              <div className="w-[1px] h-1 bg-black ml-[1px]" />
            </div>
          </div>
        </div>

        {/* 导航栏 */}
        <div className="h-[44px] flex items-center justify-between px-1.5">
          {/* 返回按钮 */}
          <button 
            className="h-8 flex items-center gap-1 px-2"
            onClick={handleBack}
          >
            <svg className="w-[9px] h-[17px]" viewBox="0 0 9 17" fill="none">
              <path d="M8 1L1 8.5L8 16" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-black text-base">返回</span>
          </button>
          
          {/* 微信小程序胶囊按钮 */}
          <div className="w-[87px] h-8 bg-white rounded-[18.55px] border-[0.5px] border-[#e9e9e9] flex items-center">
            <div className="flex-1 flex justify-center">
              <div className="flex gap-[3px]">
                <div className="w-[5px] h-[5px] rounded-full bg-black" />
                <div className="w-[5px] h-[5px] rounded-full bg-black" />
                <div className="w-[5px] h-[5px] rounded-full bg-black" />
              </div>
            </div>
            <div className="w-[0.5px] h-5 bg-[#e9e9e9]" />
            <div className="flex-1 flex justify-center">
              <div className="w-[18px] h-[18px] rounded-full border-2 border-black flex items-center justify-center">
                <div className="w-[8px] h-[8px] rounded-full bg-black" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 图片区域 - 自适应填充剩余空间 */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-2 pb-[140px]">
        <img
          src={template.imageUrl}
          alt={template.name}
          className="rounded-lg shadow-lg"
          style={{
            ...getImageStyle(),
            objectFit: 'contain',
          }}
          onLoad={(e) => {
            const img = e.target as HTMLImageElement;
            setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            setImageLoaded(true);
          }}
        />
      </div>

      {/* 底部拍照按钮 - 固定在底部 */}
      <div className="absolute bottom-0 left-0 right-0 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-4 flex justify-center bg-gradient-to-t from-[#fdf9f6] via-[#fdf9f6]/80 to-transparent">
        <div 
          className="w-36 h-[78px] cursor-pointer active:scale-95 transition-transform relative"
          onClick={handleStartPhoto}
        >
          {/* 按钮背景 */}
          <div className="absolute inset-0 bg-[#e89a8d] rounded-[10px] border-[3px] border-[#fdf9f6] shadow-lg" />
          
          {/* 相机图标 */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-[50px] h-[41px]" viewBox="0 0 62 51" fill="none">
              {/* 相机外框 */}
              <path d="M55.625 8.75H48.125L44.375 2.625C43.75 1.75 42.75 1.25 41.625 1.25H20.375C19.25 1.25 18.25 1.75 17.625 2.625L13.875 8.75H6.375C3.375 8.75 1 11.125 1 14.125V44.125C1 47.125 3.375 49.5 6.375 49.5H55.625C58.625 49.5 61 47.125 61 44.125V14.125C61 11.125 58.625 8.75 55.625 8.75Z" stroke="#fdf9f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              {/* 镜头圆圈 */}
              <circle cx="31" cy="29" r="12" stroke="#fdf9f6" strokeWidth="2"/>
              {/* 闪光灯 */}
              <circle cx="50" cy="17" r="3" fill="#fdf9f6"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
