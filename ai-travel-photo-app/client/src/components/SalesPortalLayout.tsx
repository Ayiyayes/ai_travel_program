import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  QrCode,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SalesPortalLayoutProps {
  children: ReactNode;
}

interface SalesUser {
  id: number;
  username: string;
  role: string;
  channelId: number | null;
  salesId: number | null;
  channelName?: string;
  salesName?: string;
  salesCode?: string;
  channelCode?: string;
}

const navItems = [
  { title: '数据总览', href: '/sales-portal/dashboard', icon: LayoutDashboard },
  { title: '订单查询', href: '/sales-portal/orders', icon: ShoppingCart },
  { title: '推广工具', href: '/sales-portal/promotion', icon: QrCode },
  { title: '账户设置', href: '/sales-portal/settings', icon: Settings },
];

export default function SalesPortalLayout({ children }: SalesPortalLayoutProps) {
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<SalesUser | null>(null);

  useEffect(() => {
    // 从 localStorage 获取用户信息
    const userStr = localStorage.getItem('channelUser');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        if (userData.role === 'sales') {
          setUser(userData);
        } else {
          // 不是推广员，跳转到登录页
          toast.error('请使用推广员账号登录');
          navigate('/channel/login');
        }
      } catch {
        navigate('/channel/login');
      }
    } else {
      navigate('/channel/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('channelToken');
    localStorage.removeItem('channelUser');
    toast.success('已退出登录');
    navigate('/channel/login');
  };

  // 获取完整的推广员编号（机构编号-推广员编号）
  const getFullSalesCode = () => {
    if (user?.channelCode && user?.salesCode) {
      return `${user.channelCode}-${user.salesCode}`;
    }
    return user?.salesCode || '';
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e89a8d]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#e89a8d] to-[#d4887b] rounded-xl flex items-center justify-center shadow-lg">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-gray-800">推广员门户</h1>
                <p className="text-xs text-gray-500">{getFullSalesCode()}</p>
              </div>
            </div>
          </div>

          {/* 右上角用户头像和下拉菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-auto py-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-[#fdf2f0] text-[#e89a8d] text-sm">
                    {(user.salesName || user.username || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-700">{user.salesName || user.username}</p>
                  <p className="text-xs text-gray-500">推广员</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-2">
                <p className="text-sm font-medium">{user.salesName || user.username}</p>
                <p className="text-xs text-gray-500">{getFullSalesCode()}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/sales-portal/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                账户设置
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/20 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside className={cn(
        "fixed top-16 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-40 transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer",
                    isActive 
                      ? "bg-gradient-to-r from-[#fdf2f0] to-[#fef5f3] text-[#e89a8d] font-medium" 
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={cn("h-5 w-5", isActive ? "text-[#e89a8d]" : "text-gray-400")} />
                  <span>{item.title}</span>
                  {isActive && <ChevronRight className="ml-auto h-4 w-4 text-[#e89a8d]/60" />}
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 主内容区 */}
      <main className="pt-16 lg:pl-64">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
