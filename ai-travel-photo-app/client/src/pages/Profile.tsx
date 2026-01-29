import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { 
  ChevronRight, 
  Image, 
  CreditCard, 
  Gift, 
  Settings, 
  HelpCircle,
  Camera,
  User,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 底部导航栏
function BottomNav({ activeTab }: { activeTab: 'home' | 'camera' | 'profile' }) {
  const [, navigate] = useLocation();
  
  return (
    <div className="bottom-nav h-[60px] flex items-center justify-around safe-area-bottom">
      <button 
        className={cn(
          "flex flex-col items-center gap-1",
          activeTab === 'home' ? "text-[#e89a8d]" : "text-[#bcaea8]"
        )}
        onClick={() => navigate('/')}
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
        <span className="text-xs">首页</span>
      </button>
      <button 
        className={cn(
          "flex flex-col items-center gap-1",
          activeTab === 'camera' ? "text-[#e89a8d]" : "text-[#bcaea8]"
        )}
        onClick={() => navigate('/camera')}
      >
        <Camera className="w-6 h-6" />
        <span className="text-xs">拍照</span>
      </button>
      <button 
        className={cn(
          "flex flex-col items-center gap-1",
          activeTab === 'profile' ? "text-[#e89a8d]" : "text-[#bcaea8]"
        )}
        onClick={() => navigate('/profile')}
      >
        <User className="w-6 h-6" />
        <span className="text-xs">我的</span>
      </button>
    </div>
  );
}

// 菜单项组件
function MenuItem({ 
  icon: Icon, 
  label, 
  value, 
  onClick,
  showArrow = true 
}: { 
  icon: any; 
  label: string; 
  value?: string;
  onClick?: () => void;
  showArrow?: boolean;
}) {
  return (
    <button
      className="w-full flex items-center justify-between py-4 px-4 hover:bg-[#f5ebe5]/50 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#f5ebe5] flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#e89a8d]" />
        </div>
        <span className="text-[#6f5d55]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-[#bcaea8] text-sm">{value}</span>}
        {showArrow && <ChevronRight className="w-5 h-5 text-[#bcaea8]" />}
      </div>
    </button>
  );
}

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  // 获取用户详细信息
  const { data: profile } = trpc.user.profile.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // 获取用户照片数量
  const { data: photos } = trpc.photo.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="mini-app-container pb-[60px]">
      {/* 顶部背景 */}
      <div className="h-[200px] bg-gradient-to-b from-[#e89a8d] to-[#debab4] relative">
        {/* 状态栏占位 */}
        <div className="h-11 safe-area-top" />
        
        {/* 标题 */}
        <div className="h-[54px] px-4 flex items-center justify-center">
          <span className="text-white text-base font-medium">我的</span>
        </div>
      </div>

      {/* 用户信息卡片 */}
      <div className="mx-4 -mt-[80px] bg-white rounded-2xl shadow-lg p-4 relative z-10">
        {isAuthenticated && user ? (
          <>
            {/* 已登录状态 */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-[#f5ebe5] flex items-center justify-center overflow-hidden">
                {profile?.avatar ? (
                  <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-[#bcaea8]" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-medium text-[#6f5d55]">
                  {profile?.name || '用户'}
                </h2>
                <span className="text-xs text-[#bcaea8]">欢迎使用 AI 旅拍</span>
              </div>
            </div>

            {/* 积分和照片统计 */}
            <div className="flex border-t border-[#f0ebe8] pt-4">
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-[#e89a8d]">{profile?.points || 0}</div>
                <div className="text-xs text-[#bcaea8] mt-1">积分</div>
              </div>
              <div className="w-px bg-[#f0ebe8]" />
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-[#6f5d55]">{photos?.length || 0}</div>
                <div className="text-xs text-[#bcaea8] mt-1">照片</div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 未登录状态 */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#f5ebe5] flex items-center justify-center">
                <User className="w-8 h-8 text-[#bcaea8]" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-medium text-[#6f5d55]">未登录</h2>
                <p className="text-sm text-[#bcaea8] mt-1">登录后享受更多功能</p>
              </div>
              <button
                className="px-6 py-2 bg-[#e89a8d] text-white rounded-full text-sm font-medium"
                onClick={handleLogin}
              >
                立即登录
              </button>
            </div>
          </>
        )}
      </div>

      {/* 功能菜单 */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <MenuItem
          icon={Image}
          label="我的照片"
          value={photos ? `${photos.length}张` : undefined}
          onClick={() => navigate('/profile/photos')}
        />
        <div className="h-px bg-[#f0ebe8] mx-4" />
        <MenuItem
          icon={CreditCard}
          label="我的订单"
          onClick={() => navigate('/profile/orders')}
        />
        <div className="h-px bg-[#f0ebe8] mx-4" />
        <MenuItem
          icon={Gift}
          label="积分记录"
          onClick={() => navigate('/points')}
        />
      </div>

      {/* 其他菜单 */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <MenuItem
          icon={Settings}
          label="设置"
          onClick={() => navigate('/settings')}
        />
        <div className="h-px bg-[#f0ebe8] mx-4" />
        <MenuItem
          icon={HelpCircle}
          label="帮助与反馈"
          onClick={() => navigate('/help')}
        />
        {isAuthenticated && (
          <>
            <div className="h-px bg-[#f0ebe8] mx-4" />
            <MenuItem
              icon={LogOut}
              label="退出登录"
              onClick={handleLogout}
              showArrow={false}
            />
          </>
        )}
      </div>

      {/* 底部导航 */}
      <BottomNav activeTab="profile" />
    </div>
  );
}
