import { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearch } from 'wouter';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

// 示例模板数据（用于展示，实际从 API 获取）
const DEMO_TEMPLATES = [
  { id: 1, templateId: 'tpl_001', name: '西湖春韵', imageUrl: '/assets/figma/8255-8618.webp', city: '杭州', scenicSpot: '西湖', groupType: 'girl_young', price: 0, isFree: true, sortOrder: 1 },
  { id: 2, templateId: 'tpl_002', name: '橘子洲头', imageUrl: '/assets/figma/8255-8624.webp', city: '长沙', scenicSpot: '橘子洲', groupType: 'girl_young', price: 0, isFree: true, sortOrder: 2 },
  { id: 3, templateId: 'tpl_003', name: '古典佳人', imageUrl: '/assets/figma/8255-8631.webp', city: '杭州', scenicSpot: '西湖', groupType: 'girl_young', price: 10, isFree: false, sortOrder: 3 },
  { id: 4, templateId: 'tpl_004', name: '夕阳舞者', imageUrl: '/assets/figma/8255-8641.webp', city: '长沙', scenicSpot: '橘子洲', groupType: 'girl_young', price: 10, isFree: false, sortOrder: 4 },
  { id: 5, templateId: 'tpl_005', name: '古风红妆', imageUrl: '/assets/figma/8255-8650.webp', city: '北京', scenicSpot: '故宫', groupType: 'girl_young', price: 15, isFree: false, sortOrder: 5 },
  { id: 6, templateId: 'tpl_006', name: '清新少女', imageUrl: '/assets/figma/8255-8648.webp', city: '苏州', scenicSpot: '拙政园', groupType: 'girl_young', price: 0, isFree: true, sortOrder: 6 },
];

// 默认人群类型（当API未返回时使用）
const DEFAULT_GROUP_TYPES = [
  { code: 'girl_young', displayName: '花季少女', photoType: 'single' as const },
  { code: 'woman_mature', displayName: '熟龄姐姐', photoType: 'single' as const },
  { code: 'man_young', displayName: '元气哥哥', photoType: 'single' as const },
  { code: 'man_elder', displayName: '睿智大叔', photoType: 'single' as const },
  { code: 'girl_child', displayName: '软萌娇娃', photoType: 'single' as const },
];

export default function Home() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const [activeGroupCode, setActiveGroupCode] = useState<string>('');

  // 获取用户信息，用于判断新老用户
  const { data: user, isLoading: isUserLoading } = trpc.auth.me.useQuery();

  // 老用户强制跳转到 P6 页面
  useEffect(() => {
    if (isUserLoading) return; // 等待用户信息加载完成
    if (user && !user.isNewUser) {
      // 老用户：已消费过积分（已生成过照片），跳转到 P6 模板选择页
      navigate('/templates', { replace: true });
    }
  }, [user, isUserLoading, navigate]);

  // 用户扫码绑定推广员 API
  const bindUserMutation = trpc.promotion.bindUserToSales.useMutation();
  const [hasBound, setHasBound] = useState(false);

  // 解析 URL 参数（渠道码、推广员码）并绑定用户
  useEffect(() => {
    if (hasBound) return; // 防止重复绑定
    
    const params = new URLSearchParams(searchString);
    const channel = params.get('channel');
    const sales = params.get('sales');
    const city = params.get('city');
    const spot = params.get('spot');
    
    // 保存推广参数到 localStorage
    if (channel) {
      localStorage.setItem('channelCode', channel);
    }
    if (sales) {
      localStorage.setItem('salesCode', sales);
    }
    if (city) {
      localStorage.setItem('promoCity', city);
    }
    if (spot) {
      localStorage.setItem('promoSpot', spot);
    }
    
    // 如果有推广员码，调用 API 绑定用户
    if (sales && channel) {
      // 生成或获取用户唯一标识
      let userOpenId = localStorage.getItem('userOpenId');
      if (!userOpenId) {
        // 生成一个临时的用户ID（H5环境，小程序环境会用真实的openId）
        userOpenId = `h5_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('userOpenId', userOpenId);
      }
      
      // 检查是否已经绑定过这个推广员
      const boundSales = localStorage.getItem('boundSalesCode');
      if (boundSales !== sales) {
        setHasBound(true); // 标记已尝试绑定
        
        // 调用绑定 API，使用 URL 参数方式
        bindUserMutation.mutate(
          { 
            userOpenId, 
            channelCode: channel,
            salesCode: sales,
            city: city || undefined,
            scenicSpot: spot || undefined,
          },
          {
            onSuccess: (result) => {
              if (result.success) {
                // 绑定成功，记录已绑定的推广员
                localStorage.setItem('boundSalesCode', sales);
                localStorage.setItem('boundChannelId', String(result.channelId || ''));
                localStorage.setItem('boundSalesId', String(result.salesId || ''));
                console.log('用户绑定推广员成功:', result);
              }
            },
            onError: (error) => {
              console.error('用户绑定推广员失败:', error);
            }
          }
        );
      }
    }
  }, [searchString, hasBound]);

  // 获取人群类型列表
  const { data: groupTypesData } = trpc.template.groupTypes.useQuery({ photoType: 'single' });
  
  // 使用API数据或默认数据
  const groupTypes = groupTypesData && groupTypesData.length > 0 
    ? groupTypesData 
    : DEFAULT_GROUP_TYPES;

  // 设置默认选中的人群类型
  useEffect(() => {
    if (groupTypes.length > 0 && !activeGroupCode) {
      setActiveGroupCode(groupTypes[0].code);
    }
  }, [groupTypes, activeGroupCode]);

  // 获取模板列表（使用code筛选）
  const { data: templates, isLoading } = trpc.template.list.useQuery(
    { groupType: activeGroupCode },
    { enabled: !!activeGroupCode }
  );

  // 使用 API 数据或示例数据
  const displayTemplates = templates && templates.length > 0 
    ? templates 
    : DEMO_TEMPLATES.filter(t => t.groupType === activeGroupCode);

  // 实现瀑布流布局：按sortOrder排序，奇数放左列，偶数放右列
  const { leftColumn, rightColumn } = useMemo(() => {
    const sorted = [...displayTemplates].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const left: typeof displayTemplates = [];
    const right: typeof displayTemplates = [];
    
    sorted.forEach((template) => {
      const order = template.sortOrder || 0;
      if (order % 2 === 1) {
        // 奇数放左列
        left.push(template);
      } else {
        // 偶数放右列
        right.push(template);
      }
    });
    
    return { leftColumn: left, rightColumn: right };
  }, [displayTemplates]);

  // 点击模板跳转到详情页
  const handleTemplateClick = (template: typeof DEMO_TEMPLATES[0]) => {
    // 保存选中的模板信息
    localStorage.setItem('selectedTemplate', JSON.stringify(template));
    navigate(`/template/${template.id}`);
  };

  // 获取当前选中的人群类型显示名称
  const activeGroupName = groupTypes.find(g => g.code === activeGroupCode)?.displayName || '';

  return (
    <div className="min-h-screen bg-[#fdf9f6] flex flex-col max-w-[393px] mx-auto relative overflow-hidden">
      {/* iPhone 状态栏 */}
      <div className="h-11 flex items-center justify-between px-5 pt-3 shrink-0">
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
      <div className="h-[54px] flex items-center justify-between px-1.5 shrink-0">
        <div className="w-[87px]" />
        <h1 className="text-[#6f5d55] text-base font-normal font-['Inter']">选择你的梦想瞬间</h1>
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

      {/* 人群类型标签 */}
      <div className="px-3 shrink-0">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
          {groupTypes.map((type) => (
            <button
              key={type.code}
              onClick={() => setActiveGroupCode(type.code)}
              className={cn(
                "whitespace-nowrap text-base font-normal font-['Arimo'] transition-colors relative pb-[18px] pt-[27px]",
                activeGroupCode === type.code 
                  ? "text-[#debab4]" 
                  : "text-[#bcaea8]"
              )}
            >
              {type.displayName}
              {activeGroupCode === type.code && (
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#e89a8d] rounded-b-[10px]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 模板网格 - 瀑布流布局 */}
      <div className="flex-1 overflow-y-auto px-3 pt-[2px]">
        {/* 右侧滚动条指示器 */}
        <div className="fixed right-0 top-[123px] w-2 h-[109px] bg-[#bcaea8]/70 rounded-[5px] z-10" />
        
        {isLoading ? (
          <div className="flex gap-[11px] pb-4">
            <div className="flex-1 flex flex-col gap-[11px]">
              {[1, 3, 5].map(i => (
                <div key={i} className="aspect-[179/250] rounded-[15px] bg-[#bcaea8]/20 animate-pulse" />
              ))}
            </div>
            <div className="flex-1 flex flex-col gap-[11px]">
              {[2, 4, 6].map(i => (
                <div key={i} className="aspect-[179/250] rounded-[15px] bg-[#bcaea8]/20 animate-pulse" />
              ))}
            </div>
          </div>
        ) : displayTemplates.length > 0 ? (
          <div className="flex gap-[11px] pb-4">
            {/* 左列 - 奇数排序 */}
            <div className="flex-1 flex flex-col gap-[11px]">
              {leftColumn.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateClick(template)}
                  className="relative rounded-[15px] overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-[3px_3px_4px_0px_rgba(0,0,0,0.25)]"
                >
                  <div className="aspect-[179/250]">
                    <img
                      src={template.imageUrl}
                      alt={template.name || `模板${template.sortOrder}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
            {/* 右列 - 偶数排序 */}
            <div className="flex-1 flex flex-col gap-[11px]">
              {rightColumn.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateClick(template)}
                  className="relative rounded-[15px] overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-[3px_3px_4px_0px_rgba(0,0,0,0.25)]"
                >
                  <div className="aspect-[179/250]">
                    <img
                      src={template.imageUrl}
                      alt={template.name || `模板${template.sortOrder}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-lg bg-[#bcaea8]/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#bcaea8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <p className="text-[#bcaea8]">暂无模板</p>
          </div>
        )}
      </div>
    </div>
  );
}
