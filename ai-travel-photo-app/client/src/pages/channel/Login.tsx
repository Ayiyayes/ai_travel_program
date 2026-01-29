import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock, Eye, EyeOff, Camera, MapPin, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

// 瀑布流图片配置 - 高清艺术写真（已去除水印）
const galleryImages = [
  { src: '/login-images/romantic-flowers.jpg', alt: '法式浪漫鲜花写真', height: 'tall' },
  { src: '/login-images/cute-hanfu-girl.png', alt: '古装小女孩写真', height: 'tall' },
  { src: '/login-images/royal-hanfu-red.jpg', alt: '红色宫廷汉服', height: 'medium' },
  { src: '/login-images/blue-hanfu-man.jpg', alt: '蓝色仙侠男装', height: 'tall' },
  { src: '/login-images/yellow-dress-roses.jpg', alt: '田园风玫瑰写真', height: 'medium' },
  { src: '/login-images/cherry-blossom-hanfu.jpg', alt: '樱花汉服写真', height: 'tall' },
  { src: '/login-images/qing-dynasty-fan.jpg', alt: '清宫执扇美人', height: 'medium' },
  { src: '/login-images/royal-hanfu-gold.jpg', alt: '金色宫廷华服', height: 'tall' },
  { src: '/login-images/snow-horse-rider.jpg', alt: '雪中白马少侠', height: 'medium' },
];

export default function ChannelLoginPage() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hoveredImage, setHoveredImage] = useState<number | null>(null);

  const loginMutation = trpc.channelAuth.login.useMutation({
    onSuccess: (data) => {
      toast.success('登录成功');
      localStorage.setItem('channelToken', data.token);
      localStorage.setItem('channelUser', JSON.stringify(data.user));

      if (data.user.role === 'superadmin') {
        navigate('/admin/dashboard');
      } else if (data.user.role === 'sales') {
        navigate('/sales-portal/dashboard');
      } else {
        navigate('/channel-portal/dashboard');
      }
    },
    onError: (err) => {
      toast.error(err.message || '登录失败');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('请输入账号和密码');
      return;
    }
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="h-screen flex bg-[#faf7f5] overflow-hidden">
      {/* 左侧瀑布流图片展示区域 - 可独立滚动 */}
      <div className="hidden lg:flex lg:flex-col lg:w-[58%] relative bg-[#f5f0ed] h-screen">
        {/* 顶部品牌信息和Slogan */}
        <div className="absolute top-0 left-0 right-0 z-20 p-3 bg-gradient-to-b from-black/50 via-black/30 to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AI 旅拍</h1>
              <p className="text-xs text-white/80">智能换脸 · 梦幻旅拍</p>
            </div>
          </div>
          {/* Slogan */}
          <div className="mt-2">
            <p className="text-white text-lg font-medium tracking-wide" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              每个人都有属于自己的梦想瞬间
            </p>
          </div>
        </div>

        {/* 瀑布流网格 - 可滚动区域，隐藏滚动条 */}
        <div className="flex-1 overflow-y-auto p-3 pt-0 pb-36 hide-scrollbar">
          <div className="columns-2 xl:columns-3 gap-3 space-y-3">
            {galleryImages.map((image, index) => (
              <div
                key={index}
                className="break-inside-avoid relative group cursor-pointer"
                onMouseEnter={() => setHoveredImage(index)}
                onMouseLeave={() => setHoveredImage(null)}
              >
                <div className={`relative overflow-hidden rounded-2xl shadow-lg transition-all duration-500 ${
                  hoveredImage === index ? 'scale-[1.02] shadow-2xl z-10' : ''
                }`}>
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  {/* 悬停遮罩 */}
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${
                    hoveredImage === index ? 'opacity-100' : 'opacity-0'
                  }`}>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white text-sm font-medium">{image.alt}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 底部功能介绍和公司信息 */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">全国景点</p>
                <p className="text-white/60 text-xs">故宫·长城·西湖</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">AI 换脸</p>
                <p className="text-white/60 text-xs">一键生成写真</p>
              </div>
            </div>
          </div>
          {/* 公司信息 */}
          <div className="pt-3 border-t border-white/10">
            <p className="text-white/50 text-[10px] mb-1">北京霸得蛮科技有限公司开发</p>
            <p className="text-white/40 text-[10px]">
              合作联系　Tel: 18673105881　Email: liaowork2020@gmail.com
            </p>
          </div>
        </div>
      </div>

      {/* 右侧登录表单区域 - 固定不滚动 */}
      <div className="w-full lg:w-[42%] flex items-center justify-center p-6 sm:p-8 bg-gradient-to-br from-[#fdf8f6] via-white to-[#f8ece8] h-screen overflow-hidden">
        <div className="w-full max-w-[400px]">
          {/* 移动端 Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-[#e89a8d] to-[#d4887b] rounded-xl flex items-center justify-center shadow-lg">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold text-gray-800">AI 旅拍</h1>
                <p className="text-xs text-gray-500">智能换脸 · 梦幻旅拍</p>
              </div>
            </div>
          </div>

          {/* 登录卡片 */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl shadow-[#e89a8d]/10 p-7 sm:p-8 border border-white/60">
            <div className="text-center mb-7">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">欢迎回来</h2>
              <p className="text-gray-500 text-sm">登录您的账号，开启旅拍之旅</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-700 font-medium text-sm">账号</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="手机号 / 渠道名称 / 渠道编码"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-11 h-11 rounded-xl border-gray-200 focus:border-[#e89a8d] focus:ring-[#e89a8d]/20 bg-gray-50/50 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium text-sm">密码</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 pr-11 h-11 rounded-xl border-gray-200 focus:border-[#e89a8d] focus:ring-[#e89a8d]/20 bg-gray-50/50 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#e89a8d] to-[#d4887b] hover:from-[#d88a7d] hover:to-[#c4786b] text-white font-medium shadow-lg shadow-[#e89a8d]/25 transition-all hover:shadow-xl hover:shadow-[#e89a8d]/30 text-sm"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    登录中...
                  </span>
                ) : '登录'}
              </Button>
            </form>

            {/* 账号类型说明 */}
            <div className="mt-7 pt-5 border-t border-gray-100">
              <p className="text-center text-xs text-gray-500 mb-3">支持以下账号类型登录</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 p-2.5 bg-gray-50/80 rounded-xl">
                  <div className="w-7 h-7 bg-[#e89a8d]/10 rounded-lg flex items-center justify-center">
                    <span className="text-[#e89a8d] text-[10px] font-bold">超</span>
                  </div>
                  <span className="text-[11px] text-gray-600">超级管理员</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 bg-gray-50/80 rounded-xl">
                  <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-[10px] font-bold">机</span>
                  </div>
                  <span className="text-[11px] text-gray-600">机构渠道</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 bg-gray-50/80 rounded-xl">
                  <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 text-[10px] font-bold">推</span>
                  </div>
                  <span className="text-[11px] text-gray-600">机构推广员</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 bg-gray-50/80 rounded-xl">
                  <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 text-[10px] font-bold">个</span>
                  </div>
                  <span className="text-[11px] text-gray-600">个人渠道</span>
                </div>
              </div>
            </div>

            <p className="mt-5 text-center text-[11px] text-gray-400">
              默认密码为 123456，首次登录请修改密码
            </p>
          </div>

          {/* 底部版权 */}
          <p className="mt-6 text-center text-[11px] text-gray-400">
            © 2026 AI 旅拍 · 让每一次旅行都成为艺术
          </p>
        </div>
      </div>
    </div>
  );
}
