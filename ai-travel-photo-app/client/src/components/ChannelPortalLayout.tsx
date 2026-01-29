import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  ShoppingCart,
  QrCode,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  User,
  ChevronRight,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelUser {
  id: number;
  username: string;
  role: "institution_channel" | "individual_channel" | "sales";
  channelId?: number;
  salesId?: number;
  mustChangePassword: boolean;
  channelName?: string;
  channelCode?: string;
  channelType?: string;
  salesName?: string;
  salesCode?: string;
}

interface ChannelPortalLayoutProps {
  children: React.ReactNode;
}

// 基础菜单项
const baseMenuItems = [
  {
    title: "数据总览",
    href: "/channel-portal",
    icon: LayoutDashboard,
  },
  {
    title: "订单查询",
    href: "/channel-portal/orders",
    icon: ShoppingCart,
  },
  {
    title: "推广工具",
    href: "/channel-portal/promotion",
    icon: QrCode,
  },
  {
    title: "账户设置",
    href: "/channel-portal/settings",
    icon: Settings,
  },
];

// 机构渠道专属菜单项
const institutionMenuItems = [
  {
    title: "推广员管理",
    href: "/channel-portal/sales",
    icon: Users,
  },
];

export default function ChannelPortalLayout({ children }: ChannelPortalLayoutProps) {
  const [location, setLocation] = useLocation();
  const [user, setUser] = useState<ChannelUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminParams, setAdminParams] = useState('');

  useEffect(() => {
    // 检查是否为管理员代登录模式
    const urlParams = new URLSearchParams(window.location.search);
    const adminToken = urlParams.get('adminToken');
    const channelIdFromUrl = urlParams.get('channelId');
    
    if (adminToken === 'admin' && channelIdFromUrl) {
      // 管理员代登录模式，获取渠道真实信息
      setIsAdminMode(true);
      setAdminParams(`?channelId=${channelIdFromUrl}&adminToken=admin`);
      
      // 获取渠道真实信息
      fetch(`/api/trpc/channelPortal.channelInfo?input=${encodeURIComponent(JSON.stringify({ json: { channelId: parseInt(channelIdFromUrl) } }))}`)
        .then(res => res.json())
        .then(data => {
          const channelData = data?.result?.data?.json;
          setUser({
            id: 0,
            username: '管理员查看',
            role: channelData?.channelType === 'institution' ? 'institution_channel' : 'individual_channel',
            channelId: parseInt(channelIdFromUrl),
            mustChangePassword: false,
            channelName: channelData?.channelName || `渠道 #${channelIdFromUrl}`,
            channelCode: channelData?.channelCode,
            channelType: channelData?.channelType,
          });
        })
        .catch(() => {
          setUser({
            id: 0,
            username: '管理员查看',
            role: 'institution_channel',
            channelId: parseInt(channelIdFromUrl),
            mustChangePassword: false,
            channelName: `渠道 #${channelIdFromUrl}`,
          });
        });
      return;
    }
    
    // 检查登录状态
    const token = localStorage.getItem("channelToken");
    const userStr = localStorage.getItem("channelUser");
    
    if (!token || !userStr) {
      setLocation("/channel/login");
      return;
    }

    try {
      const userData = JSON.parse(userStr);
      setUser(userData);
    } catch {
      setLocation("/channel/login");
    }
  }, [location, setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("channelToken");
    localStorage.removeItem("channelUser");
    setLocation("/channel/login");
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "institution_channel":
        return "机构渠道";
      case "individual_channel":
        return "个人渠道";
      case "sales":
        return "推广员";
      default:
        return "渠道用户";
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e89a8d]"></div>
      </div>
    );
  }

  // 根据用户角色动态生成菜单
  const getMenuItems = () => {
    if (user?.role === "institution_channel") {
      // 机构渠道：在订单查询后插入推广员管理
      return [...baseMenuItems.slice(0, 2), institutionMenuItems[0], ...baseMenuItems.slice(2)];
    }
    return baseMenuItems;
  };

  const menuItems = getMenuItems();

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
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-gray-800">渠道管理平台</h1>
                <p className="text-xs text-gray-500">{user.channelName || user.salesName || user.username}</p>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-auto py-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-[#fdf2f0] text-[#e89a8d] text-sm">
                    {(user.channelName || user.salesName || user.username || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-700">{user.channelName || user.salesName || user.username}</p>
                  <p className="text-xs text-gray-500">{getRoleLabel(user.role)}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-2">
                <p className="text-sm font-medium">{user.channelName || user.salesName || user.username}</p>
                <p className="text-xs text-gray-500">{user.channelCode || user.salesCode}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/channel-portal/settings")}>
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

      {/* 侧边栏 */}
      <aside
        className={cn(
          "fixed top-16 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-40 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location === item.href || 
              location.startsWith(item.href + '?') || 
              (item.href !== "/channel-portal" && location.startsWith(item.href));
            const href = isAdminMode ? `${item.href}${adminParams}` : item.href;
            return (
              <Link key={item.href} href={href}>
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

      {/* 遮罩层 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 主内容区 */}
      <main className="pt-16 lg:pl-64">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
